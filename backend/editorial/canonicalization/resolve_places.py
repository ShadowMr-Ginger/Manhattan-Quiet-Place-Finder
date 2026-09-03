"""
COMP47360 — Quiet Spaces Manhattan
Stage 6a: resolve venues to Google Places place_id
--------------------------------------------------
Reads the cleaned editorial dataset and resolves each DISTINCT
(venue_raw + location_context) pair to a Google Places `place_id` via the
Places API (New) Text Search. One lookup per distinct pair (NOT per mention) —
a venue named in 8 articles is one physical place, resolved once and reused.

Pre-filtering BEFORE any API call (via scope.py; saves quota, keeps scope clean):
  * work_context == false
  * venue_category in museum/outdoor/coworking_paid/private_library/university_library
  * access == "restricted"
  * is_chain_generic == true  (includes folded multi-branch mentions)
Dropped mentions are logged to drop_log.jsonl with their reason.

Output: place_resolution.jsonl — one row per distinct pair:
  {query, venue_raw, location_context, place_id, place_name, formatted_address,
   lat, lng, types, business_status, match_confidence, needs_review, status}

ToS: only DERIVED fields are stored (id + address/coords/type/rating counts) —
never raw API payloads or review text. Re-runs reuse place_cache.json so you
don't re-bill for venues already resolved.

Setup:
    pip install requests rapidfuzz
    export GOOGLE_MAPS_API_KEY=...        # billing-enabled project, Places API (New) enabled

Run from editorial/canonicalization/:
    python resolve_places.py --limit 10      # smoke test: first 10 distinct pairs
    python resolve_places.py                 # full run (resumes via cache)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from rapidfuzz import fuzz

from scope import in_scope, drop_reason, norm   # shared scope filter

HERE = Path(__file__).resolve().parent                 # editorial/canonicalization/
EDITORIAL = HERE.parent
DEFAULT_INPUT = EDITORIAL / "extraction" / "outputs" / "extractions_final.jsonl"
DEFAULT_OUTPUT = HERE / "outputs" / "place_resolution.jsonl"
CACHE_PATH = HERE / "outputs" / "place_cache.json"
DROP_LOG = HERE / "outputs" / "drop_log.jsonl"            # every dropped mention + reason
IN_SCOPE_OUT = HERE / "outputs" / "extractions_in_scope.jsonl"  # what is passed to Places

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# Field mask sets the billing tier (you pay for the most expensive field asked).
# These are all Pro-tier (~5k free/month) and cover everything we need + can store:
# id (place_id, storable indefinitely), location (lat/lng), formattedAddress, types,
# businessStatus (to drop permanently-closed venues), displayName (match scoring).
# We deliberately DON'T request rating / userRatingCount / openingHours.openNow —
# they'd push every call to Enterprise tier (~1k free, which ~1,018 calls overruns),
# aren't storable long-term under the ToS, and the editorial corpus is our de-facto
# source so Google review aggregates don't feed the model.
FIELD_MASK = ",".join([
    "places.id", "places.displayName", "places.formattedAddress",
    "places.location", "places.types", "places.businessStatus",
])
# Manhattan-ish bias centre (Midtown) so chains resolve to the NYC branch.
BIAS = {"circle": {"center": {"latitude": 40.7549, "longitude": -73.9840}, "radius": 25000.0}}
MATCH_THRESHOLD = 80     # rapidfuzz name similarity below this -> needs_review


def search_place(query: str, api_key: str) -> dict | None:
    """One Places Text Search call. Returns the top candidate's derived fields."""
    body = {"textQuery": query, "locationBias": BIAS, "maxResultCount": 3, "regionCode": "US"}
    r = requests.post(SEARCH_URL, json=body, timeout=20, headers={
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    })
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    places = r.json().get("places") or []
    if not places:
        return None
    p = places[0]
    return {
        "place_id": p.get("id"),
        "place_name": (p.get("displayName") or {}).get("text"),
        "formatted_address": p.get("formattedAddress"),
        "lat": (p.get("location") or {}).get("latitude"),
        "lng": (p.get("location") or {}).get("longitude"),
        "types": p.get("types"),
        "business_status": p.get("businessStatus"),
        "n_candidates": len(places),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--limit", type=int, default=None, help="Resolve only the first N distinct pairs (smoke test).")
    ap.add_argument("--sleep", type=float, default=0.0, help="Seconds between API calls.")
    args = ap.parse_args()

    rows = [json.loads(l) for l in args.input.read_text().splitlines() if l.strip()]

    # scope filter (shared with aggregate_venues) + drop-reason report
    from collections import Counter
    drops = Counter(drop_reason(r) for r in rows if drop_reason(r))
    inscope = [r for r in rows if in_scope(r)]

    # distinct in-scope (venue_raw, location_context) pairs — one API call each
    pairs = {}
    for r in inscope:
        pairs.setdefault((r.get("venue_raw", ""), r.get("location_context") or ""), r)
    pair_list = list(pairs)
    print(f"{len(rows)} mentions: dropped {sum(drops.values())} {dict(drops)}", file=sys.stderr)
    print(f"  -> {len(inscope)} in-scope -> {len(pair_list)} distinct pairs to resolve", file=sys.stderr)

    # persist the in-scope dataset (Places input) + a drop log (audit trail)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    IN_SCOPE_OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in inscope) + "\n")
    with DROP_LOG.open("w") as f:
        for r in rows:
            dr = drop_reason(r)
            if dr:
                f.write(json.dumps({"venue_raw": r.get("venue_raw"),
                                    "location_context": r.get("location_context"),
                                    "source_url": r.get("source_url"),
                                    "drop_reason": dr}, ensure_ascii=False) + "\n")
    print(f"  wrote {IN_SCOPE_OUT.name} ({len(inscope)}) + {DROP_LOG.name} ({sum(drops.values())})", file=sys.stderr)

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        sys.exit("Drop log + in-scope dataset written. Set GOOGLE_MAPS_API_KEY "
                 "(Places API (New), billing on) to run the resolution.")

    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    args.output.parent.mkdir(parents=True, exist_ok=True)

    out, calls, reused, nores = [], 0, 0, 0
    for i, (venue, loc) in enumerate(pair_list, 1):
        if args.limit and i > args.limit:
            break
        query = f"{venue}, {loc}, New York" if loc else f"{venue}, New York, NY"
        if query in cache:
            res = cache[query]; reused += 1
        else:
            try:
                res = search_place(query, api_key); calls += 1
            except Exception as exc:
                print(f"  ! {query[:50]}: {exc}", file=sys.stderr)
                res = None
            cache[query] = res
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False))  # persist every call (resume-safe)
            if args.sleep:
                time.sleep(args.sleep)
        row = {"query": query, "venue_raw": venue, "location_context": loc}
        if not res:
            nores += 1
            row.update({"place_id": None, "status": "no_match", "needs_review": True})
        else:
            conf = fuzz.token_set_ratio(norm(venue), norm(res.get("place_name", "")))
            row.update(res)
            row["match_confidence"] = conf
            row["needs_review"] = conf < MATCH_THRESHOLD or (res.get("n_candidates", 0) > 1 and conf < 90)
            row["status"] = "resolved"
        out.append(row)
        print(f"  [{i:>4}/{len(pair_list)}] {venue[:30]:<30} -> {row.get('place_name') or 'NO MATCH'}", file=sys.stderr)

    with args.output.open("w") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"\nDone. API calls: {calls} | cache reuse: {reused} | no-match: {nores}", file=sys.stderr)
    print(f"  needs_review: {sum(1 for r in out if r.get('needs_review'))}", file=sys.stderr)
    print(f"  -> {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
