"""
First-time full historical data import — Manhattan only.

Fetches all Manhattan data from:
  - MTA Subway Hourly Ridership (data.ny.gov)
  - NYC 311 Noise Complaints (data.cityofnewyork.us)

Usage (from backend/ directory):
    python -m scripts.fetch_historical_data
    python -m scripts.fetch_historical_data --mta-only
    python -m scripts.fetch_historical_data --311-only

Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
"""
import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from psycopg2.extras import execute_values

sys.path.append(str(Path(__file__).parent.parent))

from app.database import engine, SessionLocal, Base
from app.models import MtaRidership, NycNoise

PAGE_SIZE = 50000

MTA_URL = "https://data.ny.gov/resource/5wq4-mkjj.json"
NYC_311_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"


def parse_dt(val):
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


# ── MTA ───────────────────────────────────────────────────────────────────────

def fetch_with_retry(url, params, retries=5, timeout=120) -> list[dict]:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            wait = 10 * attempt
            print(f"\n  [retry {attempt}/{retries}] {e} — waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Failed after {retries} retries")


def fetch_mta_page(offset: int) -> list[dict]:
    params = {
        "$where": "borough='Manhattan'",
        "$limit": PAGE_SIZE,
        "$offset": offset,
        "$order": "transit_timestamp ASC",
    }
    return fetch_with_retry(MTA_URL, params)


def row_to_mta(r: dict) -> MtaRidership:
    return MtaRidership(
        transit_timestamp=parse_dt(r.get("transit_timestamp")),
        transit_mode=r.get("transit_mode"),
        station_complex_id=r.get("station_complex_id"),
        station_complex=r.get("station_complex"),
        borough=r.get("borough"),
        payment_method=r.get("payment_method"),
        fare_class_category=r.get("fare_class_category"),
        ridership=float(r["ridership"]) if r.get("ridership") else None,
        transfers=float(r["transfers"]) if r.get("transfers") else None,
        latitude=float(r["latitude"]) if r.get("latitude") else None,
        longitude=float(r["longitude"]) if r.get("longitude") else None,
    )


def import_mta(db):
    print("\n── MTA Subway Hourly Ridership (Manhattan) ──")
    last_updated = datetime.now(timezone.utc)
    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_mta_page(offset)
        if not rows:
            break
        tuples = [
            (
                parse_dt(r.get("transit_timestamp")),
                r.get("transit_mode"),
                r.get("station_complex_id"),
                r.get("station_complex"),
                r.get("borough"),
                r.get("payment_method"),
                r.get("fare_class_category"),
                float(r["ridership"]) if r.get("ridership") else None,
                float(r["transfers"]) if r.get("transfers") else None,
                float(r["latitude"]) if r.get("latitude") else None,
                float(r["longitude"]) if r.get("longitude") else None,
                last_updated,
            ) for r in rows
        ]
        conn = db.connection().connection
        cur = conn.cursor()
        execute_values(cur, """
            INSERT INTO mta_ridership
              (transit_timestamp, transit_mode, station_complex_id, station_complex,
               borough, payment_method, fare_class_category,
               ridership, transfers, latitude, longitude, last_updated)
            VALUES %s
            ON CONFLICT ON CONSTRAINT uq_mta_ridership DO NOTHING
        """, tuples, page_size=5000)
        conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    print(f"MTA done: {total} rows imported.")


# ── 311 ───────────────────────────────────────────────────────────────────────

def fetch_311_page(offset: int) -> list[dict]:
    params = {
        "$where": "borough='MANHATTAN'",
        "$limit": PAGE_SIZE,
        "$offset": offset,
        "$order": "created_date ASC",
    }
    return fetch_with_retry(NYC_311_URL, params)


def row_to_311(r: dict, last_updated=None) -> NycNoise:
    return NycNoise(
        unique_key=r["unique_key"],
        created_date=parse_dt(r.get("created_date")),
        closed_date=parse_dt(r.get("closed_date")),
        agency=r.get("agency"),
        complaint_type=r.get("complaint_type"),
        descriptor=r.get("descriptor"),
        location_type=r.get("location_type"),
        incident_zip=r.get("incident_zip"),
        incident_address=r.get("incident_address"),
        street_name=r.get("street_name"),
        borough=r.get("borough"),
        latitude=float(r["latitude"]) if r.get("latitude") else None,
        longitude=float(r["longitude"]) if r.get("longitude") else None,
        status=r.get("status"),
        last_updated=last_updated,
    )


def import_311(db):
    print("\n── NYC 311 Noise Complaints (Manhattan) ──")
    last_updated = datetime.now(timezone.utc)
    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_311_page(offset)
        if not rows:
            break
        for r in rows:
            obj = row_to_311(r, last_updated)
            db.merge(obj)
        db.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    print(f"311 done: {total} rows imported.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mta-only", action="store_true")
    ap.add_argument("--311-only", action="store_true")
    args = ap.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not args.__dict__["311_only"]:
            import_mta(db)
        if not args.mta_only:
            import_311(db)
    finally:
        db.close()

    print("\nAll done.")


if __name__ == "__main__":
    main()
