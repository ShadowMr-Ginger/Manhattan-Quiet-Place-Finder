#!/usr/bin/env python3
"""
Phase 4b — permitted-events disruption signal (geocoded).

Events are a TRANSIENT, forward-looking signal. We keep only street/sidewalk/
plaza-CLOSURE events (parades, street festivals, filming) — 'N/A' closures are
park field-bookings that don't affect venues. `event_location` is free text:

  * street range  "<ST> between <A> and <B>"  -> intersect the named streets in
    our cached OSM road network (manhattan_highways.json), midpoint of the two
    cross-intersections.  (Nominatim can't do NYC intersections reliably.)
  * named place   "Park/Plaza name: feature"  -> Nominatim (cached).

Then, for a scoring window [asof, asof+window_days], each venue gets a distance-
decay-weighted tally of events whose start–end overlaps the window.

Usage:
    pip install psycopg2-binary python-dotenv pandas numpy scipy shapely requests
    python data_ml/phase4b_events.py
    python data_ml/phase4b_events.py --asof 2026-07-04 --window-days 7 --sigma 200
"""
import argparse, json, os, re, sys, time, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore", message="pandas only supports SQLAlchemy")

DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = {"User-Agent": "QuietSpacesManhattan/COMP47360 (academic research)"}
VIEWBOX = "-74.03,40.88,-73.90,40.68"

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
    from scipy.spatial import cKDTree
    from shapely.geometry import LineString
    from shapely.ops import unary_union
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy scipy shapely requests")


def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

LAT0 = 40.78
MLAT = 111320.0
MLNG = 111320.0 * np.cos(np.radians(LAT0))
def project(lat, lng, lat0, lng0):
    return np.column_stack([(np.asarray(lng) - lng0) * MLNG, (np.asarray(lat) - lat0) * MLAT])
def mm(x):
    x = np.asarray(x, float); lo, hi = x.min(), x.max()
    return (x - lo) / (hi - lo) if hi > lo else np.zeros_like(x)

# --- street-name canonicalisation so event text matches OSM names -----------
WORD = {"FIRST": "1", "SECOND": "2", "THIRD": "3", "FOURTH": "4", "FIFTH": "5",
        "SIXTH": "6", "SEVENTH": "7", "EIGHTH": "8", "NINTH": "9", "TENTH": "10",
        "ELEVENTH": "11", "TWELFTH": "12"}
# manual backstop for NYC multi-named avenues (most are also caught via OSM alt_name)
ALIAS = {
    "AVENUE OF THE AMERICAS": "6 AVENUE", "AVENUE OF AMERICAS": "6 AVENUE",
    "MALCOLM X BOULEVARD": "LENOX AVENUE",
    "ADAM CLAYTON POWELL JR BOULEVARD": "7 AVENUE",
    "ADAM CLAYTON POWELL BOULEVARD": "7 AVENUE",
    "FREDERICK DOUGLASS BOULEVARD": "8 AVENUE",
    "FASHION AVENUE": "7 AVENUE",
}
NAME_TAGS = ("name", "alt_name", "official_name", "short_name", "old_name", "name:en")
TYPE = {"AVE": "AVENUE", "BLVD": "BOULEVARD", "PL": "PLACE", "RD": "ROAD",
        "PKWY": "PARKWAY", "HWY": "HIGHWAY", "TER": "TERRACE", "SQ": "SQUARE"}
def canon(name):
    s = re.sub(r"\s+", " ", str(name)).strip().upper().replace(".", "")
    s = re.sub(r"\bFT\b", "FORT", s)
    s = re.sub(r"^ST\b", "SAINT", s)                  # leading St. -> Saint
    s = re.sub(r"\bST$", "STREET", s)                 # trailing St -> Street
    for ab, full in (("W", "WEST"), ("E", "EAST"), ("N", "NORTH"), ("S", "SOUTH")):
        s = re.sub(rf"\b{ab}\b", full, s)
    for ab, full in TYPE.items():
        s = re.sub(rf"\b{ab}\b", full, s)
    for w, d in WORD.items():
        s = re.sub(rf"\b{w}\b", d, s)
    s = re.sub(r"\b(\d+)(ST|ND|RD|TH)\b", r"\1", s)   # 4TH -> 4
    return ALIAS.get(s, s)


def load_road_index(path):
    """canonical street name -> merged OSM geometry (lon,lat)."""
    data = json.load(open(path))
    idx = {}
    for el in data.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el or len(el["geometry"]) < 2:
            continue
        tags = el.get("tags") or {}
        names = set()
        for t in NAME_TAGS:                       # index every name variant OSM carries
            if tags.get(t):
                for part in tags[t].split(";"):   # alt_name may be ';'-separated
                    if part.strip():
                        names.add(part.strip())
        if not names:
            continue
        ls = LineString([(p["lon"], p["lat"]) for p in el["geometry"]])
        for nm in names:
            idx.setdefault(canon(nm), []).append(ls)
    merged = {k: unary_union(v) for k, v in idx.items()}
    log(f"  road index: {len(merged):,} distinct street names (incl. alt names)")
    return merged


def osm_intersection(street, cross, ridx):
    a, b = ridx.get(canon(street)), ridx.get(canon(cross))
    if a is None or b is None:
        return None
    inter = a.intersection(b)
    if inter.is_empty:
        return None
    p = inter.centroid
    return [p.y, p.x]                                   # lat, lng


def nominatim(query, cache):
    if query in cache:
        return cache[query]
    try:
        r = requests.get(NOMINATIM, headers=UA, timeout=20,
                         params=dict(q=query, format="json", limit=1,
                                     countrycodes="us", viewbox=VIEWBOX, bounded=1))
        time.sleep(1.1)
        j = r.json() if r.status_code == 200 else []
        cache[query] = [float(j[0]["lat"]), float(j[0]["lon"])] if j else None
    except Exception:
        cache[query] = None
    return cache[query]


def locate(loc, ridx, cache):
    s = re.sub(r"\s+", " ", str(loc).split(",")[0]).strip()
    plaza = s.split(":")[0].strip() if ":" in s else None       # any "PlazaName:" prefix
    if re.search(r"\bbetween\b", s, re.I):                       # street range -> OSM
        if ":" in s:
            s = s.split(":")[-1].strip()                         # drop the prefix
        parts = re.split(r"\s+between\s+", s, flags=re.I)
        street = parts[0]
        crosses = re.split(r"\s+and\s+", parts[1], flags=re.I) if len(parts) > 1 else []
        # try the street as-is, then as the last 2/3 tokens (skips junk descriptors)
        toks = street.split()
        candidates = [street] + [" ".join(toks[-k:]) for k in (2, 3) if len(toks) > k]
        for st in candidates:
            pts = [p for cr in crosses[:2] if (p := osm_intersection(st, cr, ridx))]
            if pts:
                return list(np.mean(pts, axis=0))
        if plaza:                                                # fallback: geocode the plaza
            return nominatim(f"{plaza}, Manhattan, New York", cache)
        return None
    name = plaza or s.split(":")[0].strip()                     # named place -> Nominatim
    return nominatim(f"{name}, Manhattan, New York", cache)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--asof", default=None)
    ap.add_argument("--window-days", type=int, default=7)
    ap.add_argument("--radius", type=float, default=250.0, help="per-venue 'event nearby' radius (m)")
    ap.add_argument("--closures", default="Full Street Closure,Pedestrian Plaza",
                    help="street_closure_type values to keep (loud events), or 'all'")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)

    roads_path = os.path.join(args.outdir, "manhattan_highways.json")
    if not os.path.exists(roads_path):
        sys.exit("Need outputs/manhattan_highways.json (run phase3b first).")
    log("Loading OSM road index…")
    ridx = load_road_index(roads_path)

    conn = psycopg2.connect(args.dsn, connect_timeout=15)
    ev = pd.read_sql("""SELECT event_id, event_name, event_type, event_location,
                               street_closure_type, start_date_time, end_date_time
                        FROM nyc_permitted_events WHERE event_borough ILIKE '%%Manhattan%%'""", conn)
    v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, lat, lng "
                    "FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL", conn)
    conn.close()
    for c in ("start_date_time", "end_date_time"):
        ev[c] = pd.to_datetime(ev[c], errors="coerce")

    # Scope to LOUD closures only. EDA (phase4b_eda) showed closure level tracks noise:
    # Full Street Closure = parades/festivals/fairs (loud); Pedestrian Plaza = amplified
    # concerts/performances (loud); Curb Lane Only = 86/121 filming (quiet); sidewalk
    # closures = markets/sales (low). So drop curb-lane + sidewalk-only.
    disruptive = ev[ev.street_closure_type.notna() & (ev.street_closure_type != "N/A")]
    if args.closures != "all":
        keep_cl = [c.strip() for c in args.closures.split(",")]
        disruptive = disruptive[disruptive.street_closure_type.isin(keep_cl)]
    disruptive = disruptive.copy()
    log(f"loud-closure events kept: {len(disruptive):,} / {len(ev):,}  "
        f"(closures={'all' if args.closures=='all' else args.closures})")

    cache_path = os.path.join(args.outdir, "event_geocode_cache.json")
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    locs = sorted(disruptive.event_location.dropna().unique())
    is_range = sum(1 for l in locs if re.search(r"\bbetween\b", l, re.I))
    log(f"geocoding {len(locs)} unique locations ({is_range} street-ranges via OSM, rest via Nominatim)…")
    located = {}
    for i, loc in enumerate(locs):
        located[loc] = locate(loc, ridx, cache)
        if (i + 1) % 50 == 0:
            json.dump(cache, open(cache_path, "w")); log(f"  {i+1}/{len(locs)}…")
    json.dump(cache, open(cache_path, "w"))
    hit = sum(1 for x in located.values() if x)
    rng_hit = sum(1 for l in locs if re.search(r"\bbetween\b", l, re.I) and located[l])
    log(f"  geocoded {hit}/{len(locs)} ({100*hit/max(len(locs),1):.0f}%)   "
        f"street-ranges: {rng_hit}/{is_range} ({100*rng_hit/max(is_range,1):.0f}%)")
    unmatched = [l for l in locs if not located[l]]
    if unmatched:
        print(f"\n--- {len(unmatched)} still unmatched (first 30) ---")
        for l in unmatched[:30]:
            print("  ", l[:88])
        pd.Series(unmatched, name="event_location").to_csv(
            os.path.join(args.outdir, "event_unmatched.csv"), index=False)

    asof = pd.Timestamp(args.asof) if args.asof else pd.Timestamp.now().normalize()
    wend = asof + pd.Timedelta(days=args.window_days)

    # geocoded loud-event LAYER (window-agnostic) — the frontend plots these directly
    # (events are sparse, so no clutter / hotspot transform needed, unlike construction)
    # and time-filters by start/end at serve time. Also the source of per-card event detail.
    disruptive["coord"] = disruptive.event_location.map(lambda l: located.get(l))
    geo = disruptive[disruptive.coord.notna()].copy()
    feats = [{"type": "Feature",
              "properties": {"name": str(r.event_name)[:90], "type": r.event_type,
                             "closure": r.street_closure_type,
                             "start": str(r.start_date_time), "end": str(r.end_date_time)},
              "geometry": {"type": "Point", "coordinates": [round(r.coord[1], 6), round(r.coord[0], 6)]}}
             for r in geo.itertuples()]
    json.dump({"type": "FeatureCollection",
               "properties": {"layer": "loud_permitted_events", "scope": args.closures,
                              "note": "plot directly; time-filter by start/end at serve time"},
               "features": feats}, open(os.path.join(args.outdir, "events_layer.geojson"), "w"))
    log(f"wrote events_layer.geojson  ({len(feats)} geocoded loud events — map + card detail)")

    # per-venue (scoring window): TOTAL distinct loud events within R + nearest distance.
    # (A single total avoids the nested-radii confusion; nearest distance gives proximity.)
    win = geo[(geo.end_date_time >= asof) & (geo.start_date_time <= wend)]
    lat0, lng0 = v.lat.mean(), v.lng.mean()
    vxy = project(v.lat.values, v.lng.values, lat0, lng0)
    R = args.radius
    if len(win):
        exy = project(np.array([c[0] for c in win.coord]), np.array([c[1] for c in win.coord]), lat0, lng0)
        tree = cKDTree(exy)
        v["n_events_nearby"] = np.array([len(ix) for ix in tree.query_ball_point(vxy, R)])
        d, _ = tree.query(vxy)
        v["nearest_event_m"] = np.round(d, 0)
    else:
        v["n_events_nearby"] = 0
        v["nearest_event_m"] = np.nan

    near = v.n_events_nearby
    print("\n" + "=" * 66)
    print(f"window {asof.date()}..{wend.date()} ({args.window_days}d)  loud events in window: {len(win)}")
    print(f"venues with a loud event within {R:.0f} m: {(near > 0).sum()} / {len(v)}")
    print("\nVenues with a nearby loud event (total count + nearest distance):")
    for _, r in v[near > 0].sort_values("nearest_event_m").head(12).iterrows():
        print(f"   {r.canonical_name[:34]:<34} {r.venue_type:<9} "
              f"{int(r.n_events_nearby)} event(s), nearest {int(r.nearest_event_m)} m")
    print("=" * 66)

    keep = ["canonical_id", "canonical_name", "venue_type", "n_events_nearby", "nearest_event_m"]
    out = os.path.join(args.outdir, "venue_events.csv")
    v[keep].to_csv(out, index=False)
    log(f"wrote {out}")


if __name__ == "__main__":
    main()
