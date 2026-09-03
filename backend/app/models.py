import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, JSON, ForeignKey, DateTime, Text, UniqueConstraint, BigInteger
from .database import Base


def new_id():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class Venue(Base):
    __tablename__ = "venues"

    canonical_id = Column(String, primary_key=True, index=True)
    place_id = Column(String, unique=True, index=True)
    canonical_name = Column(String, nullable=False)
    formatted_address = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    google_types = Column(JSON)
    business_status = Column(String)
    mention_count = Column(Integer, default=0)
    unique_sources = Column(Integer, default=0)
    member_strings = Column(JSON)
    endorsement_score = Column(Float)
    ranking_score = Column(Float)
    attribute_scores = Column(JSON)
    representative_quotes = Column(JSON)
    needs_review = Column(Boolean, default=False)
    osm = Column(JSON, nullable=True)
    accessibility_manual = Column(JSON, nullable=True)

    # Derived fields (computed at import time for fast querying)
    venue_type = Column(String, index=True)
    quiet_score = Column(Integer, index=True)
    display_rating = Column(Float)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), default=now)


class PasswordResetToken(Base):
    """Single-use password reset tokens (1-hour expiry)."""
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True)  # sha256 of the raw token
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, nullable=False, default=False)


class UserFavorite(Base):
    __tablename__ = "user_favorites"
    __table_args__ = (UniqueConstraint("user_id", "venue_id"),)

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    venue_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class UserSaved(Base):
    __tablename__ = "user_saved"
    __table_args__ = (UniqueConstraint("user_id", "venue_id"),)

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    venue_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class UserRecent(Base):
    __tablename__ = "user_recent"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    venue_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime(timezone=True), default=now)


class Review(Base):
    __tablename__ = "reviews"

    id = Column(String, primary_key=True, default=new_id)
    venue_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class ChatMessage(Base):
    """Persisted chat history per user."""
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)   # 'user' | 'assistant'
    text = Column(Text, nullable=False)
    venues = Column(JSON, nullable=True)    # venue list attached to assistant messages
    created_at = Column(DateTime(timezone=True), default=now)


class MtaRidership(Base):
    """MTA Subway Hourly Ridership — Manhattan only."""
    __tablename__ = "mta_ridership"
    __table_args__ = (
        UniqueConstraint("transit_timestamp", "station_complex_id", "payment_method", "fare_class_category",
                         name="uq_mta_ridership"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    transit_timestamp = Column(DateTime(timezone=False), nullable=False, index=True)
    transit_mode = Column(String)
    station_complex_id = Column(String, index=True)
    station_complex = Column(String)
    borough = Column(String)
    payment_method = Column(String)
    fare_class_category = Column(String)
    ridership = Column(Float)
    transfers = Column(Float)
    latitude = Column(Float)
    longitude = Column(Float)
    last_updated = Column(DateTime(timezone=True), nullable=True)


class NycNoise(Base):
    """NYC 311 Noise Complaints — Manhattan only."""
    __tablename__ = "nyc_noise"

    unique_key = Column(String, primary_key=True)
    created_date = Column(DateTime(timezone=False), nullable=False, index=True)
    closed_date = Column(DateTime(timezone=False), nullable=True)
    agency = Column(String)
    complaint_type = Column(String, index=True)
    descriptor = Column(String)
    location_type = Column(String)
    incident_zip = Column(String)
    incident_address = Column(String)
    street_name = Column(String)
    borough = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String)
    last_updated = Column(DateTime(timezone=True), nullable=True)


class DobPermit(Base):
    """NYC DOB NOW Build Approved Permits — Manhattan only."""
    __tablename__ = "dob_permits"

    work_permit = Column(String, primary_key=True)
    job_filing_number = Column(String, index=True)
    sequence_number = Column(String)
    filing_reason = Column(String)
    house_no = Column(String)
    street_name = Column(String)
    borough = Column(String)
    bin = Column(String)
    block = Column(String)
    lot = Column(String)
    work_on_floor = Column(String)
    work_type = Column(String, index=True)
    job_description = Column(Text)
    estimated_job_costs = Column(Float)
    permit_status = Column(String, index=True)
    approved_date = Column(DateTime(timezone=False), nullable=True, index=True)
    issued_date = Column(DateTime(timezone=False), nullable=True)
    expired_date = Column(DateTime(timezone=False), nullable=True)
    zip_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    tracking_number = Column(String)
    community_board = Column(String)
    council_district = Column(String)
    nta = Column(String)
    last_updated = Column(DateTime(timezone=True), nullable=True)


class NycPermittedEvent(Base):
    """NYC Permitted Event Information — Manhattan only."""
    __tablename__ = "nyc_permitted_events"

    event_id = Column(String, primary_key=True)
    event_name = Column(String)
    start_date_time = Column(DateTime(timezone=False), nullable=True, index=True)
    end_date_time = Column(DateTime(timezone=False), nullable=True)
    event_agency = Column(String)
    event_type = Column(String, index=True)
    event_borough = Column(String)
    event_location = Column(String)
    street_closure_type = Column(String)
    community_board = Column(String)
    police_precinct = Column(String)
    last_updated = Column(DateTime(timezone=True), nullable=True)


class DataSyncLog(Base):
    """Tracks the last successful data sync for each dataset."""
    __tablename__ = "data_sync_log"

    source = Column(String, primary_key=True)   # 'mta' | '311' | 'dob'
    last_synced_at = Column(DateTime(timezone=True), nullable=False)
    rows_added = Column(Integer, default=0)


class VenueBusynessHourly(Base):
    """ML-derived busyness curve: per venue × day-of-week × hour."""
    __tablename__ = "venue_busyness_hourly"
    __table_args__ = (
        UniqueConstraint("canonical_id", "dow", "hour", name="uq_busyness_hourly"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    canonical_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"),
                          nullable=False, index=True)
    dow = Column(Integer, nullable=False)   # 0=Mon … 6=Sun
    hour = Column(Integer, nullable=False)  # 0–23
    busyness = Column(Float)
    busyness_pct = Column(Float)            # 0–100
    last_updated = Column(DateTime(timezone=True), nullable=True)


class VenueIndicators(Base):
    """Per-venue environmental noise + disruption indicators from ML pipeline."""
    __tablename__ = "venue_indicators"

    canonical_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"),
                          primary_key=True)
    # noise
    road_db = Column(Float)
    noise311_kde = Column(Float)
    noise311_within100m = Column(Float)
    # construction
    effective_sites = Column(Float)
    construction_sites_150m = Column(Integer)
    # events
    n_events_nearby = Column(Integer)
    nearest_event_m = Column(Float)
    # busyness meta
    nearest_station_m = Column(Float)
    n_stations_within = Column(Integer)
    peak_busyness = Column(Float)
    peak_busyness_pct = Column(Float)


class VenueCalmBar(Base):
    """Editorial noise + crowding sentiment counts (from review extraction)."""
    __tablename__ = "venue_calm_bar"

    canonical_id = Column(String, ForeignKey("venues.canonical_id", ondelete="CASCADE"),
                          primary_key=True)
    noise_pos = Column(Integer, default=0)
    noise_neu = Column(Integer, default=0)
    noise_neg = Column(Integer, default=0)
    noise_n   = Column(Integer, default=0)
    crowding_pos = Column(Integer, default=0)
    crowding_neu = Column(Integer, default=0)
    crowding_neg = Column(Integer, default=0)
    crowding_n   = Column(Integer, default=0)
    calm_pos = Column(Integer, default=0)
    calm_neu = Column(Integer, default=0)
    calm_neg = Column(Integer, default=0)
    calm_n   = Column(Integer, default=0)
    show_calm = Column(Boolean, default=False)
