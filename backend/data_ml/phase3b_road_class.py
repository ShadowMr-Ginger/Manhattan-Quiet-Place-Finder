#!/usr/bin/env python3
"""
Phase 3b — road-traffic-noise prior (acoustic version).

Pulls Manhattan's road network from OpenStreetMap (Overpass) once, then for each
venue estimates the road-traffic noise level using a simple, citable acoustic model:

  1. Each OSM highway class -> a representative LAeq source level L0 (dB(A)) at the
     D0 = 10 m reference distance, ANCHORED to measured road-category levels
     (Avestia IJCI 2025 case study: expressway 74.2 / major arterial 70.5 /
     collector 60.8 dB(A)) and to the OSM-class-as-noise-proxy schemes of
     Martinelli's osm-noise-pollution model (derived from the Swiss sonBASE
     strategic noise map) and land-use-regression noise studies. See DB_LEVEL.
  2. Line-source geometric divergence:  L(d) = L0 - 10*gamma*log10(d/D0),
     gamma = 1.0 -> 3 dB per distance doubling (ISO 9613-2, incoherent line source).
     Excess ground/barrier attenuation is neglected (a conservative simplification
     that slightly over-estimates the far field — the safe direction for a quiet-finder).
  3. The loudest single road wins:  L_total = max_i L_i(d_i)
     (one contribution per venue — avoids double-counting OSM's many-segments-
     per-road; genuine junction addition is left as future work).
  4. road_noise_prior = clip( (L_total - DB_MIN) / (DB_MAX - DB_MIN), 0, 1 )
     — anchored to an absolute dB range, so it is stable if the venue set changes.

This replaces the earlier hand-picked 0..1 ordinal priors + Gaussian proximity
kernel, which over-penalised loud-but-slightly-farther roads (e.g. highway-
adjacent venues). Class ordering is unchanged; the spacing is now in dB and the
distance law is acoustic.

Outputs:
  data_ml/outputs/venue_road_class.csv   (road_db + road_noise_prior per venue)
  data_ml/outputs/road_class_hist.png

Usage:
    pip install psycopg2-binary python-dotenv pandas numpy shapely requests matplotlib
    python data_ml/phase3b_road_class.py
    python data_ml/phase3b_road_class.py --gamma 1.5 --cutoff 500   # sensitivity sweep
"""
import argparse, json, os, sys, time, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore", message="pandas only supports SQLAlchemy")

DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
UA = {"User-Agent": "QuietSpacesManhattan/COMP47360 (academic research)"}
BBOX = (40.695, -74.030, 40.885, -73.905)   # Manhattan (S, W, N, E)

# Representative LAeq source level (dB(A)) at the D0 reference distance, by OSM class.
# Anchored to measured road-category levels — Avestia IJCI 2025: expressway 74.2 /
# major arterial 70.5 / collector 60.8 dB(A) — and the OSM-class-as-noise-proxy schemes
# of Martinelli's osm-noise-pollution model (Swiss sonBASE strategic noise map) and
# land-use-regression noise studies (Nature s41370-021-00355-z). Ordering + spacing now
# trace to published values rather than hand-picked guesses.
DB_LEVEL = {
    "motorway": 75,        # urban expressway (FDR Dr, West Side Hwy) ~ measured 74
    "trunk": 73,
    "primary": 70,         # major arterial ~ measured 70.5
    "secondary": 67,
    "tertiary": 61,        # collector ~ measured 60.8
    "unclassified": 58,
    "residential": 57,
    "living_street": 53,
    "service": 53,
    "pedestrian": 50,
}
KEEP = set(DB_LEVEL)
D0 = 10.0          # reference distance (m); matches the CRTN basic-noise-level 10 m reference
DB_MIN, DB_MAX = 45.0, 80.0   # dB range mapped to prior 0..1

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
    import requests
    from shapely.geometry import LineString, Point
    from shapely import STRtree
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy shapely requests")


def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

LAT0, LNG0 = 40.78, -73.97
MLAT = 111320.0
MLNG = 111320.0 * np.cos(np.radians(LAT0))
def proj(lat, lng):
    return ((lng - LNG0) * MLNG, (lat - LAT0) * MLAT)


def klass(tags):
    h = (tags or {}).get("highway", "").replace("_link", "")
    return h if h in KEEP else None


def load_venues(dsn):
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, lat, lng "
                        "FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL", conn)
    finally:
        conn.close()
    log(f"  {len(v)} venues loaded")
    return v


def fetch_roads(cache, refresh=False):
    if cache and os.path.exists(cache) and not refresh:
        log(f"Loading cached road network from {cache}  (--refresh to re-pull)…")
        with open(cache) as f:
            return json.load(f)
    s, w, n, e = BBOX
    query = (f"[out:json][timeout:180];way[\"highway\"]({s},{w},{n},{e});out geom;")
    for attempt in range(2):
        for url in OVERPASS:
            try:
                log(f"Querying Overpass ({url.split('/')[2]})… (large, ~30–60s)")
                r = requests.post(url, data={"data": query}, timeout=200, headers=UA)
                if r.status_code == 200:
                    data = r.json()
                    log(f"  {len(data.get('elements', [])):,} ways returned")
                    if cache:
                        os.makedirs(os.path.dirname(cache), exist_ok=True)
                        with open(cache, "w") as f:
                            json.dump(data, f)
                        log(f"  cached to {cache}")
                    return data
                log(f"  HTTP {r.status_code}: {r.text[:100]}")
            except Exception as ex:
                log(f"  failed on {url.split('/')[2]}: {ex}")
            time.sleep(3)
        if attempt == 0:
            log("All mirrors busy — waiting 20s before a second pass…")
            time.sleep(20)
    sys.exit("Overpass unreachable on all mirrors. Try again in a few minutes (servers rate-limit).")


def build_tree(data):
    geoms, levels, classes = [], [], []
    for el in data.get("elements", []):
        if el.get("type") != "way":
            continue
        c = klass(el.get("tags"))
        if not c or "geometry" not in el or len(el["geometry"]) < 2:
            continue
        coords = [proj(p["lat"], p["lon"]) for p in el["geometry"]]
        geoms.append(LineString(coords))
        levels.append(float(DB_LEVEL[c]))
        classes.append(c)
    log(f"  built {len(geoms):,} road segments (vehicular classes only)")
    return STRtree(geoms), np.array(levels), np.array(classes), geoms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--gamma", type=float, default=1.0,
                    help="line-source geometric divergence exponent; 1.0 = 3 dB per distance "
                         "doubling (ISO 9613-2). Raise to model ground/barrier excess attenuation.")
    ap.add_argument("--cutoff", type=float, default=300.0,
                    help="max road distance R considered (m); 300 ≈ motorway audible range "
                         "under γ=1.0 / sonBASE buffers. Only changes set-back venues (max rule).")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)

    v = load_venues(args.dsn)
    data = fetch_roads(os.path.join(args.outdir, "manhattan_highways.json"), args.refresh)
    tree, levels, classes, geoms = build_tree(data)

    g, cutoff = args.gamma, args.cutoff
    log(f"Estimating road noise (γ={g}, cutoff={cutoff:.0f}m, energy-summed)…")
    rows = []
    for _, r in v.iterrows():
        pt = Point(proj(r.lat, r.lng))
        ni = int(tree.nearest(pt)); ndist = pt.distance(geoms[ni])
        best_L = None; best_i = ni; n_near = 0
        for i in tree.query(pt.buffer(cutoff)):
            i = int(i)
            d = pt.distance(geoms[i])
            if d <= cutoff:
                n_near += 1
                L = levels[i] - 10.0 * g * np.log10(max(d, D0) / D0)   # loudest single road wins
                if best_L is None or L > best_L:
                    best_L, best_i = L, i
        L_total = best_L if best_L is not None else DB_MIN
        prior = float(np.clip((L_total - DB_MIN) / (DB_MAX - DB_MIN), 0, 1))
        rows.append(dict(canonical_id=r.canonical_id, canonical_name=r.canonical_name,
                         venue_type=r.venue_type,
                         nearest_class=classes[ni], nearest_dist_m=round(ndist, 1),
                         n_roads_within=n_near, dominant_class=classes[best_i],
                         dominant_dist_m=round(pt.distance(geoms[best_i]), 1),
                         road_db=round(float(L_total), 1), road_noise_prior=round(prior, 3)))
    out = pd.DataFrame(rows)

    # ---- summary ----------------------------------------------------------
    print("\n" + "=" * 72)
    print(f"road_db — min {out.road_db.min():.0f}  median {out.road_db.median():.0f}  "
          f"max {out.road_db.max():.0f} dB(A)        "
          f"prior — median {out.road_noise_prior.median():.2f}  max {out.road_noise_prior.max():.2f}")
    print("\nDominant (loudest single) road class distribution:")
    for c, n in out.dominant_class.value_counts().items():
        print(f"   {c:<14} {n:>4}   (L0={DB_LEVEL[c]} dB)")
    print("\nLoudest venues (top 10 by dB):")
    for _, r in out.sort_values("road_db", ascending=False).head(10).iterrows():
        print(f"   {r.canonical_name[:34]:<34} {r.dominant_class:<11} {r.dominant_dist_m:>4.0f}m  "
              f"{r.road_db:>4.0f}dB  prior={r.road_noise_prior:.2f}")
    print("\nQuietest venues (bottom 10 by dB):")
    for _, r in out.sort_values("road_db").head(10).iterrows():
        print(f"   {r.canonical_name[:34]:<34} {r.dominant_class:<11} {r.dominant_dist_m:>4.0f}m  "
              f"{r.road_db:>4.0f}dB  prior={r.road_noise_prior:.2f}")
    print("=" * 72)

    p = os.path.join(args.outdir, "venue_road_class.csv")
    out.to_csv(p, index=False)
    log(f"wrote {p}")

    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(11, 4))
        ax[0].hist(out.road_db, bins=25, color="#c63", edgecolor="white")
        ax[0].set(title="Estimated road noise", xlabel="road_db (dB(A))", ylabel="venues")
        ax[1].hist(out.road_noise_prior, bins=20, color="#c63", edgecolor="white")
        ax[1].set(title="Road-noise prior", xlabel="road_noise_prior (0..1)")
        fig.tight_layout(); fig.savefig(os.path.join(args.outdir, "road_class_hist.png"), dpi=110)
        log(f"wrote {os.path.join(args.outdir, 'road_class_hist.png')}")
    except Exception as e:
        log(f"  (plot skipped: {e})")

    log("Phase 3b complete.")


if __name__ == "__main__":
    main()
