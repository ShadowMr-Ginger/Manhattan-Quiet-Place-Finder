"""
COMP47360 — Quiet Spaces Manhattan
Stage 7: OpenStreetMap attribute enrichment
-------------------------------------------
Adds a factual OSM tag layer to each canonical venue. OSM answers "does it HAVE
wifi / toilets / step-free access" (presence), complementing the editorial layer's
"is the wifi GOOD" (sentiment), and — being ODbL — every tag is storable
indefinitely with attribution (unlike Google).

Matching is SPATIAL-FIRST, not fuzzy: we already hold accurate coordinates for
every venue, so we query Overpass for POIs within MATCH_RADIUS_M of each venue's
lat/lng (one call, anchored on our coordinates) and attach the nearest POI whose
name confirms the venue. Name similarity is only a tiebreaker / wrong-neighbour
guard, never the primary matcher.

Tags captured (primary + secondary):
  wifi        internet_access(:fee)
  restroom    toilets(:access/:wheelchair)
  access/EDI  wheelchair(:description)
  hours       opening_hours
  seating     outdoor_seating, indoor_seating, capacity
  type        cuisine, takeaway, amenity/shop/tourism
  comfort     air_conditioning, smoking, drinking_water
  space       level, building:levels
  diet        diet:* (vegan/vegetarian/...)
  identity    operator, brand, name

Input:  ../canonicalization/outputs/canonical_venues.jsonl
Output: outputs/canonical_venues_osm.jsonl  (+ a coverage report to stderr)

Run from editorial/enrichment/ :
    python osm_enrich.py --dry-run     # build + show the Overpass query, no network
    python osm_enrich.py               # query Overpass, match, write enriched file
Attribution required downstream: "© OpenStreetMap contributors" (ODbL).
"""
from __future__ import annotations

import argparse, json, math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EDITORIAL = HERE.parent
VENUES = EDITORIAL / "canonicalization" / "outputs" / "canonical_venues.jsonl"
OUT = HERE / "outputs" / "canonical_venues_osm.jsonl"
RAW = HERE / "outputs" / "osm_raw.json"             # cached Overpass response (re-runnable offline)
# mirrors tried in order (the main instance is often busy)
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
MATCH_RADIUS_M = 60        # local proximity-match radius around each venue's coordinate
# token_set_ratio over-rewards a shared generic word ("787 Coffee" vs "Think Coffee"),
# so: accept a STRONG name match anywhere in radius, or a WEAKER one only if it's almost
# exactly on the venue's point (correct abbreviation matches are ≤12 m; the false
# common-word matches sit 30–60 m away).
NAME_STRONG = 80
NAME_WEAK = 60
NEAR_M = 12
# genuine spacing/punctuation variants the token_set step missed (verified by hand);
# recovered by exact OSM name + nearest within 30 m (handles duplicate same-name nodes).
OSM_RECOVER = {
    "Bean & Bean Chelsea": "Bean&Bean Coffee",
    "NOMO SOHO": "NoMo SoHo",
    "noa, a café": "Noa",
    "THE ELK on Mott": "The Elk",
}
# the 2 libraries OSM has no wheelchair tag for — sourced manually (kept separate from
# the OSM layer, with provenance, so the raw sources are not mixed).
MANUAL_ACCESS = {
    "Harry Belafonte 115th Street Library":
        {"wheelchair": "yes", "source": "NYPL — ADA-compliant elevator, barrier-free entry"},
    "Poets House":
        {"wheelchair": "yes", "source": "Poets House (Battery Park City) — reported wheelchair accessible"},
}
# OSM categories our venues fall under (café/library/restaurant/bar/hotel/bakery/bookshop...)
AMENITY = "cafe|library|restaurant|fast_food|bar|pub|food_court|ice_cream|biergarten"
SHOP = "coffee|bakery|books|tea|deli|pastry|confectionery|chocolate"

# tags we keep (exact keys); plus any key beginning "diet:"
KEEP = {
    "internet_access", "internet_access:fee",
    "toilets", "toilets:access", "toilets:wheelchair",
    "wheelchair", "wheelchair:description",
    "opening_hours",
    "outdoor_seating", "indoor_seating", "capacity",
    "cuisine", "takeaway",
    "air_conditioning", "smoking", "drinking_water",
    "level", "building:levels",
    "operator", "brand", "name",
    "amenity", "shop", "tourism", "leisure",
}


def haversine(a, b, c, d):
    R = 6371000.0
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def build_query(coords) -> str:
    # bbox fitted to our venues (+ ~300 m margin). A bbox+tag query is cheap for
    # Overpass; the 45 m proximity matching is done locally below.
    m = 0.003
    s = min(c[0] for c in coords) - m; n = max(c[0] for c in coords) + m
    w = min(c[1] for c in coords) - m; e = max(c[1] for c in coords) + m
    bbox = f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    return ("[out:json][timeout:120];\n(\n"
            f'  nwr["amenity"~"^({AMENITY})$"]({bbox});\n'
            f'  nwr["shop"~"^({SHOP})$"]({bbox});\n'
            f'  nwr["tourism"="hotel"]({bbox});\n'
            ");\nout center;\n")


def osm_block(el, dist, sim) -> dict:
    tags = el.get("tags", {})
    kept = {k: v for k, v in tags.items() if k in KEEP or k.startswith("diet:")}
    cat = tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("leisure")
    return {"osm_type": el["type"], "osm_id": el["id"], "osm_name": tags.get("name"),
            "category": cat, "match_distance_m": round(dist, 1), "name_sim": round(sim, 1),
            "tags": kept}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    venues = [json.loads(l) for l in VENUES.read_text().splitlines() if l.strip()]
    coords = [(v["lat"], v["lng"]) for v in venues if v.get("lat") and v.get("lng")]
    query = build_query(coords)
    print(f"{len(venues)} venues ({len(coords)} with coords) | radius {MATCH_RADIUS_M} m", file=sys.stderr)

    if args.dry_run:
        print("\n--- Overpass query (first 400 chars) ---", file=sys.stderr)
        print(query[:400] + ("..." if len(query) > 400 else ""), file=sys.stderr)
        print("\n(dry run — no network, nothing written)", file=sys.stderr)
        return

    from rapidfuzz import fuzz
    import requests
    OUT.parent.mkdir(parents=True, exist_ok=True)

    if RAW.exists():
        data = json.loads(RAW.read_text()); print(f"using cached {RAW.name}", file=sys.stderr)
    else:
        data = None
        for url in OVERPASS:
            try:
                print(f"  querying {url.split('/')[2]} ...", file=sys.stderr)
                r = requests.post(url, data={"data": query}, timeout=150,
                                  headers={"User-Agent": "QuietSpacesManhattan/COMP47360 (academic research)"})
                if r.status_code == 200:
                    data = r.json(); break
                print(f"    HTTP {r.status_code}: {r.text[:120]}", file=sys.stderr)
            except Exception as exc:
                print(f"    failed: {exc}", file=sys.stderr)
        if data is None:
            sys.exit("All Overpass mirrors failed/timed out — try again later (servers are often busy).")
        RAW.write_text(json.dumps(data))
    els = [e for e in data.get("elements", []) if e.get("tags", {}).get("name")]
    print(f"OSM POIs returned (named): {len(els)}", file=sys.stderr)

    def elpos(e):
        return (e["lat"], e["lon"]) if e["type"] == "node" else (e["center"]["lat"], e["center"]["lon"])

    matched = 0
    from collections import Counter
    tagcov = Counter()
    for v in venues:
        if not (v.get("lat") and v.get("lng")):
            v["osm"] = None; continue
        names = [v.get("canonical_name", "")] + (v.get("member_strings") or [])
        best = None  # (score_key, dist, sim, el)
        for e in els:
            elat, elon = elpos(e)
            d = haversine(v["lat"], v["lng"], elat, elon)
            if d > MATCH_RADIUS_M:
                continue
            sim = max(fuzz.token_set_ratio(n, e["tags"]["name"]) for n in names if n)
            key = (sim, -d)
            if best is None or key > best[0]:
                best = (key, d, sim, e)
        # accept a strong name match anywhere in radius, or a weak one only if ~on the point
        if best and (best[2] >= NAME_STRONG or (best[2] >= NAME_WEAK and best[1] <= NEAR_M)):
            v["osm"] = osm_block(best[3], best[1], best[2])
        else:
            v["osm"] = None

    # explicit recoveries: hand-verified name variants, matched by exact OSM name + nearest
    recovered = 0
    for v in venues:
        if v.get("osm"):
            continue
        want = OSM_RECOVER.get(v.get("canonical_name"))
        if not (want and v.get("lat")):
            continue
        cands = [(haversine(v["lat"], v["lng"], *elpos(e)), e) for e in els if e["tags"]["name"] == want]
        cands = [(d, e) for d, e in cands if d <= 30]
        if cands:
            d, e = min(cands, key=lambda x: x[0])
            v["osm"] = osm_block(e, d, 100.0); v["osm"]["recovered"] = True; recovered += 1

    # manual accessibility supplement for the 2 libraries OSM lacks (separate field, sourced)
    for v in venues:
        ma = MANUAL_ACCESS.get(v.get("canonical_name"))
        if ma:
            v["accessibility_manual"] = ma

    matched = sum(1 for v in venues if v.get("osm"))
    for v in venues:
        if v.get("osm"):
            for k in v["osm"]["tags"]:
                if k not in ("name", "amenity", "shop", "tourism", "leisure"):
                    tagcov[k] += 1

    with OUT.open("w") as f:
        for v in venues:
            f.write(json.dumps(v, ensure_ascii=False) + "\n")

    print(f"\nmatched {matched}/{len(venues)} venues to an OSM POI ({100*matched/len(venues):.0f}%)"
          f"  [+{recovered} recovered name variants]", file=sys.stderr)
    print("per-tag coverage (venues with the tag present):", file=sys.stderr)
    for k, n in tagcov.most_common():
        print(f"   {k:<24} {n}", file=sys.stderr)
    print(f"  -> {OUT}   (attribute layer: © OpenStreetMap contributors, ODbL)", file=sys.stderr)


if __name__ == "__main__":
    main()
