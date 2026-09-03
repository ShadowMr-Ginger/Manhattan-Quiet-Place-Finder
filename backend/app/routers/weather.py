"""
Weather endpoint — fetches Manhattan current weather + hourly forecast
from OpenWeather every 15 minutes. Cached in memory only, no database storage.

Requires OPENWEATHER_API_KEY in .env
"""
import asyncio
import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["weather"])

# Manhattan coordinates
LAT = 40.7580
LON = -73.9855
REFRESH_INTERVAL = 15 * 60  # 15 minutes

_cache: dict = {}


def get_api_key() -> str:
    key = os.getenv("OPENWEATHER_API_KEY")
    if not key:
        raise ValueError("OPENWEATHER_API_KEY not set in .env")
    return key


def parse_current(raw: dict) -> dict:
    return {
        "temp": raw["main"]["temp"],
        "feels_like": raw["main"]["feels_like"],
        "humidity": raw["main"]["humidity"],
        "description": raw["weather"][0]["description"],
        "icon": raw["weather"][0]["icon"],
        "wind_speed": raw["wind"]["speed"],
    }


def parse_forecast(raw: dict) -> list:
    """Parse next 4 forecast slots (every 3 hours = next 12 hours)."""
    results = []
    for item in raw["list"][:4]:
        results.append({
            "time": item["dt_txt"],
            "temp": item["main"]["temp"],
            "feels_like": item["main"]["feels_like"],
            "humidity": item["main"]["humidity"],
            "description": item["weather"][0]["description"],
            "icon": item["weather"][0]["icon"],
            "wind_speed": item["wind"]["speed"],
        })
    return results


async def fetch_weather() -> dict:
    api_key = get_api_key()
    base_params = {"lat": LAT, "lon": LON, "appid": api_key, "units": "metric"}

    async with httpx.AsyncClient(timeout=10) as client:
        current_resp, forecast_resp = await asyncio.gather(
            client.get("https://api.openweathermap.org/data/2.5/weather", params=base_params),
            client.get("https://api.openweathermap.org/data/2.5/forecast", params={**base_params, "cnt": 4}),
        )
        current_resp.raise_for_status()
        forecast_resp.raise_for_status()

    return {
        "current": parse_current(current_resp.json()),
        "forecast": parse_forecast(forecast_resp.json()),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def refresh_loop():
    """Background task: refresh weather cache every 15 minutes."""
    global _cache
    while True:
        try:
            _cache = await fetch_weather()
            print(f"[weather] refreshed at {_cache['fetched_at']}")
        except Exception as e:
            print(f"[weather] fetch failed: {e}")
        await asyncio.sleep(REFRESH_INTERVAL)


@router.get("/weather")
def get_weather():
    if not _cache:
        raise HTTPException(status_code=503, detail="Weather data not yet available, try again in a moment")
    return _cache
