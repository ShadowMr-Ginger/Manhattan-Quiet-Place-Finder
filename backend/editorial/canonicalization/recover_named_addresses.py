"""
COMP47360 — Quiet Spaces Manhattan
Stage 6a-quater: recover café names for address-only resolutions
----------------------------------------------------------------
One listicle (hertraveledit.com/pretty-cafes-in-new-york-city) was extracted with
street addresses but no café names, so those 10 pairs resolved to bare address
points (type=street_address, no business_status). The names were recovered by
hand from the article; this step re-resolves each to the real business.

It does NOT change `venue_raw`/`location_context` (those are the join keys to the
mentions) — it only upgrades the resolved fields (place_id, place_name, address,
lat/lng, types, business_status). Several will now share a place_id with venues
already in the set (e.g. Variety Coffee, Ariston, Conwell) and merge in aggregation.

Backs up to place_resolution.prerecover.jsonl; logs to recover_log.jsonl.

Run from editorial/canonicalization/ (needs GOOGLE_MAPS_API_KEY):
    python recover_named_addresses.py --dry-run
    python recover_named_addresses.py
"""
from __future__ import annotations
import argparse, json, os, re, sys
from pathlib import Path
from rapidfuzz import fuzz
from scope import norm
from resolve_places import search_place, CACHE_PATH, MATCH_THRESHOLD

HERE = Path(__file__).resolve().parent
RES = HERE / "outputs" / "place_resolution.jsonl"
BACKUP = HERE / "outputs" / "place_resolution.prerecover.jsonl"
LOG = HERE / "outputs" / "recover_log.jsonl"

# address (exact venue_raw)  ->  café name recovered from the article
NAMES = {
    "105 York St, Brooklyn, NY 11201":   "Devocion",
    "261 7th Ave, New York, NY 10001":   "Variety Coffee",
    "78 5th Ave, New York, NY 10011":    "Ariston Flowers & Cafe",
    "450 Park Ave S, New York, NY 10016":"Felix Roasting Co",
    "6 Hanover St, New York, NY 10005":  "Conwell Coffee Hall",
    "259 E 10th St, New York, NY 10009": "Le Phin",
    "166 Crosby St, New York, NY 10012": "Cafe Lyria",
    "284 Lafayette St, New York, NY 10012":"La Cabra",
    "158 Berkeley Pl, Brooklyn, NY 11217":"Cafe Regular",
    "32 Kent St, Brooklyn, NY 11222":    "Rhythm Zero",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = [json.loads(l) for l in RES.read_text().splitlines() if l.strip()]
    targets = [r for r in rows if r["venue_raw"] in NAMES]
    print(f"{len(targets)} address-only rows to recover", file=sys.stderr)

    if args.dry_run:
        for r in targets:
            print(f"  {r['venue_raw']:<34} -> query: \"{NAMES[r['venue_raw']]}, {r['venue_raw']}\"", file=sys.stderr)
        print("(dry run — no API calls)", file=sys.stderr); return

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        sys.exit("Set GOOGLE_MAPS_API_KEY to run (or use --dry-run).")
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    if not BACKUP.exists():
        BACKUP.write_text(RES.read_text())

    log, calls = [], 0
    for r in rows:
        name = NAMES.get(r["venue_raw"])
        if not name:
            continue
        query = f"{name}, {r['venue_raw']}"
        if query in cache:
            cand = cache[query]
        else:
            try:
                cand = search_place(query, api_key); calls += 1
            except Exception as exc:
                print(f"  ! {query[:50]}: {exc}", file=sys.stderr); cand = None
            cache[query] = cand
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False))
        rec = {"venue_raw": r["venue_raw"], "recovered_name": name, "old_place_id": r.get("place_id")}
        if cand and cand.get("place_id"):
            sc = fuzz.token_set_ratio(norm(name), norm(cand.get("place_name", "")))
            r.update(cand)
            r["query"] = query
            r["match_confidence"] = round(sc, 1)
            r["needs_review"] = sc < MATCH_THRESHOLD
            r["status"] = "resolved"
            r["resolved_via"] = "name_recovery"
            r["recovered_name"] = name
            rec.update(new_place_id=cand.get("place_id"), new_name=cand.get("place_name"),
                       address=cand.get("formatted_address"), business_status=cand.get("business_status"),
                       conf=sc, flagged=r["needs_review"])
        else:
            rec.update(result="no_match")
        log.append(rec)
        print(f"  {r['venue_raw'][:30]:<30} -> {rec.get('new_name','NO MATCH')}  ({rec.get('business_status','-')})", file=sys.stderr)

    RES.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in log) + "\n")
    print(f"\nDone. API calls: {calls} | backup {BACKUP.name}; log {LOG.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
