from typing import Any, Optional
from pydantic import BaseModel


class VenueSummary(BaseModel):
    id: str
    placeId: str
    name: str
    address: str
    type: str
    lat: float
    lng: float
    quietScore: int
    displayRating: float
    rankingScore: float
    mentionCount: int
    uniqueSources: int
    businessStatus: str
    crowdedness: Optional[str] = None  # 'low' | 'medium' | 'high' | null
    # Raw OSM `opening_hours` tag, e.g. "Mo-Fr 07:00-19:00; Sa-Su 08:00-19:00".
    # Present for 163 of 326 venues; null means hours unknown, not closed.
    # Powers the "Open now" filter without depending on Google Places.
    hours: Optional[str] = None
    # OSM `wheelchair` tag: 'yes' | 'limited' | 'no' | None. Present for 80 of
    # 326 venues. None means nobody surveyed it, NOT that access is absent.
    # Sourced from OSM rather than Google Places: Google's equivalent field has
    # ~90% coverage but disagreed with OSM on 9 of 16 surveyed-negative venues,
    # always permissively, which is the harmful direction for this attribute.
    wheelchair: Optional[str] = None

    model_config = {"from_attributes": True}


class AttributeScore(BaseModel):
    positive: int
    neutral: int
    negative: int
    n: int
    net: int
    note: Optional[str]


class Quote(BaseModel):
    quote: str
    publication: Optional[str]
    source_url: Optional[str]


class VenueDetail(VenueSummary):
    # `hours` is inherited from VenueSummary.
    attributeScores: dict[str, AttributeScore]
    representativeQuotes: list[Quote]
    osm: Optional[dict[str, Any]]
    accessibilityManual: Optional[dict[str, Any]]


class VenueListResponse(BaseModel):
    items: list[VenueSummary]
    total: int
    limit: int
    offset: int
