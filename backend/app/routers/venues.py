import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from ..database import get_db
from ..models import Venue, VenueBusynessHourly
from ..schemas import VenueSummary, VenueDetail, VenueListResponse

router = APIRouter(prefix="/venues", tags=["venues"])

SORT_FIELDS = {
    "rankingScore": Venue.ranking_score,
    "quietScore": Venue.quiet_score,
    "mentionCount": Venue.mention_count,
}


def _crowdedness_from_busyness(pct: float | None) -> str | None:
    """Derive crowdedness from ML busyness percentage.
    Calibrated against observed data: peak avg ~18, peak max ~64.
    """
    if pct is None:
        return None
    if pct < 8:
        return "low"
    if pct < 25:
        return "medium"
    return "high"


def _crowdedness_from_scores(attribute_scores: dict | None) -> str | None:
    """Fallback: derive crowdedness from editorial attribute scores."""
    if not attribute_scores:
        return None
    crowding = attribute_scores.get("crowding", {})
    if not crowding or crowding.get("n", 0) < 2:
        return None
    net = crowding.get("net", 0)
    if net >= 1:
        return "low"
    if net <= -2:
        return "high"
    return "medium"


def _osm_tag(v: Venue, key: str) -> str | None:
    """Raw OSM tag value, or None when the venue has no OSM match."""
    if v.osm and isinstance(v.osm.get("tags"), dict):
        return v.osm["tags"].get(key)
    return None


def _osm_opening_hours(v: Venue) -> str | None:
    return _osm_tag(v, "opening_hours")


def _wheelchair_access(v: Venue) -> str | None:
    """Wheelchair access. Hand-verified `accessibility_manual` beats the OSM tag."""
    manual = v.accessibility_manual or {}
    if isinstance(manual, dict) and manual.get("wheelchair") in {"yes", "limited", "no"}:
        return manual["wheelchair"]
    tag = _osm_tag(v, "wheelchair")
    return tag if tag in {"yes", "limited", "no"} else None


def venue_to_summary(v: Venue, busyness_pct: float | None = None) -> VenueSummary:
    # Prefer ML busyness data; fall back to editorial crowding scores
    if busyness_pct is not None:
        crowdedness = _crowdedness_from_busyness(busyness_pct)
    else:
        crowdedness = _crowdedness_from_scores(v.attribute_scores)

    return VenueSummary(
        id=v.canonical_id,
        placeId=v.place_id,
        name=v.canonical_name,
        address=v.formatted_address or "",
        type=v.venue_type or "other",
        lat=v.lat or 0.0,
        lng=v.lng or 0.0,
        quietScore=v.quiet_score or 0,
        displayRating=v.display_rating or 0.0,
        rankingScore=v.ranking_score or 0.0,
        mentionCount=v.mention_count or 0,
        uniqueSources=v.unique_sources or 0,
        businessStatus=v.business_status or "OPERATIONAL",
        crowdedness=crowdedness,
        hours=_osm_opening_hours(v),
        wheelchair=_wheelchair_access(v),
    )


def venue_to_detail(v: Venue, busyness_pct: float | None = None) -> VenueDetail:
    # `hours` now comes through the summary, so it must not be passed again here.
    return VenueDetail(
        **venue_to_summary(v, busyness_pct).model_dump(),
        attributeScores=v.attribute_scores or {},
        representativeQuotes=v.representative_quotes or [],
        osm=v.osm,
        accessibilityManual=v.accessibility_manual,
    )


_NYC_TZ = ZoneInfo("America/New_York")


def _fetch_busyness_map(db: Session, venue_ids: list[str]) -> dict[str, float]:
    """Batch-fetch current-hour busyness_pct for a list of venue IDs.
    Uses NYC local time since venue busyness data is keyed to NYC timezone.
    """
    now = datetime.datetime.now(_NYC_TZ)
    rows = (
        db.query(VenueBusynessHourly)
        .filter(
            VenueBusynessHourly.canonical_id.in_(venue_ids),
            VenueBusynessHourly.dow == now.weekday(),
            VenueBusynessHourly.hour == now.hour,
        )
        .all()
    )
    return {r.canonical_id: r.busyness_pct for r in rows if r.busyness_pct is not None}


@router.get("", response_model=VenueListResponse)
def list_venues(
    q: Optional[str] = Query(None, description="Search name or address"),
    type: Optional[str] = Query(None, description="Comma-separated: cafe,library,restaurant,bar"),
    minQuiet: Optional[int] = Query(None, ge=0, le=100),
    bounds: Optional[str] = Query(None, description="swLat,swLng,neLat,neLng"),
    sort: str = Query("rankingScore", description="rankingScore|quietScore|mentionCount"),
    minMentions: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Venue)

    # Text search
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(
                Venue.canonical_name.ilike(term),
                Venue.formatted_address.ilike(term),
            )
        )

    # Type filter
    if type:
        types = [t.strip() for t in type.split(",")]
        query = query.filter(Venue.venue_type.in_(types))

    # Quiet score filter
    if minQuiet is not None:
        query = query.filter(Venue.quiet_score >= minQuiet)

    # Mention count filter
    query = query.filter(Venue.mention_count >= minMentions)

    # Map bounds filter
    if bounds:
        try:
            sw_lat, sw_lng, ne_lat, ne_lng = map(float, bounds.split(","))
            query = query.filter(
                and_(
                    Venue.lat >= sw_lat,
                    Venue.lat <= ne_lat,
                    Venue.lng >= sw_lng,
                    Venue.lng <= ne_lng,
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bounds format. Use: swLat,swLng,neLat,neLng")

    total = query.count()

    # Sorting
    sort_col = SORT_FIELDS.get(sort, Venue.ranking_score)
    query = query.order_by(sort_col.desc())

    venues = query.offset(offset).limit(limit).all()

    # Batch-fetch current-hour busyness for all venues in one query
    venue_ids = [v.canonical_id for v in venues]
    busyness_map = _fetch_busyness_map(db, venue_ids)

    return VenueListResponse(
        items=[venue_to_summary(v, busyness_map.get(v.canonical_id)) for v in venues],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{venue_id}", response_model=VenueDetail)
def get_venue(venue_id: str, db: Session = Depends(get_db)):
    venue = db.query(Venue).filter(Venue.canonical_id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Fetch current-hour busyness for this single venue
    busyness_map = _fetch_busyness_map(db, [venue_id])
    return venue_to_detail(venue, busyness_map.get(venue_id))
