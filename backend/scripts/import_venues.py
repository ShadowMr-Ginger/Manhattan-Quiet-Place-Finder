"""
Import canonical_venues_osm.jsonl into the SQLite database.

Usage (from backend/ directory):
    python -m scripts.import_venues
"""
import json
import sys
from pathlib import Path

# Allow running from backend/ or project root
sys.path.append(str(Path(__file__).parent.parent))

from app.database import engine, SessionLocal, Base
from app.models import Venue

JSONL_PATH = Path(__file__).parent.parent / (
    "editorial/enrichment/outputs/canonical_venues_osm.jsonl"
)


def derive_type(google_types: list[str]) -> str:
    """Map Google place types to a simplified venue type."""
    if "library" in google_types:
        return "library"
    if "cafe" in google_types or "coffee_shop" in google_types:
        return "cafe"
    if "restaurant" in google_types:
        return "restaurant"
    if "bar" in google_types:
        return "bar"
    if "hotel" in google_types or "lodging" in google_types:
        return "hotel"
    return "other"


def derive_quiet_score(endorsement_score: float) -> int:
    """Convert endorsement_score (-1..1) to quiet score (0..100)."""
    return round(((endorsement_score + 1) / 2) * 100)


def derive_display_rating(endorsement_score: float) -> float:
    """Convert endorsement_score (-1..1) to display rating (0..5)."""
    return round(((endorsement_score + 1) / 2) * 5, 1)


def main():
    if not JSONL_PATH.exists():
        sys.exit(f"JSONL file not found: {JSONL_PATH}")

    # Create tables
    Base.metadata.create_all(bind=engine)

    with open(JSONL_PATH, encoding="utf-8") as f:
        raw = [json.loads(line) for line in f if line.strip()]

    db = SessionLocal()
    try:
        inserted = updated = 0
        for row in raw:
            endorsement = row.get("endorsement_score", 0.0) or 0.0
            google_types = row.get("google_types") or []

            existing = db.query(Venue).filter(
                Venue.canonical_id == row["canonical_id"]
            ).first()

            data = dict(
                canonical_id=row["canonical_id"],
                place_id=row.get("place_id"),
                canonical_name=row.get("canonical_name"),
                formatted_address=row.get("formatted_address"),
                lat=row.get("lat"),
                lng=row.get("lng"),
                google_types=google_types,
                business_status=row.get("business_status", "OPERATIONAL"),
                mention_count=row.get("mention_count", 0),
                unique_sources=row.get("unique_sources", 0),
                member_strings=row.get("member_strings", []),
                endorsement_score=endorsement,
                ranking_score=row.get("ranking_score"),
                attribute_scores=row.get("attribute_scores", {}),
                representative_quotes=row.get("representative_quotes", []),
                needs_review=row.get("needs_review", False),
                osm=row.get("osm"),
                accessibility_manual=row.get("accessibility_manual"),
                # Derived
                venue_type=derive_type(google_types),
                quiet_score=derive_quiet_score(endorsement),
                display_rating=derive_display_rating(endorsement),
            )

            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(Venue(**data))
                inserted += 1

        db.commit()
        print(f"Done. Inserted: {inserted}, Updated: {updated}, Total: {len(raw)}")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    main()
