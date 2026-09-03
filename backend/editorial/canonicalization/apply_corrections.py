"""
COMP47360 — Quiet Spaces Manhattan
Stage 6a-ter: apply manual_review.csv decisions to the Places resolutions
-------------------------------------------------------------------------
Reads manual_review.csv (one row per flagged pair, with a DECISION column) and
applies each decision to place_resolution.jsonl:

  accept   -> keep the current match, clear the needs_review flag
  drop     -> mark manual_drop=true (kept for audit; skipped by aggregate_venues)
  recheck  -> re-resolve using the `corrected_query` column (one API call)
  REVIEW   -> left flagged UNLESS you filled `USER_override_query_or_placeid`

The override column wins over my DECISION. Put in it either:
  * a cleaner query / address   -> re-resolved via Text Search
  * a Google place_id           -> fetched via Place Details (New)
  * the word "drop"             -> dropped

Re-resolutions reuse place_cache.json (no double-billing) and only replace the
match when a Manhattan candidate comes back; otherwise the row stays flagged.

Outputs: place_resolution.jsonl (updated), place_resolution.preapply.jsonl
(backup), apply_log.jsonl (one row per change).

Run from editorial/canonicalization/ (needs GOOGLE_MAPS_API_KEY for recheck/override):
    python apply_corrections.py --dry-run     # show what each decision will do
    python apply_corrections.py
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

import requests
from rapidfuzz import fuzz

from scope import norm
from resolve_places import search_place, FIELD_MASK, CACHE_PATH, MATCH_THRESHOLD

HERE = Path(__file__).resolve().parent
RES = HERE / "outputs" / "place_resolution.jsonl"
CSV = HERE / "outputs" / "manual_review.csv"
BACKUP = HERE / "outputs" / "place_resolution.preapply.jsonl"
LOG = HERE / "outputs" / "apply_log.jsonl"
DETAILS_URL = "https://places.googleapis.com/v1/places/"


def manhattan(addr: str) -> bool:
    m = re.search(r"\b(1\d{4})\b", addr or "")
    return bool(m and 10001 <= int(m.group(1)) <= 10282)


def is_place_id(s: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_\-]{15,}", s or ""))


def get_details(pid: str, api_key: str) -> dict | None:
    """Place Details (New) — same Pro-tier field mask as resolve_places."""
    r = requests.get(DETAILS_URL + pid, timeout=20, headers={
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK.replace("places.", ""),
    })
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:160]}")
    p = r.json()
    return {"place_id": p.get("id"), "place_name": (p.get("displayName") or {}).get("text"),
            "formatted_address": p.get("formattedAddress"),
            "lat": (p.get("location") or {}).get("latitude"),
            "lng": (p.get("location") or {}).get("longitude"),
            "types": p.get("types"), "business_status": p.get("businessStatus"), "n_candidates": 1}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = [json.loads(l) for l in RES.read_text().splitlines() if l.strip()]
    decisions = {}
    with CSV.open() as f:
        for d in csv.DictReader(f):
            decisions[(d["venue_raw"], d["location_context"])] = d

    from collections import Counter
    plan = Counter()
    for r in rows:
        d = decisions.get((r["venue_raw"], r.get("location_context") or ""))
        if not d:
            continue
        ov = (d.get("USER_override_query_or_placeid") or "").strip()
        dec = "override" if ov else d["DECISION"]
        plan[dec] += 1
    print(f"{sum(plan.values())} flagged rows have a decision: {dict(plan)}", file=sys.stderr)
    if args.dry_run:
        print("(dry run — nothing written)", file=sys.stderr); return

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    log, calls = [], 0

    def resolve(query: str):
        nonlocal calls
        if query in cache:
            return cache[query]
        try:
            cand = search_place(query, api_key); calls += 1
        except Exception as exc:
            print(f"  ! {query[:50]}: {exc}", file=sys.stderr); cand = None
        cache[query] = cand
        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False))
        return cand

    def put_match(r, cand, query, via):
        intended = query.split(",")[0]
        sc = fuzz.token_set_ratio(norm(intended), norm(cand.get("place_name", "")))
        r.update(cand)
        r["query"] = query; r["match_confidence"] = round(sc, 1)
        r["needs_review"] = sc < 70
        r["status"] = "resolved"; r["resolved_via"] = via
        return sc

    for r in rows:
        key = (r["venue_raw"], r.get("location_context") or "")
        d = decisions.get(key)
        if not d:
            continue
        ov = (d.get("USER_override_query_or_placeid") or "").strip()
        dec = d["DECISION"]
        rec = {"venue_raw": r["venue_raw"], "location_context": key[1]}

        if ov:                                            # user override wins
            if ov.lower() == "drop":
                r.update(manual_drop=True, needs_review=False, decision="drop",
                         drop_reason="user override: drop")
                rec.update(action="drop", note="user override")
            elif api_key and is_place_id(ov):
                try:
                    cand = get_details(ov, api_key); calls += 1
                except Exception as exc:
                    cand = None; print(f"  ! details {ov}: {exc}", file=sys.stderr)
                if cand and cand.get("place_id"):
                    sc = put_match(r, cand, cand.get("place_name") or ov, "manual_override_id")
                    rec.update(action="override_place_id", new_name=cand.get("place_name"), conf=sc)
                else:
                    rec.update(action="override_failed")
            elif api_key:
                cand = resolve(ov)
                if cand and cand.get("place_id") and manhattan(cand.get("formatted_address")):
                    sc = put_match(r, cand, ov, "manual_override_query")
                    rec.update(action="override_query", new_name=cand.get("place_name"), conf=sc)
                else:
                    rec.update(action="override_no_manhattan_match")
            else:
                rec.update(action="skipped_no_api_key")

        elif dec == "accept":
            r["needs_review"] = False; r["decision"] = "accepted"
            rec.update(action="accept", kept=r.get("place_name"))
        elif dec == "drop":
            r.update(manual_drop=True, needs_review=False, decision="drop",
                     drop_reason=d.get("reason") or "manual drop")
            rec.update(action="drop", reason=d.get("reason"))
        elif dec == "recheck":
            q = d.get("corrected_query") or ""
            if not api_key:
                rec.update(action="skipped_no_api_key")
            elif not q:
                rec.update(action="recheck_no_query")
            else:
                cand = resolve(q)
                if cand and cand.get("place_id") and manhattan(cand.get("formatted_address")):
                    sc = put_match(r, cand, q, "manual_recheck")
                    rec.update(action="recheck", old=d.get("current_match"),
                               new_name=cand.get("place_name"), conf=sc,
                               still_flagged=r["needs_review"])
                else:
                    r["recheck_note"] = f"no Manhattan match for: {q}"
                    rec.update(action="recheck_failed", query=q)
        else:                                             # REVIEW, no override
            rec.update(action="left_flagged")
        log.append(rec)

    if not BACKUP.exists():
        BACKUP.write_text(RES.read_text())
    RES.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in log) + "\n")

    acts = Counter(c["action"] for c in log)
    still = sum(1 for r in rows if r.get("needs_review"))
    print(f"\nDone. API calls: {calls} | actions: {dict(acts)}", file=sys.stderr)
    print(f"  flagged remaining: {still}", file=sys.stderr)
    print(f"  -> updated {RES.name}; backup {BACKUP.name}; log {LOG.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
