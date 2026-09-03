"""
Incremental data update:
  - MTA:    weekly  — fetches rows since last sync
  - 311:    daily   — fetches rows since last sync
  - DOB:    weekly  — fetches permits since last sync
  - Events: daily   — fetches events since last sync

Usage (from backend/ directory):
    python -m scripts.update_data --mta
    python -m scripts.update_data --311
    python -m scripts.update_data --dob
    python -m scripts.update_data --events
    python -m scripts.update_data --mta --311 --dob --events
"""
import argparse
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

sys.path.append(str(Path(__file__).parent.parent))

from app.database import engine, SessionLocal, Base
from app.models import MtaRidership, NycNoise, DobPermit, NycPermittedEvent
from psycopg2.extras import execute_values
from scripts.fetch_historical_data import (
    fetch_mta_page, row_to_mta,
    fetch_311_page, row_to_311,
    PAGE_SIZE, parse_dt,
)
from scripts.fetch_dob_permits import row_to_tuple as row_to_dob, fetch_page as fetch_dob_page, UPSERT_SQL as DOB_UPSERT
from scripts.fetch_permitted_events import row_to_tuple as row_to_event, fetch_page as fetch_events_page, UPSERT_SQL as EVENTS_UPSERT

MTA_URL = "https://data.ny.gov/resource/5wq4-mkjj.json"
NYC_311_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
DOB_URL = "https://data.cityofnewyork.us/resource/rbx6-tga4.json"
EVENTS_URL = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json"

# MTA last updated June 17, 2026
MTA_LAST_UPDATE = datetime(2026, 6, 17, tzinfo=timezone.utc)


# ── helpers ────────────────────────────────────────────────────────────────

def fetch_page(url: str, where: str, order: str, offset: int) -> list[dict]:
    params = {
        "$where": where,
        "$limit": PAGE_SIZE,
        "$offset": offset,
        "$order": order,
    }
    for attempt in range(1, 6):
        try:
            resp = requests.get(url, params=params, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            wait = 10 * attempt
            print(f"\n  [retry {attempt}/5] {e} — waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Failed after 5 retries: {url}")


# ── MTA ────────────────────────────────────────────────────────────────────

def get_mta_since(db) -> datetime:
    result = db.query(MtaRidership.transit_timestamp).order_by(
        MtaRidership.transit_timestamp.desc()
    ).first()
    return result[0] if result else MTA_LAST_UPDATE


def update_mta(db):
    since = get_mta_since(db)
    since_str = since.strftime("%Y-%m-%dT%H:%M:%S")
    print(f"\n── MTA update (since {since}) ──")
    last_updated = datetime.now(timezone.utc)
    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_page(
            MTA_URL,
            f"borough='Manhattan' AND transit_timestamp > '{since_str}'",
            "transit_timestamp ASC",
            offset,
        )
        if not rows:
            print("no new rows.")
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
    print(f"MTA update done: {total} new rows.")


# ── 311 ────────────────────────────────────────────────────────────────────

def get_311_since(db) -> datetime:
    result = db.query(NycNoise.created_date).order_by(
        NycNoise.created_date.desc()
    ).first()
    return result[0] if result else datetime.now(timezone.utc) - timedelta(days=1)


def get_311_last_sync(db) -> datetime:
    """Last time we ran the 311 update — used to catch recently closed complaints."""
    from sqlalchemy import text
    result = db.execute(text("SELECT MAX(last_updated) FROM nyc_noise")).scalar()
    return result if result else datetime.now(timezone.utc) - timedelta(days=1)


NYC_311_UPSERT = """
    INSERT INTO nyc_noise (
        unique_key, created_date, closed_date, agency, complaint_type,
        descriptor, location_type, incident_zip, incident_address,
        street_name, borough, latitude, longitude, status, last_updated
    ) VALUES %s
    ON CONFLICT (unique_key) DO UPDATE SET
        closed_date    = EXCLUDED.closed_date,
        status         = EXCLUDED.status,
        last_updated   = EXCLUDED.last_updated
"""


def _fetch_and_upsert_311(db, where: str, label: str) -> int:
    last_updated = datetime.now(timezone.utc)
    raw_conn = db.connection().connection
    cur = raw_conn.cursor()
    total = 0
    offset = 0
    while True:
        print(f"  [{label}] Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_page(NYC_311_URL, where, "created_date ASC", offset)
        if not rows:
            print("no rows.")
            break
        tuples = [
            (
                r.get("unique_key"),
                parse_dt(r.get("created_date")),
                parse_dt(r.get("closed_date")),
                r.get("agency"),
                r.get("complaint_type"),
                r.get("descriptor"),
                r.get("location_type"),
                r.get("incident_zip"),
                r.get("incident_address"),
                r.get("street_name"),
                r.get("borough"),
                float(r["latitude"]) if r.get("latitude") else None,
                float(r["longitude"]) if r.get("longitude") else None,
                r.get("status"),
                last_updated,
            ) for r in rows if r.get("unique_key")
        ]
        execute_values(cur, NYC_311_UPSERT, tuples, page_size=2000)
        raw_conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    return total


def update_311(db):
    since_created = get_311_since(db)
    since_closed  = get_311_last_sync(db)
    created_str = since_created.strftime("%Y-%m-%dT%H:%M:%S")
    closed_str  = since_closed.strftime("%Y-%m-%dT%H:%M:%S")

    print(f"\n── 311 update ──")
    print(f"  new complaints since:    {since_created}")
    print(f"  status updates since:    {since_closed}")

    # 1. new complaints
    n1 = _fetch_and_upsert_311(
        db,
        f"borough='MANHATTAN' AND created_date > '{created_str}'",
        "new",
    )
    # 2. existing complaints that got closed/updated since last sync
    n2 = _fetch_and_upsert_311(
        db,
        f"borough='MANHATTAN' AND closed_date > '{closed_str}'",
        "closed",
    )
    print(f"311 update done: {n1} new + {n2} status-updated rows.")


# ── DOB Permits ────────────────────────────────────────────────────────────

def update_dob(db):
    from sqlalchemy import text
    last = db.execute(text("SELECT MAX(last_updated) FROM dob_permits")).scalar()
    if last:
        since_str = last.strftime("%Y-%m-%dT%H:%M:%S")
        where = f"borough='MANHATTAN' AND approved_date > '{since_str}'"
        print(f"\n── DOB Permits update (since {last}) ──")
    else:
        where = "borough='MANHATTAN'"
        print("\n── DOB Permits full import (no previous fetch) ──")

    raw_conn = db.connection().connection
    cur = raw_conn.cursor()
    last_updated = datetime.now(timezone.utc)
    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_dob_page(offset, where)
        if not rows:
            print("no new rows.")
            break
        seen = {r["work_permit"]: row_to_dob(r, last_updated) for r in rows if r.get("work_permit")}
        execute_values(cur, DOB_UPSERT, list(seen.values()), page_size=1000)
        raw_conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    print(f"DOB Permits update done: {total} rows.")


# ── NYC Permitted Events ────────────────────────────────────────────────────

def update_events(db):
    from sqlalchemy import text
    last = db.execute(text("SELECT MAX(last_updated) FROM nyc_permitted_events")).scalar()
    if last:
        since_str = last.strftime("%Y-%m-%dT%H:%M:%S")
        where = f"event_borough='Manhattan' AND start_date_time > '{since_str}'"
        print(f"\n── NYC Events update (since {last}) ──")
    else:
        where = "event_borough='Manhattan'"
        print("\n── NYC Events full import (no previous fetch) ──")

    raw_conn = db.connection().connection
    cur = raw_conn.cursor()
    last_updated = datetime.now(timezone.utc)
    total = 0
    offset = 0
    while True:
        print(f"  Fetching offset={offset} ...", end=" ", flush=True)
        rows = fetch_events_page(offset, where)
        if not rows:
            print("no new rows.")
            break
        seen = {r["event_id"]: row_to_event(r, last_updated) for r in rows if r.get("event_id")}
        execute_values(cur, EVENTS_UPSERT, list(seen.values()), page_size=1000)
        raw_conn.commit()
        total += len(rows)
        print(f"{len(rows)} rows (total: {total})")
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    print(f"NYC Events update done: {total} rows.")


# ── main ───────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mta", action="store_true", help="Update MTA ridership")
    ap.add_argument("--311", action="store_true", dest="nyc311", help="Update 311 noise complaints")
    ap.add_argument("--dob", action="store_true", help="Update DOB permits")
    ap.add_argument("--events", action="store_true", help="Update NYC permitted events")
    args = ap.parse_args()

    if not any([args.mta, args.nyc311, args.dob, args.events]):
        ap.print_help()
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.mta:
            update_mta(db)
        if args.nyc311:
            update_311(db)
        if args.dob:
            update_dob(db)
        if args.events:
            update_events(db)
    finally:
        db.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
