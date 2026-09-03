"""
Import NYC Permitted Event Information — Manhattan only.

First-time full import:
    python -m scripts.fetch_permitted_events

Incremental update:
    python -m scripts.fetch_permitted_events --incremental
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

EVENTS_URL = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json"
PAGE_SIZE = 50000

UPSERT_SQL = """
    INSERT INTO nyc_permitted_events (
        event_id, event_name, start_date_time, end_date_time,
        event_agency, event_type, event_borough, event_location,
        street_closure_type, community_board, police_precinct, last_updated
    ) VALUES %s
    ON CONFLICT (event_id) DO UPDATE SET
        event_name          = EXCLUDED.event_name,
        start_date_time     = EXCLUDED.start_date_time,
        end_date_time       = EXCLUDED.end_date_time,
        event_agency        = EXCLUDED.event_agency,
        event_type          = EXCLUDED.event_type,
        event_location      = EXCLUDED.event_location,
        street_closure_type = EXCLUDED.street_closure_type,
        community_board     = EXCLUDED.community_board,
        police_precinct     = EXCLUDED.police_precinct,
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
        r.get("event_id"),
        r.get("event_name"),
        parse_dt(r.get("start_date_time")),
        parse_dt(r.get("end_date_time")),
        r.get("event_agency"),
        r.get("event_type"),
        r.get("event_borough"),
        r.get("event_location"),
        r.get("street_closure_type"),
        r.get("community_board"),
        r.get("police_precinct"),
        last_updated,
    )


def fetch_page(offset: int, where_clause: str) -> list[dict]:
    params = {
        "$where": where_clause,
        "$limit": PAGE_SIZE,
        "$offset": offset,
        "$order": "start_date_time ASC",
    }
    for attempt in range(1, 6):
        try:
            resp = requests.get(EVENTS_URL, params=params, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            wait = 10 * attempt
            print(f"\n  [retry {attempt}/5] {e} — waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError("Failed after 5 retries")


def get_last_fetched(db) -> datetime | None:
    from sqlalchemy import text
    return db.execute(text("SELECT MAX(last_updated) FROM nyc_permitted_events")).scalar()


def import_events(db, incremental: bool = False):
    if incremental:
        last = get_last_fetched(db)
        if last:
            since_str = last.strftime("%Y-%m-%dT%H:%M:%S")
            where = f"event_borough='Manhattan' AND start_date_time > '{since_str}'"
            print(f"\n── NYC Events incremental update (since {last}) ──")
        else:
            where = "event_borough='Manhattan'"
            print("\n── NYC Events full import (no previous fetch found) ──")
    else:
        where = "event_borough='Manhattan'"
        print("\n── NYC Permitted Events full import (Manhattan) ──")

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
            if r.get("event_id"):
                seen[r["event_id"]] = row_to_tuple(r, last_updated)
        tuples = list(seen.values())
        execute_values(cur, UPSERT_SQL, tuples, page_size=1000)
        raw_conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)

    print(f"NYC Events done: {total} rows imported.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--incremental", action="store_true",
                    help="Only fetch events newer than last sync")
    args = ap.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        import_events(db, incremental=args.incremental)
    finally:
        db.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
