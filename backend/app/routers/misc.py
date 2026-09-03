"""Prediction, live occupancy, chat, and ML quiet-profile endpoints."""
import datetime
import os
import re
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Venue, VenueBusynessHourly, VenueIndicators, VenueCalmBar, ChatMessage, User
from ..auth import get_current_user, get_optional_user

router = APIRouter(tags=["misc"])


# ── Quiet score prediction ─────────────────────────────────────────────────────

@router.get("/venues/{venue_id}/prediction")
def get_prediction(venue_id: str, db: Session = Depends(get_db)):
    """
    Returns predicted quiet scores for now, +1h, +2h, +3h (0-100).
    Static placeholder until the ML model is ready.
    """
    venue = db.query(Venue).filter(Venue.canonical_id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    base = venue.quiet_score or 50
    return {
        "now": base,
        "plus1": max(0, base - 5),
        "plus2": max(0, base - 12),
        "plus3": max(0, base - 18),
    }


# ── Live occupancy ─────────────────────────────────────────────────────────────

@router.get("/venues/{venue_id}/live")
def get_live(venue_id: str, db: Session = Depends(get_db)):
    """
    Returns live occupancy data.
    Returns null until a real-time data source is integrated.
    """
    venue = db.query(Venue).filter(Venue.canonical_id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Derive crowdedness from editorial crowding attribute as fallback
    crowding = (venue.attribute_scores or {}).get("crowding", {})
    net = crowding.get("net", 0)
    if crowding.get("n", 0) >= 2:
        crowdedness = "low" if net > 0 else ("high" if net < 0 else "medium")
    else:
        crowdedness = None

    return {"occupancy": None, "capacity": None, "crowdedness": crowdedness}


# ── Quiet profile (ML outputs) ────────────────────────────────────────────────

_BUSYNESS_LABELS = [
    (20, "Very Quiet"),
    (40, "Quiet"),
    (60, "Moderate"),
    (80, "Busy"),
    (101, "Very Busy"),
]


def _busyness_label(pct: float | None) -> str:
    if pct is None:
        return "Unknown"
    for threshold, label in _BUSYNESS_LABELS:
        if pct < threshold:
            return label
    return "Very Busy"


@router.get("/venues/{venue_id}/quiet-profile")
def get_quiet_profile(venue_id: str, db: Session = Depends(get_db)):
    """
    Returns ML-derived quiet profile for a venue:
    - busyness curve (today's hourly forecast)
    - noise indicators
    - construction activity
    - nearby events
    - calm-bar sentiment breakdown
    """
    venue = db.query(Venue).filter(Venue.canonical_id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # ── busyness ──────────────────────────────────────────────────────────────
    now = datetime.datetime.now()
    today_dow = now.weekday()   # 0=Mon … 6=Sun
    current_hour = now.hour

    hourly_rows = (
        db.query(VenueBusynessHourly)
        .filter(
            VenueBusynessHourly.canonical_id == venue_id,
            VenueBusynessHourly.dow == today_dow,
        )
        .order_by(VenueBusynessHourly.hour)
        .all()
    )

    today_curve = [
        {"hour": r.hour, "busyness_pct": round(r.busyness_pct, 1) if r.busyness_pct is not None else None}
        for r in hourly_rows
    ]

    current_row = next((r for r in hourly_rows if r.hour == current_hour), None)
    current_pct = current_row.busyness_pct if current_row else None

    ind = db.query(VenueIndicators).filter(VenueIndicators.canonical_id == venue_id).first()

    peak_pct = ind.peak_busyness_pct if ind else None
    # find the hour with the highest busyness_pct today
    peak_hour = None
    if hourly_rows:
        peak_row = max(hourly_rows, key=lambda r: r.busyness_pct or 0)
        peak_hour = peak_row.hour

    busyness = {
        "current_pct": round(current_pct, 1) if current_pct is not None else None,
        "now_label": _busyness_label(current_pct),
        "peak_pct": round(peak_pct, 1) if peak_pct is not None else None,
        "peak_hour": peak_hour,
        "today_curve": today_curve,
    }

    # ── indicators ────────────────────────────────────────────────────────────
    if ind:
        noise = {
            "road_db": round(ind.road_db, 1) if ind.road_db is not None else None,
            "complaints_per_year": round(ind.noise311_kde, 1) if ind.noise311_kde is not None else None,
            "complaints_within_100m": int(ind.noise311_within100m) if ind.noise311_within100m is not None else None,
        }
        construction = {
            "effective_sites": round(ind.effective_sites, 1) if ind.effective_sites is not None else None,
            "sites_within_150m": ind.construction_sites_150m,
        }
        events = {
            "n_nearby": ind.n_events_nearby,
            "nearest_m": round(ind.nearest_event_m, 0) if ind.nearest_event_m is not None else None,
        }
        transit = {
            "nearest_station_m": round(ind.nearest_station_m, 0) if ind.nearest_station_m is not None else None,
            "n_stations_within": ind.n_stations_within,
        }
    else:
        noise = construction = events = transit = None

    # ── calm bar ──────────────────────────────────────────────────────────────
    cb = db.query(VenueCalmBar).filter(VenueCalmBar.canonical_id == venue_id).first()
    if cb:
        calm_bar = {
            "show": cb.show_calm,
            "noise": {"pos": cb.noise_pos, "neu": cb.noise_neu, "neg": cb.noise_neg, "n": cb.noise_n},
            "crowding": {"pos": cb.crowding_pos, "neu": cb.crowding_neu, "neg": cb.crowding_neg, "n": cb.crowding_n},
            "calm": {"pos": cb.calm_pos, "neu": cb.calm_neu, "neg": cb.calm_neg, "n": cb.calm_n},
        }
    else:
        calm_bar = None

    return {
        "busyness": busyness,
        "noise": noise,
        "construction": construction,
        "events": events,
        "transit": transit,
        "calm_bar": calm_bar,
    }


# ── Chat ───────────────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    role: str   # 'user' | 'assistant'
    text: str


class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    history: list[HistoryItem] = []


def _parse_constraints(msg: str) -> dict:
    """Extract numeric constraints from a natural language message."""
    c = {}
    m = msg.lower()

    # Explicit quiet score (0-100 scale, must say "quiet score")
    for pat, key in [
        (r'quiet\s*score\s*(?:below|under|less\s*than)\s*(\d+)', 'max_quiet'),
        (r'quiet\s*score\s*(?:above|over|more\s*than|at\s*least)\s*(\d+)', 'min_quiet'),
        (r'(?:安静指数|安静分数)[^\d]*(\d+)以下', 'max_quiet'),
        (r'(?:安静指数|安静分数)[^\d]*(\d+)以上', 'min_quiet'),
    ]:
        match = re.search(pat, m)
        if match:
            c[key] = int(match.group(1))

    # Rating or ambiguous "score X" — smart dispatch based on value range
    for pat, direction in [
        (r'(?:review|rating|评分|stars?)\s*(?:above|over|more\s*than|at\s*least|高于|超过)\s*(\d+(?:\.\d+)?)', 'min'),
        (r'(?:review|rating|评分|stars?)\s*(?:below|under|less\s*than|低于)\s*(\d+(?:\.\d+)?)', 'max'),
        # bare "score above X" / "score below X" — if value ≤ 5 treat as rating, else quiet score
        (r'\bscore\s*(?:above|over|more\s*than|at\s*least)\s*(\d+(?:\.\d+)?)', 'score_min'),
        (r'\bscore\s*(?:below|under|less\s*than)\s*(\d+(?:\.\d+)?)', 'score_max'),
        (r'评分\s*(?:above|over|高于|超过)\s*(\d+(?:\.\d+)?)', 'score_min'),
        (r'评分\s*(?:below|under|低于)\s*(\d+(?:\.\d+)?)', 'score_max'),
    ]:
        match = re.search(pat, m)
        if not match:
            continue
        val = float(match.group(1))
        if direction == 'min':
            c['min_rating'] = val
        elif direction == 'max':
            c['max_rating'] = val
        elif direction == 'score_min':
            # value ≤ 5 → almost certainly a star/rating scale
            if val <= 5:
                c.setdefault('min_rating', val)
            else:
                c.setdefault('min_quiet', int(val))
        elif direction == 'score_max':
            if val <= 5:
                c.setdefault('max_rating', val)
            else:
                c.setdefault('max_quiet', int(val))

    return c


VENUE_INTENT_KEYWORDS = [
    # English
    "quiet", "place", "spot", "venue", "find", "recommend", "suggest",
    "where", "cafe", "café", "coffee", "library", "restaurant", "eat",
    "food", "bar", "study", "work", "relax", "sit", "go", "nearby",
    # Chinese
    "安静", "地方", "场所", "推荐", "哪里", "咖啡", "图书馆", "餐厅",
    "酒吧", "学习", "工作", "休息", "去哪", "附近",
]


def _is_venue_query(message: str) -> bool:
    """Return True only if the message seems to be about finding venues."""
    m = message.lower()
    for kw in VENUE_INTENT_KEYWORDS:
        if kw.isascii():
            # Use word boundaries so e.g. "eat" doesn't match "weather"
            if re.search(r'\b' + re.escape(kw) + r'\b', m):
                return True
        else:
            # Chinese keywords have no ASCII word boundaries — substring match is fine
            if kw in m:
                return True
    return False


def _search_venues(message: str, db: Session) -> list[dict]:
    """
    Search venues based on type keywords and parsed constraints.
    Returns empty list if the message is not venue-related.
    Randomises results when only type is specified so repeated queries vary.
    """
    if not _is_venue_query(message):
        return []

    TYPE_KEYWORDS = {
        "cafe": ["cafe", "café", "coffee", "咖啡"],
        "library": ["library", "图书馆", "书"],
        "restaurant": ["restaurant", "eat", "food", "餐厅", "吃"],
        "bar": ["bar", "酒吧"],
    }

    msg_lower = message.lower()
    constraints = _parse_constraints(msg_lower)
    matched_types = [t for t, kws in TYPE_KEYWORDS.items() if any(k in msg_lower for k in kws)]

    query = db.query(Venue)

    # Type filter
    if matched_types:
        query = query.filter(Venue.venue_type.in_(matched_types))

    # Quiet score constraints
    if 'min_quiet' in constraints:
        query = query.filter(Venue.quiet_score >= constraints['min_quiet'])
    if 'max_quiet' in constraints:
        query = query.filter(Venue.quiet_score <= constraints['max_quiet'])

    # Rating constraints
    if 'min_rating' in constraints:
        query = query.filter(Venue.display_rating >= constraints['min_rating'])
    if 'max_rating' in constraints:
        query = query.filter(Venue.display_rating <= constraints['max_rating'])

    # Only sort deterministically when score/rating constraints are present.
    # For type-only queries, randomise so repeated questions give varied results.
    if constraints:
        venues = query.order_by(Venue.quiet_score.desc()).limit(20).all()
    else:
        venues = query.order_by(func.random()).limit(20).all()

    if not venues:
        venues = db.query(Venue).order_by(func.random()).limit(15).all()

    return [
        {
            "id": v.canonical_id,
            "name": v.canonical_name,
            "type": v.venue_type or "other",
            "quietScore": v.quiet_score or 0,
            "displayRating": v.display_rating,
            "address": v.formatted_address or "",
        }
        for v in venues
    ]


@router.get("/chat/history")
def get_chat_history(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's chat history, oldest first."""
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return {
        "messages": [
            {"role": m.role, "text": m.text, "venues": m.venues or []}
            for m in rows
        ]
    }


@router.post("/chat")
def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chat assistant powered by Qianwen (通义千问). Requires authentication.
    Saves every exchange to chat_messages and uses history for context.
    """
    if not os.getenv("DASHSCOPE_API_KEY"):
        raise HTTPException(status_code=503, detail="Chat assistant is not configured.")

    from ..services.chat_service import chat as qianwen_chat

    WEATHER_KEYWORDS = [
        "weather", "temperature", "temp", "rain", "sunny", "cloudy", "forecast",
        "hot", "cold", "humid", "wind", "storm", "snow",
        "天气", "温度", "下雨", "晴", "阴", "预报", "热", "冷", "风",
    ]

    def _is_weather_query(msg: str) -> bool:
        m = msg.lower()
        return any(kw in m for kw in WEATHER_KEYWORDS)

    try:
        from ..routers.weather import _cache as weather_cache
        venues = _search_venues(body.message, db)
        top_venues = venues[:5]  # only pass the same 5 venues shown as chips
        history = [{"role": h.role, "text": h.text} for h in body.history]
        weather = weather_cache if _is_weather_query(body.message) else None
        reply = qianwen_chat(body.message, top_venues, body.language, history, weather)

        # Persist both sides of the exchange
        db.add(ChatMessage(user_id=current_user.id, role="user", text=body.message))
        db.add(ChatMessage(
            user_id=current_user.id,
            role="assistant",
            text=reply,
            venues=venues[:5],
        ))
        db.commit()

        return {"reply": reply, "venues": venues[:5]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat service error: {str(e)}")
