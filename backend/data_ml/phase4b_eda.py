#!/usr/bin/env python3
"""
Phase 4b EDA — scope & closure-type analysis of the disruptive permitted events.

Tests three things you asked:
  1. How heterogeneous are the disruptive events in scope/type?
  2. Do closure levels (Full Street Closure vs Curb Lane Only vs Sidewalk ...)
     track different noise profiles (loud parades/festivals vs quiet filming)?
  3. Should we scope to Full Street Closure only?

Read-only. Usage:
    python data_ml/phase4b_eda.py
"""
import os, sys
DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"

try:
    from dotenv import load_dotenv
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", ".env"), os.path.join(here, ".env")):
        if os.path.exists(c):
            load_dotenv(c); break
except Exception:
    pass

try:
    import psycopg2, pandas as pd
except ImportError:
    sys.exit("pip install psycopg2-binary pandas python-dotenv")

conn = psycopg2.connect(os.environ.get("DATABASE_URL", DEFAULT_DSN), connect_timeout=15)
ev = pd.read_sql("""SELECT event_name, event_type, street_closure_type
                    FROM nyc_permitted_events WHERE event_borough ILIKE '%%Manhattan%%'""", conn)
conn.close()

dis = ev[ev.street_closure_type.notna() & (ev.street_closure_type != "N/A")].copy()
print("=" * 74)
print(f"disruptive events (closure != N/A): {len(dis)} / {len(ev)}")

print(f"\nstreet_closure_type (disruptive subset):\n{dis.street_closure_type.value_counts().to_string()}")
print(f"\nevent_type (disruptive subset):\n{dis.event_type.value_counts().to_string()}")

print("\n--- cross-tab: event_type (rows) x closure_type (cols) ---")
ct = pd.crosstab(dis.event_type, dis.street_closure_type)
print(ct.to_string())

print("\n--- per closure type: dominant event types + sample names ---")
for cl, n in dis.street_closure_type.value_counts().items():
    sub = dis[dis.street_closure_type == cl]
    types = sub.event_type.value_counts().head(4).to_dict()
    print(f"\n[{cl}]  n={n}")
    print(f"   types: {types}")
    print(f"   examples: {sub.event_name.dropna().head(6).tolist()}")
print("=" * 74)
