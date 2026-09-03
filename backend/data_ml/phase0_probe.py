#!/usr/bin/env python3
"""
Phase 0 probe — Hush-Hub Data/ML.

Confirms DB reachability, whether PostGIS is enabled, what's actually in the
live database, and how fresh each civic feed is. Run this BEFORE Phase 1 — its
output decides SQL-vs-Python for all the spatial work and tells you which of the
four civic datasets are loaded yet.

Usage:
    pip install psycopg2-binary python-dotenv
    python phase0_probe.py
    # or override the target:
    DATABASE_URL=postgresql://user:pass@host:5432/db python phase0_probe.py

Connection resolution order:
    1. --dsn argument
    2. DATABASE_URL env var (loaded from ../.env if present)
    3. fallback to the handover doc's connection string
"""
import argparse
import os
import sys
import textwrap

DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"

# --- optional .env load (repo root) ----------------------------------------
try:
    from dotenv import load_dotenv
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (os.path.join(here, "..", ".env"), os.path.join(here, ".env")):
        if os.path.exists(candidate):
            load_dotenv(candidate)
            break
except Exception:
    pass

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 not installed.  pip install psycopg2-binary")


def q(cur, sql, params=None):
    """Run a query, return rows; never raise (return ('ERR', msg) instead)."""
    try:
        cur.execute(sql, params or ())
        return cur.fetchall()
    except Exception as e:
        cur.connection.rollback()
        return [("ERR", str(e).splitlines()[0])]


def one(cur, sql, params=None, default="?"):
    r = q(cur, sql, params)
    if r and r[0] and r[0][0] != "ERR":
        return r[0][0]
    return f"ERR: {r[0][1]}" if r and r[0] and r[0][0] == "ERR" else default


def section(title):
    print("\n" + "=" * 64 + f"\n{title}\n" + "=" * 64)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--timeout", type=int, default=10, help="connect timeout (s)")
    args = ap.parse_args()

    redacted = args.dsn.split("@")[-1] if "@" in args.dsn else args.dsn
    print(f"Connecting to …@{redacted}  (timeout {args.timeout}s)")

    try:
        conn = psycopg2.connect(args.dsn, connect_timeout=args.timeout)
    except Exception as e:
        print("\n CONNECTION FAILED:\n   " + str(e).strip())
        print(textwrap.dedent("""
            If this is a network/timeout error, port 5432 is likely not open to
            the public internet — connect from the UCD student VM instead, or open
            an SSH tunnel through the jumper:

              ssh -L 5432:43.157.51.61:5432 student@<vm-host>   # via ipa-rdp jumper
              DATABASE_URL=postgresql://hushhub:hushhub@localhost:5432/hushhub python phase0_probe.py
        """))
        sys.exit(1)

    cur = conn.cursor()
    warnings = []

    section("1 · Server & PostGIS")
    print("PostgreSQL :", one(cur, "SHOW server_version"))
    postgis = one(cur, "SELECT extversion FROM pg_extension WHERE extname='postgis'",
                  default="NOT INSTALLED")
    print("PostGIS    :", postgis)
    if "ERR" in str(postgis) or postgis == "NOT INSTALLED":
        warnings.append("PostGIS not enabled → do distance math in Python, or ask "
                        "backend to `CREATE EXTENSION postgis;`")

    section("2 · Tables present")
    tables = [r[0] for r in q(cur,
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        if r and r[0] != "ERR"]
    print("\n".join("  " + t for t in tables) or "  (none)")

    expected_civic = {
        "venues": "venue layer (editorial)",
        "mta_ridership": "busyness source",
        "nyc_noise": "311 noise source",
    }
    pending = {
        "construction": ("construction_permit", "dob_now", "construction"),
        "events": ("permitted_event", "events", "permitted_events"),
    }

    section("3 · Core table row counts + freshness")
    for t, desc in expected_civic.items():
        if t in tables:
            n = one(cur, f"SELECT count(*) FROM {t}")
            print(f"  {t:<16} {n:>12}   {desc}")
        else:
            print(f"  {t:<16} {'MISSING':>12}   {desc}")
            warnings.append(f"expected table '{t}' missing")

    # freshness / lag
    if "mta_ridership" in tables:
        rng = q(cur, "SELECT min(transit_timestamp), max(transit_timestamp) FROM mta_ridership")
        print(f"\n  mta_ridership timestamp range : {rng[0][0]}  →  {rng[0][1]}")
    if "nyc_noise" in tables:
        rng = q(cur, "SELECT min(created_date), max(created_date) FROM nyc_noise")
        print(f"  nyc_noise    created_date range : {rng[0][0]}  →  {rng[0][1]}")

    section("4 · Pending civic datasets (construction / events)")
    for label, names in pending.items():
        found = next((n for n in names if n in tables), None)
        if found:
            print(f"  {label:<14} present as '{found}'  ({one(cur, f'SELECT count(*) FROM {found}')} rows)")
        else:
            print(f"  {label:<14} not loaded yet  (Phase 4)")

    section("5 · Venue layer breakdown")
    if "venues" in tables:
        for vt, n in q(cur, "SELECT venue_type, count(*) FROM venues GROUP BY 1 ORDER BY 2 DESC"):
            print(f"  {str(vt):<14} {n}")
        # coverage of the editorial noise attribute that feeds indoor_base
        cov = one(cur, "SELECT count(*) FROM venues WHERE attribute_scores ? 'noise'")
        print(f"\n  venues with a 'noise' attribute cell : {cov} / "
              f"{one(cur,'SELECT count(*) FROM venues')}")

    section("6 · MTA station coverage (busyness anchors)")
    if "mta_ridership" in tables:
        print("  distinct station_complex_id :",
              one(cur, "SELECT count(DISTINCT station_complex_id) FROM mta_ridership"))
        print("  rows with null lat/long     :",
              one(cur, "SELECT count(*) FROM mta_ridership WHERE latitude IS NULL OR longitude IS NULL"))
        print("  lat range :",
              q(cur, "SELECT round(min(latitude)::numeric,3), round(max(latitude)::numeric,3) FROM mta_ridership")[0])

    section("READINESS SUMMARY")
    if warnings:
        print("  Resolve before Phase 1:")
        for w in warnings:
            print("   •", w)
    else:
        print("  No blockers detected — clear to start Phase 1.")
    print()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
