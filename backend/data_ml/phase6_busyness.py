#!/usr/bin/env python3
"""
Phase 6 — per-venue busyness curve from subway ridership.

Links each venue to nearby subway stations by a walkshed distance-decay
(w = exp(-(d/σ)²), σ=400 m ≈ the quarter-mile transit catchment, cutoff 1200 m)
and forms ONE curve:

    busyness(venue, dow, hour) = Σ_stations  w · pred_ridership(station, dow, hour)

A weighted SUM (not average): so transit-dense areas read busier (a feature), and
a venue far from transit gets a small sum → low curve (correct — quieter area).
The curve carries both axes — HEIGHT = absolute busyness (comparable across venues
on a shared scale), SHAPE = timing. nearest_station_m is a confidence flag (a far
venue's height is correctly low, but its shape is inferred from a distant station).

Inputs:  DB (station coords from mta_ridership; venues) + station_hourly_profile.csv
Outputs: venue_busyness_hourly.csv  (canonical_id × dow × hour × busyness, busyness_pct)
         venue_busyness_meta.csv     (per-venue nearest_station_m, n_stations, peak)

Usage:
    python data_ml/phase6_busyness.py
    python data_ml/phase6_busyness.py --sigma 400 --cutoff 1200
"""
import argparse, os, sys, time, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore", message="pandas only supports SQLAlchemy")

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
    import psycopg2
    from scipy.spatial.distance import cdist
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy scipy")


def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

MLAT = 111320.0
def project(lat, lng, lat0, lng0):
    mlng = 111320.0 * np.cos(np.radians(lat0))
    return np.column_stack([(np.asarray(lng) - lng0) * mlng, (np.asarray(lat) - lat0) * MLAT])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--sigma", type=float, default=400.0, help="walkshed decay (m); ~quarter-mile catchment")
    ap.add_argument("--cutoff", type=float, default=1200.0, help="max venue-station distance (m)")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)

    prof = pd.read_csv(os.path.join(args.outdir, "station_hourly_profile.csv"))
    prof["station_complex_id"] = prof.station_complex_id.astype(str)
    pivot = prof.pivot_table(index="station_complex_id", columns=["dow", "hour"],
                             values="pred_ridership", fill_value=0.0)

    log("Pulling station coords + venues…")
    conn = psycopg2.connect(args.dsn, connect_timeout=15)
    st = pd.read_sql("SELECT station_complex_id, AVG(latitude) lat, AVG(longitude) lng "
                     "FROM mta_ridership GROUP BY station_complex_id", conn)
    v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, lat, lng "
                    "FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL", conn)
    conn.close()
    st["station_complex_id"] = st.station_complex_id.astype(str)
    st = st[st.station_complex_id.isin(pivot.index)].reset_index(drop=True)
    pivot = pivot.reindex(st.station_complex_id)            # align profile rows to station order
    log(f"  {len(st)} stations, {len(v)} venues, profile {pivot.shape[1]} (dow×hour) cols")

    lat0, lng0 = v.lat.mean(), v.lng.mean()
    D = cdist(project(v.lat.values, v.lng.values, lat0, lng0),
              project(st.lat.values, st.lng.values, lat0, lng0))      # venues × stations (m)
    W = np.exp(-(D / args.sigma) ** 2)
    W[D > args.cutoff] = 0.0
    B = W @ pivot.values                                   # venues × (dow×hour)  absolute busyness
    gmax = B.max()
    log(f"busyness matrix {B.shape}  (global max {gmax:.0f})")

    # ---- long hourly curve table -----------------------------------------
    dows = np.array([c[0] for c in pivot.columns]); hours = np.array([c[1] for c in pivot.columns])
    bdf = pd.DataFrame({
        "canonical_id": np.repeat(v.canonical_id.values, B.shape[1]),
        "dow": np.tile(dows, B.shape[0]), "hour": np.tile(hours, B.shape[0]),
        "busyness": np.round(B.flatten(), 1),
        "busyness_pct": np.round(100 * B.flatten() / gmax, 1)})
    bdf.to_csv(os.path.join(args.outdir, "venue_busyness_hourly.csv"), index=False)

    # ---- per-venue meta --------------------------------------------------
    meta = pd.DataFrame({
        "canonical_id": v.canonical_id, "canonical_name": v.canonical_name, "venue_type": v.venue_type,
        "nearest_station_m": np.round(D.min(1), 0).astype(int),
        "n_stations_within": (D <= args.cutoff).sum(1),
        "peak_busyness": np.round(B.max(1), 1),
        "peak_busyness_pct": np.round(100 * B.max(1) / gmax, 1)})
    meta.to_csv(os.path.join(args.outdir, "venue_busyness_meta.csv"), index=False)

    # ---- summary / sanity ------------------------------------------------
    print("\n" + "=" * 70)
    print(f"peak_busyness_pct: min {meta.peak_busyness_pct.min():.0f}  median {meta.peak_busyness_pct.median():.0f}  max {meta.peak_busyness_pct.max():.0f}")
    print(f"nearest_station_m: median {int(meta.nearest_station_m.median())}  "
          f"max {int(meta.nearest_station_m.max())}  "
          f"(>800m, low-confidence: {(meta.nearest_station_m>800).sum()} venues)")
    # peak hour for the busiest venue (sanity: should be commute ~8 or 17)
    top = meta.sort_values("peak_busyness", ascending=False).iloc[0]
    wk = bdf[(bdf.canonical_id == top.canonical_id) & (bdf.dow < 5)].groupby("hour").busyness.mean()
    print(f"\nbusiest venue: {top.canonical_name[:34]} — weekday peak hour {int(wk.idxmax())}:00")
    print("\nBusiest areas (top 8 by peak):")
    for _, r in meta.sort_values("peak_busyness", ascending=False).head(8).iterrows():
        print(f"   {r.canonical_name[:32]:<32} {r.venue_type:<10} peak={r.peak_busyness_pct:5.1f}%  "
              f"nearest stn {r.nearest_station_m}m, {r.n_stations_within} within {args.cutoff:.0f}m")
    print("\nQuietest areas (bottom 8 by peak):")
    for _, r in meta.sort_values("peak_busyness").head(8).iterrows():
        print(f"   {r.canonical_name[:32]:<32} {r.venue_type:<10} peak={r.peak_busyness_pct:5.1f}%  "
              f"nearest stn {r.nearest_station_m}m")
    print("=" * 70)
    log(f"wrote venue_busyness_hourly.csv ({len(bdf):,} rows) + venue_busyness_meta.csv")


if __name__ == "__main__":
    main()
