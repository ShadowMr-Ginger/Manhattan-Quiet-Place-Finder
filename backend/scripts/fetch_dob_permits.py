"""
Import NYC DOB NOW Build Approved Permits — Manhattan only.

First-time full import:
    python -m scripts.fetch_dob_permits

Incremental update (new permits since last sync):
    python -m scripts.fetch_dob_permits --incremental
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

DOB_URL = "https://data.cityofnewyork.us/resource/rbx6-tga4.json"
PAGE_SIZE = 50000

UPSERT_SQL = """
    INSERT INTO dob_permits (
        work_permit, job_filing_number, sequence_number, filing_reason,
        house_no, street_name, borough, bin, block, lot,
        work_on_floor, work_type, job_description, estimated_job_costs,
        permit_status, approved_date, issued_date, expired_date,
        zip_code, latitude, longitude, tracking_number,
        community_board, council_district, nta, last_updated
    ) VALUES %s
    ON CONFLICT (work_permit) DO UPDATE SET
        job_filing_number   = EXCLUDED.job_filing_number,
        sequence_number     = EXCLUDED.sequence_number,
        filing_reason       = EXCLUDED.filing_reason,
        permit_status       = EXCLUDED.permit_status,
        approved_date       = EXCLUDED.approved_date,
        issued_date         = EXCLUDED.issued_date,
        expired_date        = EXCLUDED.expired_date,
        estimated_job_costs = EXCLUDED.estimated_job_costs,
        work_type           = EXCLUDED.work_type,
        job_description     = EXCLUDED.job_description,
        last_updated          = EXCLUDED.last_updated
"""


def parse_dt(val):
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def row_to_tuple(r: dict, last_updated: datetime) -> tuple:
    return (
        r.get("work_permit"),
        r.get("job_filing_number"),
        r.get("sequence_number"),
        r.get("filing_reason"),
        r.get("house_no"),
        r.get("street_name"),
        r.get("borough"),
        r.get("bin"),
        r.get("block"),
        r.get("lot"),
        r.get("work_on_floor"),
        r.get("work_type"),
        r.get("job_description"),
        float(r["estimated_job_costs"]) if r.get("estimated_job_costs") else None,
        r.get("permit_status"),
        parse_dt(r.get("approved_date")),
        parse_dt(r.get("issued_date")),
        parse_dt(r.get("expired_date")),
        r.get("zip_code"),
        float(r["latitude"]) if r.get("latitude") else None,
        float(r["longitude"]) if r.get("longitude") else None,
        r.get("tracking_number"),
        r.get("community_board"),
        r.get("council_district"),
        r.get("nta"),
        last_updated,
    )


def fetch_page(offset: int, where_clause: str) -> list[dict]:
    params = {
        "$where": where_clause,
        "$limit": PAGE_SIZE,
        "$offset": offset,
        "$order": "approved_date ASC",
    }
    for attempt in range(1, 6):
        try:
            resp = requests.get(DOB_URL, params=params, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            wait = 10 * attempt
            print(f"\n  [retry {attempt}/5] {e} — waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError("Failed after 5 retries")


def get_last_fetched(db) -> datetime | None:
    """Return the most recent last_updated from dob_permits, used for incremental updates."""
    from sqlalchemy import text
    result = db.execute(text("SELECT MAX(last_updated) FROM dob_permits")).scalar()
    return result


def import_dob(db, incremental: bool = False):
    if incremental:
        last = get_last_fetched(db)
        if last:
            since_str = last.strftime("%Y-%m-%dT%H:%M:%S")
            where = f"borough='MANHATTAN' AND approved_date > '{since_str}'"
            print(f"\n── DOB Permits incremental update (since {last}) ──")
        else:
            where = "borough='MANHATTAN'"
            print("\n── DOB Permits full import (no previous fetch found) ──")
    else:
        where = "borough='MANHATTAN'"
        print("\n── DOB Permits full import (Manhattan) ──")

    raw_conn = db.connection().connection
    cur = raw_conn.cursor()
    last_updated = datetime.now(timezone.utc)

    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_page(offset, where)
        if not rows:
            print("no new rows.")
            break
        seen = {}
        for r in rows:
            if r.get("work_permit"):
                seen[r["work_permit"]] = row_to_tuple(r, last_updated)
        tuples = list(seen.values())
        execute_values(cur, UPSERT_SQL, tuples, page_size=1000)
        raw_conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)

    print(f"DOB Permits done: {total} rows imported.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--incremental", action="store_true",
                    help="Only fetch permits newer than last sync")
    args = ap.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        import_dob(db, incremental=args.incremental)
    finally:
        db.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
