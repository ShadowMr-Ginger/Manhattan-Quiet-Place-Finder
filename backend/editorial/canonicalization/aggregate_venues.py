"""
COMP47360 — Quiet Spaces Manhattan
Stage 6b: aggregate mentions into canonical venues (by place_id)
---------------------------------------------------------------
Offline (no API). Joins the cleaned mentions to the Places resolutions and
collapses them by `place_id` — the authoritative identity key. Different name
variants of one branch merge (same place_id); same name at different branches
stay separate (different place_id). Then keeps Manhattan only and writes one
row per canonical venue with aggregated editorial features.

Inputs:
  ../extraction/outputs/extractions_final.jsonl   (mentions)
  outputs/place_resolution.jsonl                  (from resolve_places.py)
Output:
  outputs/canonical_venues.jsonl

Run from editorial/canonicalization/:  python aggregate_venues.py
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from scope import in_scope                        # shared scope filter

HERE = Path(__file__).resolve().parent
EDITORIAL = HERE.parent
DEFAULT_MENTIONS = EDITORIAL / "extraction" / "outputs" / "extractions_final.jsonl"
DEFAULT_RESOLUTION = HERE / "outputs" / "place_resolution.jsonl"
DEFAULT_OUTPUT = HERE / "outputs" / "canonical_venues.jsonl"

ATTRIBUTES = ("noise", "wifi", "seating", "outlets", "crowding",
              "accessibility", "laptop_friendly", "price", "hours", "restroom")
# Note on the last two:
#   accessibility -> genuine disability access only (wheelchair/ramp/elevator/ADA);
#                    sparse (~9 cells), so most venues score None — treat as a bonus
#                    signal, not a primary feature. Real EDI data comes from OSM/NYC.
#   restroom      -> toilet AVAILABILITY (split out of accessibility by the attribute
#                    audit). The weighted score reads as availability: >0 = reported
#                    present, <0 = reported absent. Useful as a card badge, not a
#                    busyness/quietness model input.
# Endorsement values are ABSOLUTE (Stage 2 + rescore_endorsement.py), so framing is
# applied HERE as a weight rather than baked into the value. mention_type (96% featured)
# and extraction_confidence (near-constant; its low values were naming issues we hand-
# fixed, not accuracy) were dropped after analysis — they added noise, not signal. So:
#   endorsement_score -> framing-weighted MEAN, displayed raw alongside mention_count
#                        (the user judges thin evidence from the visible count)
#   ranking_score     -> the same mean SHRUNK toward the global average (empirical-Bayes);
#                        NOT a shown rating — used only for default sidebar ordering, so a
#                        thin one-off rave doesn't sit above a well-reviewed venue
#   attributes        -> RAW COUNTS of positive/neutral/negative mentions (a mean would hide
#                        both volume and disagreement); rendered as a stacked bar, net = pos-neg
FRAMING_WEIGHT = {"explicit": 1.0, "implicit": 0.8, "incidental": 0.5}
MAX_QUOTES = 3
SHRINK_K = 1.0   # ranking_score only: prior worth ~1 explicit mention (gentle — don't bury thin-but-glowing gems)


def sent(p): return {"positive": 1.0, "neutral": 0.0, "negative": -1.0}.get(p, 0.0)
def fweight(m): return FRAMING_WEIGHT.get(m.get("article_work_framing"), 0.8)


def is_manhattan(addr, lat):
    """Manhattan if the ZIP is in the Manhattan range (10001-10282), else fall
    back to a coarse latitude/longitude box."""
    m = re.search(r"\b(1\d{4})\b", addr or "")
    if m:
        return 10001 <= int(m.group(1)) <= 10282
    return lat is not None and 40.70 <= lat <= 40.88   # coarse fallback


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mentions", type=Path, default=DEFAULT_MENTIONS)
    ap.add_argument("--resolution", type=Path, default=DEFAULT_RESOLUTION)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--keep-nonmanhattan", action="store_true")
    args = ap.parse_args()
    if not args.resolution.exists():
        sys.exit(f"Run resolve_places.py first — {args.resolution} not found.")

    mentions = [json.loads(l) for l in args.mentions.read_text().splitlines() if l.strip()]
    res = {(r["venue_raw"], r.get("location_context") or ""): r
           for r in (json.loads(l) for l in args.resolution.read_text().splitlines() if l.strip())}

    groups = defaultdict(list)
    n_scope = n_unresolved = n_nonman = n_dropped = n_closed = 0
    for m in mentions:
        if not in_scope(m):
            continue
        n_scope += 1
        r = res.get((m.get("venue_raw", ""), m.get("location_context") or ""))
        if r and r.get("manual_drop"):          # dropped in manual review (kept for audit)
            n_dropped += 1
            continue
        if not r or not r.get("place_id"):
            n_unresolved += 1
            continue
        if r.get("business_status") == "CLOSED_PERMANENTLY":   # Google says it's gone -> not a workspace
            n_closed += 1
            continue
        if not args.keep_nonmanhattan and not is_manhattan(r.get("formatted_address"), r.get("lat")):
            n_nonman += 1
            continue
        groups[r["place_id"]].append((m, r))

    # global prior for the (sort-only) shrinkage: framing-weighted mean over all aggregated mentions
    grouped = [m for members in groups.values() for m, _ in members]
    gtot = sum(fweight(m) for m in grouped) or 1.0
    global_endorse = sum(float(m.get("endorsement", 0.0)) * fweight(m) for m in grouped) / gtot

    rows = []
    for i, (pid, members) in enumerate(sorted(groups.items(), key=lambda kv: -len(kv[1])), 1):
        ms = [m for m, _ in members]
        r0 = members[0][1]
        # endorsement_score: framing-weighted mean (the displayed rating; mention_count beside it).
        # ranking_score: that mean shrunk toward the global prior, for default ordering only.
        wtot = sum(fweight(m) for m in ms) or 1.0
        endorse = sum(float(m.get("endorsement", 0.0)) * fweight(m) for m in ms) / wtot
        ranking = (wtot * endorse + SHRINK_K * global_endorse) / (wtot + SHRINK_K)
        # attributes: raw counts of positive / neutral / negative mentions, so the card can
        # show a distribution bar (volume + disagreement) instead of a misleading mean.
        # net = positive - negative; note = a paraphrase from the top-endorsement agreeing mention.
        attr = {}
        for a in ATTRIBUTES:
            cells = [(m, (m.get("attributes") or {}).get(a)) for m in ms
                     if isinstance((m.get("attributes") or {}).get(a), dict)]
            if not cells:
                attr[a] = {"positive": 0, "neutral": 0, "negative": 0, "n": 0, "net": 0, "note": None}
                continue
            pos = sum(1 for _, c in cells if c.get("polarity") == "positive")
            neu = sum(1 for _, c in cells if c.get("polarity") == "neutral")
            neg = sum(1 for _, c in cells if c.get("polarity") == "negative")
            net = pos - neg
            agree = [(m, c) for (m, c) in cells
                     if sent(c.get("polarity")) != 0 and (sent(c.get("polarity")) > 0) == (net > 0)]
            pool = agree if (net != 0 and agree) else cells
            note = max(pool, key=lambda mc: float(mc[0].get("endorsement", 0.0)))[1].get("evidence")
            attr[a] = {"positive": pos, "neutral": neu, "negative": neg,
                       "n": len(cells), "net": net, "note": note}
        quotes = sorted([m for m in ms if m.get("quote_verbatim") and (m.get("representative_quote") or "").strip()],
                        key=lambda m: float(m.get("endorsement", 0.0)), reverse=True)
        rows.append({
            "canonical_id": f"cv_{i:04d}",
            "place_id": pid,
            "canonical_name": r0.get("place_name"),
            "formatted_address": r0.get("formatted_address"),
            "lat": r0.get("lat"), "lng": r0.get("lng"),
            "google_types": r0.get("types"),
            "business_status": r0.get("business_status"),
            "mention_count": len(ms),
            "unique_sources": len({m.get("source_url") for m in ms}),
            "member_strings": sorted({m["venue_raw"] for m in ms}),
            "endorsement_score": round(endorse, 3),      # framing-weighted mean — the displayed rating
            "ranking_score": round(ranking, 3),          # shrunk — default sidebar ordering only
            "attribute_scores": attr,
            "representative_quotes": [
                {"quote": m["representative_quote"], "publication": m.get("source_publication"),
                 "source_url": m.get("source_url")} for m in quotes[:MAX_QUOTES]],
            "needs_review": all(members[j][1].get("needs_review") for j in range(len(members))),
        })

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"in-scope mentions:        {n_scope}", file=sys.stderr)
    print(f"  manual-dropped:           {n_dropped}", file=sys.stderr)
    print(f"  unresolved (no place_id): {n_unresolved}", file=sys.stderr)
    print(f"  dropped permanently-closed: {n_closed}", file=sys.stderr)
    print(f"  dropped non-Manhattan:    {n_nonman}", file=sys.stderr)
    print(f"CANONICAL VENUES:         {len(rows)}", file=sys.stderr)
    print(f"  flagged needs_review:     {sum(1 for r in rows if r['needs_review'])}", file=sys.stderr)
    print(f"  -> {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
