"""
COMP47360 — Quiet Spaces Manhattan
Stage 2 post-pass: flag venue extractions that warrant human review
-------------------------------------------------------------------

Reads the Stage 2 output (extractions.jsonl, one row per venue mention) and
writes a *review queue* containing only the mentions that need a human eye,
plus a deduplicated list of the source articles those mentions came from.

WHY THIS IS NOT THE SAME AS STAGE 1's REVIEW BAND
-------------------------------------------------
Stage 1's confidence was an article-level RELEVANCE probability, so a 0.50-0.75
band made sense: very low = auto-drop, very high = auto-keep, the middle =
review. That logic is two-sided.

Stage 2's `extraction_confidence` measures something different — how sure the
model is that THIS extraction (venue identity + its attributes) is correct and
explicit. High confidence is simply good; there is no "too high to trust"
ceiling. So the natural confidence trigger here is ONE-SIDED: review the LOW
end only (default: < 0.60). You can still reproduce a Stage-1-style band with
--review-min / --review-max if you want parity for the write-up.

Extraction review also benefits from categorical triggers that confidence alone
misses — these are opt-in:
  --flag-chains        is_chain_generic == true   (ambiguous identity; no place_id)
  --flag-out-of-scope  venue_category in the out-of-scope set
                       (coworking_paid, private_library, museum, outdoor)
  --flag-nonwork       work_context == false      (the tag-and-filter venues)
  --flag-nonpositive   endorsement <= 0           (rare in curated editorials;
                                                    often a misread)
  --flag-thin          no representative_quote AND no attributes discussed

A mention is queued if it matches ANY enabled criterion. Each queued row keeps
all its original fields plus a `review_reasons` list explaining why.

Note: many of the categorical conditions (out-of-scope categories, work_context
=false) are ALSO handled automatically by the downstream canonicalization
filter, so you do not have to review them by hand — the flags are there if you
want to spot-check that the automatic filter is behaving.

Run from inside editorial/extraction/:
    python flag_extractions_for_review.py                      # confidence < 0.60
    python flag_extractions_for_review.py --review-min 0.5 --review-max 0.75
    python flag_extractions_for_review.py --flag-chains --flag-out-of-scope
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE          = Path(__file__).resolve().parent          # editorial/extraction/
DEFAULT_INPUT       = HERE / "outputs" / "extractions.jsonl"
DEFAULT_QUEUE_OUT   = HERE / "outputs" / "extraction_review_queue.jsonl"
DEFAULT_URLS_OUT    = HERE / "outputs" / "extraction_review_urls.txt"

# ---------------------------------------------------------------------------
# CONFIG — edit these defaults; every one can still be overridden on the CLI.
# ---------------------------------------------------------------------------

# Confidence review band: a mention is flagged when
#   REVIEW_MIN <= extraction_confidence < REVIEW_MAX
# One-sided by default (no lower bound): flag everything below 0.75.
REVIEW_MIN = 0.0
REVIEW_MAX = 0.75

# Optional categorical triggers (set True to enable by default).
FLAG_CHAINS       = False   # is_chain_generic == true (ambiguous identity)
FLAG_OUT_OF_SCOPE = False   # venue_category in OUT_OF_SCOPE_CATEGORIES
FLAG_NONWORK      = False   # work_context == false
FLAG_NONPOSITIVE  = False   # endorsement <= 0 (rare in curated editorials)
FLAG_THIN         = False   # no representative_quote AND no attributes

OUT_OF_SCOPE_CATEGORIES = {
    "coworking_paid", "private_library", "museum", "outdoor",
}


def reasons_for(row: dict, args) -> list[str]:
    """Return the list of review reasons this mention triggers (empty = keep)."""
    reasons: list[str] = []

    conf = row.get("extraction_confidence")
    if conf is not None and args.review_min <= conf < args.review_max:
        reasons.append(f"low_confidence({conf:.2f})")

    if args.flag_chains and row.get("is_chain_generic"):
        reasons.append("chain_generic")

    if args.flag_out_of_scope and row.get("venue_category") in OUT_OF_SCOPE_CATEGORIES:
        reasons.append(f"out_of_scope({row.get('venue_category')})")

    if args.flag_nonwork and row.get("work_context") is False:
        reasons.append("work_context_false")

    if args.flag_nonpositive:
        end = row.get("endorsement")
        if end is not None and end <= 0:
            reasons.append(f"non_positive_endorsement({end:.2f})")

    if args.flag_thin:
        quote = (row.get("representative_quote") or "").strip()
        attrs = row.get("attributes") or {}
        has_attr = any(v is not None for v in attrs.values()) if isinstance(attrs, dict) else False
        if not quote and not has_attr:
            reasons.append("thin_extraction")

    return reasons


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                   help=f"Stage 2 extractions (default {DEFAULT_INPUT})")
    p.add_argument("--queue-out", type=Path, default=DEFAULT_QUEUE_OUT,
                   help=f"Flagged-mention queue (default {DEFAULT_QUEUE_OUT})")
    p.add_argument("--urls-out", type=Path, default=DEFAULT_URLS_OUT,
                   help=f"Unique flagged URLs (default {DEFAULT_URLS_OUT})")
    # Confidence band — defaults come from the CONFIG block above.
    p.add_argument("--review-min", type=float, default=REVIEW_MIN,
                   help=f"Lower bound of the confidence review band "
                        f"(config default {REVIEW_MIN}).")
    p.add_argument("--review-max", type=float, default=REVIEW_MAX,
                   help=f"Upper bound (exclusive) of the confidence review band "
                        f"(config default {REVIEW_MAX}). For Stage-1-style "
                        f"parity use --review-min 0.5 --review-max 0.75.")
    # Optional categorical triggers — CLI flag force-enables on top of CONFIG.
    p.add_argument("--flag-chains", action="store_true",
                   help="Flag generic chain mentions (is_chain_generic=true).")
    p.add_argument("--flag-out-of-scope", action="store_true",
                   help="Flag out-of-scope venue_category values.")
    p.add_argument("--flag-nonwork", action="store_true",
                   help="Flag work_context=false mentions.")
    p.add_argument("--flag-nonpositive", action="store_true",
                   help="Flag endorsement <= 0 mentions.")
    p.add_argument("--flag-thin", action="store_true",
                   help="Flag mentions with no quote and no attributes.")
    args = p.parse_args()

    # Merge CONFIG defaults with CLI overrides (CLI can only turn flags ON).
    args.flag_chains       = args.flag_chains       or FLAG_CHAINS
    args.flag_out_of_scope = args.flag_out_of_scope or FLAG_OUT_OF_SCOPE
    args.flag_nonwork      = args.flag_nonwork      or FLAG_NONWORK
    args.flag_nonpositive  = args.flag_nonpositive  or FLAG_NONPOSITIVE
    args.flag_thin         = args.flag_thin         or FLAG_THIN

    if not args.input.exists():
        sys.exit(f"Extractions file not found: {args.input}\n"
                 f"  Run `python stage2_extraction.py` first.")

    rows = [json.loads(l) for l in args.input.read_text().splitlines() if l.strip()]
    print(f"Loaded {len(rows)} venue mentions from {args.input}", file=sys.stderr)

    flagged: list[dict] = []
    reason_counts: Counter = Counter()
    url_hits: dict[str, dict] = defaultdict(lambda: {"count": 0, "title": ""})

    for row in rows:
        reasons = reasons_for(row, args)
        if not reasons:
            continue
        out = dict(row)
        out["review_reasons"] = reasons
        flagged.append(out)
        for r in reasons:
            reason_counts[r.split("(")[0]] += 1   # group parametrised reasons
        url = row.get("source_url") or ""
        url_hits[url]["count"] += 1
        url_hits[url]["title"] = row.get("source_title", "") or url_hits[url]["title"]

    # Write the flagged-mention queue.
    args.queue_out.parent.mkdir(parents=True, exist_ok=True)
    with args.queue_out.open("w") as f:
        for out in flagged:
            f.write(json.dumps(out, ensure_ascii=False) + "\n")

    # Write the unique-URL list, most-flagged first.
    with args.urls_out.open("w") as f:
        f.write("# flagged_mentions\tsource_url\tsource_title\n")
        for url, info in sorted(url_hits.items(), key=lambda kv: kv[1]["count"], reverse=True):
            f.write(f"{info['count']}\t{url}\t{info['title']}\n")

    # Summary.
    print("", file=sys.stderr)
    print("Done.", file=sys.stderr)
    print(f"  mentions flagged for review: {len(flagged)} / {len(rows)}", file=sys.stderr)
    print(f"  unique articles involved:    {len(url_hits)}", file=sys.stderr)
    if reason_counts:
        print("  by reason:", file=sys.stderr)
        for reason, n in reason_counts.most_common():
            print(f"    {reason:<28s} {n}", file=sys.stderr)
    print(f"  → queue: {args.queue_out}", file=sys.stderr)
    print(f"  → urls:  {args.urls_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
