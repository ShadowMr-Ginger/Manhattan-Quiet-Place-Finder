#!/usr/bin/env python3
"""
Phase 4a — active-construction feature from DOB NOW permits (EDA-first).

Construction is a TRANSIENT signal: we score permits whose work window is active
as of a scoring date (default today). For each venue, a distance-decay-weighted
tally of nearby active permits -> construction_score (0..1).

This run prints the permit_status / work_type / filing_reason / cost distributions
FIRST, so we can choose the relevance filter (which work counts as disruptive)
from the real data rather than guessing, then computes a default signal.

  active  = issued_date <= as_of <= expired_date
  weight  = count (default) | cost  (log1p(estimated_job_costs))
  score   = minmax( log1p( sum_k weight_k * exp(-(d_k/sigma)^2) ) )

Output: outputs/venue_construction.csv

Usage:
    python data_ml/phase4a_construction.py
    python data_ml/phase4a_construction.py --asof 2026-06-24 --weight cost --sigma 150
"""
import argparse, json, os, sys, time, warnings
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
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy scipy")


def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

LAT0 = 40.78
MLAT = 111320.0
MLNG = 111320.0 * np.cos(np.radians(LAT0))
def project(lat, lng, lat0, lng0):
    return np.column_stack([(np.asarray(lng) - lng0) * MLNG, (np.asarray(lat) - lat0) * MLAT])
def mm(x):
    x = np.asarray(x, float); lo, hi = x.min(), x.max()
    return (x - lo) / (hi - lo) if hi > lo else np.zeros_like(x)


def load_venues(dsn):
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, lat, lng "
                        "FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL", conn)
    finally:
        conn.close()
    return v


def load_permits(dsn, cache, refresh=False):
    if cache and os.path.exists(cache) and not refresh:
        log(f"Loading cached permits from {cache}  (--refresh to re-pull)…")
        return pd.read_pickle(cache)
    log("Pulling dob_permits…")
    sql = """SELECT latitude AS lat, longitude AS lng, bin, issued_date, expired_date,
                    permit_status, work_type, filing_reason, estimated_job_costs
             FROM dob_permits WHERE latitude IS NOT NULL AND longitude IS NOT NULL"""
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        df = pd.read_sql(sql, conn)
    finally:
        conn.close()
    for c in ("issued_date", "expired_date"):
        df[c] = pd.to_datetime(df[c], errors="coerce")
    log(f"  {len(df):,} permits with coords")
    if cache:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        df.to_pickle(cache)
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--asof", default=None, help="scoring date YYYY-MM-DD (default: today)")
    ap.add_argument("--radii", default="100,150,200",
                    help="count radii (m); ~150 = FHWA RCNM construction-noise reach (primary).")
    ap.add_argument("--hotspot-bw", type=float, default=150.0,
                    help="KDE bandwidth (m) for the construction hotspot-ring map layer")
    ap.add_argument("--status", default="Permit Issued",
                    help="permit_status to keep, or 'all' ('Signed-off' = finished work)")
    ap.add_argument("--work-types",
                    default="General Construction,Structural,Foundation,Protection and Mechanical Methods",
                    help="comma-sep work_type whitelist, or 'all' (excludes interior + persistent structures)")
    ap.add_argument("--min-cost", type=float, default=0.0,
                    help="drop active permits with estimated_job_costs below this (trims small-scale sites)")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    radii = [float(r) for r in args.radii.split(",")]

    v = load_venues(args.dsn)
    df = load_permits(args.dsn, os.path.join(args.outdir, "dob_permits.pkl"), args.refresh)
    asof = pd.Timestamp(args.asof) if args.asof else pd.Timestamp.now().normalize()

    # ---- EDA (decide the relevance filter from this) ----------------------
    print("\n" + "=" * 72)
    print("PERMIT EDA (choose the relevance filter from these distributions)")
    print(f"\npermit_status (top 12):\n{df.permit_status.value_counts().head(12).to_string()}")
    print(f"\nwork_type (top 15):\n{df.work_type.value_counts().head(15).to_string()}")
    print(f"\nfiling_reason (top 8):\n{df.filing_reason.value_counts().head(8).to_string()}")
    c = df.estimated_job_costs.fillna(0)
    print(f"\nestimated_job_costs: zero/na {int((c<=0).sum()):,}  "
          f"median(>0) {c[c>0].median():,.0f}  p90 {c[c>0].quantile(.9):,.0f}  max {c.max():,.0f}")
    date_active = df[(df.issued_date <= asof) & (df.expired_date >= asof)]
    print(f"\nactive by date alone (issued<=asof<=expired): {len(date_active):,}")
    print(f"  of which permit_status='Permit Issued' (not finished): "
          f"{int((date_active.permit_status=='Permit Issued').sum()):,}")
    active = date_active
    if args.status != "all":
        active = active[active.permit_status == args.status]
    if args.work_types != "all":
        wl = [w.strip() for w in args.work_types.split(",")]
        active = active[active.work_type.isin(wl)]
    if args.min_cost > 0:
        active = active[active.estimated_job_costs.fillna(0) >= args.min_cost]
    active = active.copy()
    print(f"\nACTIVE USED  (status={args.status!r}, "
          f"work_types={'all' if args.work_types=='all' else 'disruptive set'}): {len(active):,} permits")
    print("active-used by work_type:")
    print(active.work_type.value_counts().head(10).to_string())
    print("=" * 72)

    if active.empty:
        sys.exit("No active permits for that date — try a different --asof.")

    # dedupe permit rows -> distinct construction SITES (one building = one site; a
    # project files many permit rows). Primary key is BIN (building id); missing-bin
    # permits are SNAPPED to the nearest existing site within 25 m (same building) so
    # they don't inflate the count, and only spawn a new site if nothing is nearby.
    lat0, lng0 = df.lat.mean(), df.lng.mean()
    active["bin"] = active["bin"].astype(str).str.strip().replace({"": np.nan, "nan": np.nan})
    real = active[active.bin.notna()]
    g = real.groupby("bin")
    sites = g.agg(lat=("lat", "median"), lng=("lng", "median"),
                  cost=("estimated_job_costs", "sum")).reset_index()
    sites["n_permits"] = g.size().values
    miss = active[active.bin.isna()]
    snapped = newn = 0
    if len(miss):
        SNAP = 25.0
        d, _ = cKDTree(project(sites.lat.values, sites.lng.values, lat0, lng0)).query(
            project(miss.lat.values, miss.lng.values, lat0, lng0), distance_upper_bound=SNAP)
        snapped = int(np.isfinite(d).sum())
        un = miss[~np.isfinite(d)]
        if len(un):
            uxy = project(un.lat.values, un.lng.values, lat0, lng0)
            cell = (np.round(uxy[:, 0] / SNAP).astype(int).astype(str) + "_" +
                    np.round(uxy[:, 1] / SNAP).astype(int).astype(str))
            ug = un.assign(cell=cell).groupby("cell")
            ns = ug.agg(lat=("lat", "median"), lng=("lng", "median"),
                        cost=("estimated_job_costs", "sum")).reset_index(drop=True)
            ns["bin"] = [f"NB{i}" for i in range(len(ns))]; ns["n_permits"] = ug.size().values
            newn = len(ns)
            sites = pd.concat([sites, ns[sites.columns]], ignore_index=True)
    print(f"\ndistinct active construction SITES: {len(sites):,}  (from {len(active):,} permits; "
          f"{len(miss)} missing-bin → {snapped} snapped to existing, {newn} new)")

    # ---- absolute count of active disruptive SITES within an acoustically-grounded R ----
    # Construction sites are physical noise SOURCES, so the relevant scale is acoustic
    # reach, not site-density autocorrelation. FHWA Roadway Construction Noise Model:
    # equipment ~80-90 dBA Lmax at 50 ft (15 m), point source ~6 dB/doubling → still
    # clearly above urban ambient (~65 dBA) out to ~150 m, fading to ambient by ~280 m.
    # So construction is "disruptive" within ~150 m. We report a plain COUNT (a permit
    # means construction is happening, not a known dB) — no decay, no min-max, no score.
    axy = project(sites.lat.values, sites.lng.values, lat0, lng0)
    vxy = project(v.lat.values, v.lng.values, lat0, lng0)
    tree = cKDTree(axy)
    log(f"Counting active disruptive sites within {radii} m…")
    for R in radii:
        v[f"n_within_{int(R)}"] = np.array([len(ix) for ix in tree.query_ball_point(vxy, R)])

    # decay-weighted "effective sites" (ranking metric) — proximity weighting so a site
    # at the door counts ~1 and one at 150 m ~0.1; Gaussian σ=100 m grounded in the FHWA
    # acoustic reach (NOT 311-style autocorrelation). Stays an honest COUNT, not a dB.
    SG = 100.0
    eff = np.zeros(len(v))
    for i, idx in enumerate(tree.query_ball_point(vxy, 3 * SG)):
        if idx:
            d2 = ((axy[idx] - vxy[i]) ** 2).sum(1)
            eff[i] = np.exp(-d2 / SG ** 2).sum()
    v["effective_sites"] = eff.round(1)

    primary = int(radii[1]) if len(radii) > 1 else int(radii[0])
    pc = v[f"n_within_{primary}"]; es = v.effective_sites
    print(f"\neffective_sites (σ=100): min {es.min():.1f}  p25 {es.quantile(.25):.1f}  "
          f"median {es.median():.1f}  p75 {es.quantile(.75):.1f}  max {es.max():.1f}")
    print(f"within {primary} m count:  min {int(pc.min())}  median {int(pc.median())}  max {int(pc.max())}  "
          f"(>=1: {(pc>0).sum()}/{len(v)})")
    print(f"\nMost construction-affected venues (top 10 by effective_sites):")
    for _, r in v.sort_values("effective_sites", ascending=False).head(10).iterrows():
        ns = "  ".join(f"{int(R)}m:{int(r[f'n_within_{int(R)}'])}" for R in radii)
        print(f"   {r.canonical_name[:30]:<30} {r.venue_type:<9} eff={r.effective_sites:5.1f}  {ns}")

    keep = ["canonical_id", "canonical_name", "venue_type", "effective_sites"] + \
           [f"n_within_{int(R)}" for R in radii]
    out = os.path.join(args.outdir, "venue_construction.csv")
    v[keep].to_csv(out, index=False)
    log(f"wrote {out}")

    # ---- construction HOTSPOT rings for the map: KDE-smoothed density, contoured ----
    # Construction is ubiquitous, so a raw grid is a wash. We KDE-smooth the active-site
    # density (Gaussian bandwidth = --hotspot-bw) and draw contour RINGS at the 90th/97th
    # density percentiles, so only the genuinely dense cores surface as a few zones.
    # Frontend shows this layer ONLY during construction hours (Mon-Fri 07:00-18:00, NYC DEP).
    from scipy.ndimage import gaussian_filter
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    GCELL, BW = 50.0, args.hotspot_bw
    sxy = project(sites.lat.values, sites.lng.values, lat0, lng0)
    x0, y0 = sxy[:, 0].min(), sxy[:, 1].min()
    ix = np.floor((sxy[:, 0] - x0) / GCELL).astype(int)
    iy = np.floor((sxy[:, 1] - y0) / GCELL).astype(int)
    grid = np.zeros((int(iy.max()) + 1, int(ix.max()) + 1)); np.add.at(grid, (iy, ix), 1.0)
    dens = gaussian_filter(grid, sigma=BW / GCELL)
    pos = dens[dens > dens.max() * 0.01]
    levels = sorted({float(np.percentile(pos, p)) for p in (90, 97)})
    cs = plt.contour(dens, levels=levels)
    feats = []
    for lev, segs in zip(cs.levels, cs.allsegs):
        for seg in segs:
            if len(seg) < 4:
                continue
            ring = [[round((x0 + c * GCELL) / MLNG + lng0, 6),
                     round((y0 + r * GCELL) / MLAT + lat0, 6)] for c, r in seg]
            feats.append({"type": "Feature", "properties": {"level": round(float(lev), 2)},
                          "geometry": {"type": "LineString", "coordinates": ring}})
    plt.close("all")
    gj = {"type": "FeatureCollection",
          "properties": {"display_hours": "Mon-Fri 07:00-18:00", "bandwidth_m": BW, "total_sites": int(len(sites))},
          "features": feats}
    hpath = os.path.join(args.outdir, "construction_hotspots.geojson")
    json.dump(gj, open(hpath, "w"))
    log(f"wrote {hpath}  ({len(feats)} hotspot rings at {len(levels)} density levels, KDE bw={BW:.0f}m)")


if __name__ == "__main__":
    main()
