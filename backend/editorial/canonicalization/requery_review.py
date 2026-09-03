"""
COMP47360 — Quiet Spaces Manhattan
Stage 6a-bis: re-query the flagged Places resolutions
-----------------------------------------------------
The first pass (resolve_places.py) flags ~110 pairs as needs_review / no_match.
The dominant failure is a NOISY query: a descriptive location_context
("close to Katz's", "near NYU", "across from the UC") makes Text Search latch
onto a nearby landmark instead of the venue. This pass retries each flagged pair
with cleaner queries and keeps a candidate only if it is a strict improvement.

For each flagged pair it tries up to three queries (reusing the cache so nothing
is double-billed):
  A. name only                     "<venue>, Manhattan, New York, NY"
  B. name + extracted street addr  "<venue>, <NNN Some St>, New York, NY"
  C. name + street (no number)     "<venue>, <Some St>, New York, NY"
Each candidate is scored by name similarity (rapidfuzz) and whether the returned
address actually contains the street we asked for. The best candidate REPLACES
the original only if it beats the original confidence AND lands in Manhattan;
otherwise the original is kept (and stays flagged). So the pass can only improve
or leave unchanged — never make a confident match worse.

Outputs:
  place_resolution.jsonl            (updated in place; original backed up)
  place_resolution.backup.jsonl     (the pre-requery file)
  requery_log.jsonl                 (one row per attempted pair: old vs new)

Run from editorial/canonicalization/ AFTER resolve_places.py:
    python requery_review.py --dry-run    # show the queries it WOULD try (no API)
    python requery_review.py              # run (needs GOOGLE_MAPS_API_KEY)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from rapidfuzz import fuzz

from scope import norm
from resolve_places import search_place, CACHE_PATH, MATCH_THRESHOLD

HERE = Path(__file__).resolve().parent
RES = HERE / "outputs" / "place_resolution.jsonl"
BACKUP = HERE / "outputs" / "place_resolution.backup.jsonl"
LOG = HERE / "outputs" / "requery_log.jsonl"

# A street address inside a messy location_context, e.g. "261 7th Ave",
# "40A 10th Ave", "29 W 21st St", "771 Broadway".
_STREET = (r"(?:[NSEW]\.?\s+)?(?:\d{1,3}(?:st|nd|rd|th)|[A-Z][a-zA-Z]+)\s+"
           r"(?:St|Street|Ave|Avenue|Blvd|Boulevard|Pl|Place|Rd|Road|Sq|Square|"
           r"Pkwy|Plaza|Ln|Lane|Way|Dr|Drive|Terrace)\.?|Broadway")
ADDR_NUM = re.compile(r"\b(\d{1,4}[A-Za-z]?)\s+(" + _STREET + r")", re.I)
STREET_ONLY = re.compile(r"\b(" + _STREET + r")", re.I)


def manhattan(addr: str) -> bool:
    m = re.search(r"\b(1\d{4})\b", addr or "")
    return bool(m and 10001 <= int(m.group(1)) <= 10282)


# Venues the article explicitly places in an outer borough: do NOT retry them
# (forcing a "Manhattan" query could wrongly rescue them onto a same-named
# Manhattan venue). They are dropped by the Manhattan filter downstream anyway.
OUTER = re.compile(r"\b(brooklyn|williamsburg|greenpoint|bushwick|bed[- ]?stuy|"
                   r"dumbo|park slope|queens|astoria|ridgewood|sunnyside|"
                   r"long island city|\blic\b|bronx|staten island)\b", re.I)


def outer_borough(venue: str, loc: str) -> bool:
    return bool(OUTER.search(f"{venue} {loc}"))


def looks_like_address(s: str) -> bool:
    return bool(ADDR_NUM.search(s or ""))


def build_queries(venue: str, loc: str) -> list[tuple[str, str, str]]:
    """Return [(query_type, query, expected_street)] cleanest-first."""
    qs = []
    # B: name + numbered street address pulled from the loc prose
    m = ADDR_NUM.search(loc or "")
    if m:
        street = f"{m.group(1)} {m.group(2)}"
        qs.append(("name+addr", f"{venue}, {street}, New York, NY", street))
    # C: name + bare street (no number) — weaker, helps pin chains to a corner
    else:
        m2 = STREET_ONLY.search(loc or "")
        if m2:
            qs.append(("name+street", f"{venue}, {m2.group(1)}, Manhattan, New York, NY", m2.group(1)))
    # A: name only — best when venue_raw is a real distinctive name
    if not looks_like_address(venue):
        qs.append(("name-only", f"{venue}, Manhattan, New York, NY", ""))
    return qs


def score(venue: str, cand: dict, expected_street: str) -> float:
    """Name similarity, with a bonus when the returned address confirms the street."""
    s = fuzz.token_set_ratio(norm(venue), norm(cand.get("place_name", "")))
    if expected_street:
        num_st = " ".join(expected_street.split()[:2]).lower()
        if num_st and num_st in (cand.get("formatted_address") or "").lower():
            s = min(100.0, s + 15)        # address-confirmed -> trust it more
    return s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Show the queries to try; no API calls.")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=0.0)
    args = ap.parse_args()

    rows = [json.loads(l) for l in RES.read_text().splitlines() if l.strip()]
    flagged = [r for r in rows if r.get("needs_review") or not r.get("place_id")]
    targets = [r for r in flagged if not outer_borough(r["venue_raw"], r.get("location_context") or "")]
    skipped = len(flagged) - len(targets)
    print(f"{len(rows)} pairs; {len(flagged)} flagged — retrying {len(targets)}, "
          f"skipping {skipped} explicit outer-borough (dropped by Manhattan filter anyway)\n", file=sys.stderr)

    if args.dry_run:
        for r in targets[: args.limit or 25]:
            qs = build_queries(r["venue_raw"], r.get("location_context") or "")
            print(f"[{r.get('match_confidence', 0):>3}] {r['venue_raw'][:26]:<26} loc=\"{(r.get('location_context') or '')[:34]}\"", file=sys.stderr)
            for t, q, _ in qs:
                print(f"        {t:<11} {q}", file=sys.stderr)
        print("\n(dry run — no API calls, nothing written)", file=sys.stderr)
        return

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        sys.exit("Set GOOGLE_MAPS_API_KEY to run the re-query (or use --dry-run).")

    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    log, improved, cleared, calls = [], 0, 0, 0

    for i, r in enumerate(targets, 1):
        if args.limit and i > args.limit:
            break
        venue, loc = r["venue_raw"], r.get("location_context") or ""
        orig_conf = r.get("match_confidence", 0) or 0
        best = None
        for qtype, query, street in build_queries(venue, loc):
            if query in cache:
                cand = cache[query]
            else:
                try:
                    cand = search_place(query, api_key); calls += 1
                except Exception as exc:
                    print(f"  ! {query[:50]}: {exc}", file=sys.stderr); cand = None
                cache[query] = cand
                CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False))
            if not cand or not cand.get("place_id") or not manhattan(cand.get("formatted_address")):
                continue
            sc = score(venue, cand, street)
            if best is None or sc > best[0]:
                best = (sc, qtype, query, cand)

        action = "kept"
        if best and best[0] > orig_conf and (best[0] >= MATCH_THRESHOLD or not r.get("place_id")):
            sc, qtype, query, cand = best
            new = {"query": query, "venue_raw": venue, "location_context": loc, **cand}
            new["match_confidence"] = round(sc, 1)
            new["needs_review"] = sc < MATCH_THRESHOLD or (cand.get("n_candidates", 0) > 1 and sc < 90)
            new["status"] = "resolved"
            new["resolved_via"] = f"requery:{qtype}"
            rows[rows.index(r)] = new
            improved += 1
            cleared += 0 if new["needs_review"] else 1
            action = "cleared" if not new["needs_review"] else "improved"
            log.append({"venue_raw": venue, "location_context": loc, "action": action,
                        "old_name": r.get("place_name"), "old_conf": orig_conf,
                        "new_name": cand.get("place_name"), "new_conf": new["match_confidence"],
                        "new_address": cand.get("formatted_address"), "via": qtype})
        else:
            log.append({"venue_raw": venue, "location_context": loc, "action": "kept",
                        "old_name": r.get("place_name"), "old_conf": orig_conf,
                        "best_alt": (best[3].get("place_name") if best else None),
                        "best_alt_conf": (round(best[0], 1) if best else None)})
        print(f"  [{i:>3}/{len(targets)}] {venue[:26]:<26} {action}", file=sys.stderr)

    if not BACKUP.exists():
        BACKUP.write_text(RES.read_text())                 # one-time snapshot of the original
    RES.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in log) + "\n")

    still = sum(1 for r in rows if r.get("needs_review") or not r.get("place_id"))
    print(f"\nDone. API calls: {calls} | improved: {improved} (of which cleared the flag: {cleared})", file=sys.stderr)
    print(f"  flagged remaining: {still} (was {len(targets)})", file=sys.stderr)
    print(f"  -> updated {RES.name}; backup {BACKUP.name}; log {LOG.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
