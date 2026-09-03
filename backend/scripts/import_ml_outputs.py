"""
Import ML pipeline outputs into the database.

Run from backend/ directory:
    python -m scripts.import_ml_outputs

CSV sources (data_ml/outputs/):
    venue_busyness_hourly.csv  → venue_busyness_hourly table
    venue_indicators.csv       → venue_indicators table  (noise + construction + events)
    venue_busyness_meta.csv    → venue_indicators table  (busyness meta columns)
    venue_calm_bar.csv         → venue_calm_bar table
"""
import os
import sys
from pathlib import Path

import pandas as pd
from psycopg2.extras import execute_values

sys.path.append(str(Path(__file__).parent.parent))
from app.database import engine, SessionLocal, Base
from app.models import VenueBusynessHourly, VenueIndicators, VenueCalmBar

ML_DIR = Path(__file__).parent.parent / "data_ml" / "outputs"


def to_int(v):
    try:
        return int(float(v)) if v == v else None
    except Exception:
        return None


def to_float(v):
    try:
        return float(v) if v == v else None
    except Exception:
        return None


def import_busyness_hourly(conn):
    path = ML_DIR / "venue_busyness_hourly.csv"
    df = pd.read_csv(path)
    print(f"  busyness_hourly: {len(df)} rows")

    tuples = [
        (
            row["canonical_id"],
            int(row["dow"]),
            int(row["hour"]),
            to_float(row["busyness"]),
            to_float(row["busyness_pct"]),
        )
        for _, row in df.iterrows()
    ]
    cur = conn.cursor()
    execute_values(cur, """
        INSERT INTO venue_busyness_hourly (canonical_id, dow, hour, busyness, busyness_pct)
        VALUES %s
        ON CONFLICT ON CONSTRAINT uq_busyness_hourly DO UPDATE SET
            busyness     = EXCLUDED.busyness,
            busyness_pct = EXCLUDED.busyness_pct
    """, tuples, page_size=2000)
    conn.commit()
    print(f"  ✓ venue_busyness_hourly imported")


def import_indicators(conn):
    ind = pd.read_csv(ML_DIR / "venue_indicators.csv")
    meta = pd.read_csv(ML_DIR / "venue_busyness_meta.csv")

    # merge on canonical_id
    df = ind.merge(meta[["canonical_id", "nearest_station_m", "n_stations_within",
                          "peak_busyness", "peak_busyness_pct"]],
                   on="canonical_id", how="left")
    print(f"  indicators: {len(df)} rows")

    tuples = [
        (
            row["canonical_id"],
            to_float(row.get("road_db")),
            to_float(row.get("noise311_kde")),
            to_float(row.get("noise311_within100m")),
            to_float(row.get("effective_sites")),
            to_int(row.get("construction_sites_150m")),
            to_int(row.get("n_events_nearby")),
            to_float(row.get("nearest_event_m")),
            to_float(row.get("nearest_station_m")),
            to_int(row.get("n_stations_within")),
            to_float(row.get("peak_busyness")),
            to_float(row.get("peak_busyness_pct")),
        )
        for _, row in df.iterrows()
    ]
    cur = conn.cursor()
    execute_values(cur, """
        INSERT INTO venue_indicators (
            canonical_id, road_db, noise311_kde, noise311_within100m,
            effective_sites, construction_sites_150m,
            n_events_nearby, nearest_event_m,
            nearest_station_m, n_stations_within,
            peak_busyness, peak_busyness_pct
        ) VALUES %s
        ON CONFLICT (canonical_id) DO UPDATE SET
            road_db                  = EXCLUDED.road_db,
            noise311_kde             = EXCLUDED.noise311_kde,
            noise311_within100m      = EXCLUDED.noise311_within100m,
            effective_sites          = EXCLUDED.effective_sites,
            construction_sites_150m  = EXCLUDED.construction_sites_150m,
            n_events_nearby          = EXCLUDED.n_events_nearby,
            nearest_event_m          = EXCLUDED.nearest_event_m,
            nearest_station_m        = EXCLUDED.nearest_station_m,
            n_stations_within        = EXCLUDED.n_stations_within,
            peak_busyness            = EXCLUDED.peak_busyness,
            peak_busyness_pct        = EXCLUDED.peak_busyness_pct
    """, tuples, page_size=500)
    conn.commit()
    print(f"  ✓ venue_indicators imported")


def import_calm_bar(conn):
    df = pd.read_csv(ML_DIR / "venue_calm_bar.csv")
    print(f"  calm_bar: {len(df)} rows")

    tuples = [
        (
            row["canonical_id"],
            to_int(row.get("noise_pos")),
            to_int(row.get("noise_neu")),
            to_int(row.get("noise_neg")),
            to_int(row.get("noise_n")),
            to_int(row.get("crowding_pos")),
            to_int(row.get("crowding_neu")),
            to_int(row.get("crowding_neg")),
            to_int(row.get("crowding_n")),
            to_int(row.get("calm_pos")),
            to_int(row.get("calm_neu")),
            to_int(row.get("calm_neg")),
            to_int(row.get("calm_n")),
            str(row.get("show_calm", "False")).lower() == "true",
        )
        for _, row in df.iterrows()
    ]
    cur = conn.cursor()
    execute_values(cur, """
        INSERT INTO venue_calm_bar (
            canonical_id,
            noise_pos, noise_neu, noise_neg, noise_n,
            crowding_pos, crowding_neu, crowding_neg, crowding_n,
            calm_pos, calm_neu, calm_neg, calm_n,
            show_calm
        ) VALUES %s
        ON CONFLICT (canonical_id) DO UPDATE SET
            noise_pos    = EXCLUDED.noise_pos,
            noise_neu    = EXCLUDED.noise_neu,
            noise_neg    = EXCLUDED.noise_neg,
            noise_n      = EXCLUDED.noise_n,
            crowding_pos = EXCLUDED.crowding_pos,
            crowding_neu = EXCLUDED.crowding_neu,
            crowding_neg = EXCLUDED.crowding_neg,
            crowding_n   = EXCLUDED.crowding_n,
            calm_pos     = EXCLUDED.calm_pos,
            calm_neu     = EXCLUDED.calm_neu,
            calm_neg     = EXCLUDED.calm_neg,
            calm_n       = EXCLUDED.calm_n,
            show_calm    = EXCLUDED.show_calm
    """, tuples, page_size=500)
    conn.commit()
    print(f"  ✓ venue_calm_bar imported")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    raw_conn = db.connection().connection

    print("=== Importing ML outputs ===")
    import_busyness_hourly(raw_conn)
    import_indicators(raw_conn)
    import_calm_bar(raw_conn)
    print("=== Done ===")

    db.close()


if __name__ == "__main__":
    main()
