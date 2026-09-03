#!/usr/bin/env python3
"""
Phase 3a — 311 chronic-noise feature.

Two complementary, ABSOLUTE measures (no min-max — which only rescaled and never
changed the ranking anyway):

  * RANKING metric  — Kernel Density Estimation (KDE) of the 311 complaint point
    pattern around each venue. Gaussian kernel exp(-(d/σ)²), σ = bandwidth, a
    standard, citable density estimator. Proximity-weighted (a complaint at the
    door counts more than one 200 m away) with no arbitrary hard boundary.
    Reported as a decay-weighted complaints/year intensity.
      kde_per_year = ( Σ exp(-(d/σ)²) ) / years

  * DISPLAY metric  — concrete complaints/year within a hard radius R (what a user
    understands: "≈300 noise complaints/yr within 200 m"). Reported at 100/200/300 m.

Why KDE and not the road_db dB attenuation: a 311 complaint is a reported EVENT,
not a sound source, so an acoustic propagation law is the wrong tool — KDE (a
density/relevance kernel) is the right one. road_db uses dB because roads ARE
sources; this uses KDE because complaints are point events. Different phenomena,
different (correct) models.

Output: outputs/venue_noise_rate.csv

Usage:
    python data_ml/phase3a_noise_features.py
    python data_ml/phase3a_noise_features.py --sigma 150 --radii 100,200,300
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
    from scipy.spatial import cKDTree
    from scipy.stats import spearmanr
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy scipy")


def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

MLAT = 111320.0
def project(lat, lng, lat0, lng0):
    mlng = 111320.0 * np.cos(np.radians(lat0))
    return np.column_stack([(np.asarray(lng) - lng0) * mlng, (np.asarray(lat) - lat0) * MLAT])


def load_venues(dsn):
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, lat, lng "
                        "FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL", conn)
    finally:
        conn.close()
    log(f"  {len(v)} venues loaded")
    return v


def load_noise(dsn, months, cache, refresh=False):
    if cache and os.path.exists(cache) and not refresh:
        log(f"Loading cached noise points from {cache}  (--refresh to re-pull)…")
        return pd.read_pickle(cache)
    log(f"Pulling 311 noise points (trailing {months} months)…")
    sql = f"""SELECT latitude AS lat, longitude AS lng FROM nyc_noise
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                AND created_date >= (SELECT max(created_date) FROM nyc_noise)
                                     - INTERVAL '{int(months)} months'"""
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        n = pd.read_sql(sql, conn)
    finally:
        conn.close()
    log(f"  {len(n):,} noise points in window")
    if cache:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        n.to_pickle(cache)
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--months", type=int, default=24)
    ap.add_argument("--sigma", type=float, default=100.0,
                    help="KDE bandwidth (m); 100 ≈ measured complaint-field coherence "
                         "(1/e length ~68 m + smoothing margin). 3σ cutoff = 300 m.")
    ap.add_argument("--radii", default="100,200,300", help="display radii (m)")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    radii = [float(r) for r in args.radii.split(",")]
    years = args.months / 12.0
    sg, Rcut = args.sigma, 3 * args.sigma

    v = load_venues(args.dsn)
    noise = load_noise(args.dsn, args.months,
                       os.path.join(args.outdir, f"noise_points_{args.months}m.pkl"), args.refresh)

    lat0, lng0 = noise.lat.mean(), noise.lng.mean()
    nxy = project(noise.lat.values, noise.lng.values, lat0, lng0)
    vxy = project(v.lat.values, v.lng.values, lat0, lng0)
    tree = cKDTree(nxy)

    # ---- RANKING metric: KDE intensity (decay-weighted complaints/year) ---
    log(f"KDE intensity (σ={sg:.0f}m, cutoff {Rcut:.0f}m)…")
    kde = np.zeros(len(v))
    for i, idx in enumerate(tree.query_ball_point(vxy, Rcut)):
        if idx:
            d2 = ((nxy[idx] - vxy[i]) ** 2).sum(1)
            kde[i] = np.exp(-d2 / sg ** 2).sum()
    v["kde_per_year"] = (kde / years).round(1)

    # ---- DISPLAY metric: concrete complaints/year within R ----------------
    for R in radii:
        cnt = np.array([len(ix) for ix in tree.query_ball_point(vxy, R)])
        v[f"rate_{int(R)}"] = (cnt / years).round(1)

    primary = int(radii[1]) if len(radii) > 1 else int(radii[0])   # 200 m for display
    print("\n" + "=" * 70)
    print(f"RANKING  kde_per_year (σ={sg:.0f}): median {v.kde_per_year.median():.0f}  max {v.kde_per_year.max():.0f}")
    print(f"DISPLAY  rate_{primary} (complaints/yr within {primary} m): "
          f"median {v[f'rate_{primary}'].median():.0f}  max {v[f'rate_{primary}'].max():.0f}")

    old_path = os.path.join(args.outdir, "venue_noise_sigma_sweep.csv")
    if os.path.exists(old_path):
        old = pd.read_csv(old_path)[["canonical_id", "score_150"]]
        cmp = v.merge(old, on="canonical_id", how="inner")
        print(f"\n   ρ(kde_per_year, OLD score_150) = {spearmanr(cmp.kde_per_year, cmp.score_150).correlation:.3f}"
              f"   ← ~1.0 confirms min-max never changed the ranking")
        print(f"   ρ(kde_per_year, rate_{primary})   = {spearmanr(cmp.kde_per_year, cmp[f'rate_{primary}']).correlation:.3f}"
              f"   ← decay vs hard-radius difference")

    print(f"\nNoisiest (top 8 by KDE):")
    for _, r in v.sort_values("kde_per_year", ascending=False).head(8).iterrows():
        print(f"   {r.canonical_name[:30]:<30} {r.venue_type:<10} "
              f"kde={r.kde_per_year:.0f}/yr   within{primary}m={r[f'rate_{primary}']:.0f}/yr")
    print(f"\nQuietest (bottom 8 by KDE):")
    for _, r in v.sort_values("kde_per_year").head(8).iterrows():
        print(f"   {r.canonical_name[:30]:<30} {r.venue_type:<10} "
              f"kde={r.kde_per_year:.0f}/yr   within{primary}m={r[f'rate_{primary}']:.0f}/yr")
    print("=" * 70)

    keep = ["canonical_id", "canonical_name", "venue_type", "kde_per_year"] + \
           [f"rate_{int(R)}" for R in radii]
    out = os.path.join(args.outdir, "venue_noise_rate.csv")
    v[keep].to_csv(out, index=False)
    log(f"wrote {out}")


if __name__ == "__main__":
    main()
