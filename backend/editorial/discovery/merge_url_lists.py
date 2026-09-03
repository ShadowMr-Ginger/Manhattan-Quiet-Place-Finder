"""
COMP47360 — Quiet Spaces Manhattan
Merge two discovery-stage URL lists into a single deduplicated corpus
---------------------------------------------------------------------

Takes two editorial_urls.jsonl-style files (default: the iter1 and iter2
outputs) and merges them into a single editorial_urls_merged.jsonl.

For URLs that appear in both files we union the `matched_queries` arrays
and tag the row with `discovery_iterations: [1, 2]` so the audit trail
shows which discovery round contributed each URL. URLs unique to one file
get `[1]` or `[2]`.

This preserves full provenance: the methodology section can describe
both discovery rounds independently, and the merged file is what
downstream stages (fetch_editorial_corpus.py, stage1_relevance.py) consume.

Run from inside editorial/discovery/ (or from anywhere — paths are
anchored to the script):

    python merge_url_lists.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent  # editorial/discovery/

DEFAULT_ITER1  = HERE / "outputs" / "editorial_urls.jsonl"
DEFAULT_ITER2  = HERE / "outputs" / "editorial_urls_iter2.jsonl"
DEFAULT_OUTPUT = HERE / "outputs" / "editorial_urls_merged.jsonl"


def load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--iter1",  type=Path, default=DEFAULT_ITER1,
                   help=f"(default {DEFAULT_ITER1})")
    p.add_argument("--iter2",  type=Path, default=DEFAULT_ITER2,
                   help=f"(default {DEFAULT_ITER2})")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                   help=f"(default {DEFAULT_OUTPUT})")
    args = p.parse_args()

    iter1_rows = load_rows(args.iter1)
    iter2_rows = load_rows(args.iter2)

    print(f"iter1 rows: {len(iter1_rows):>4d}  ({args.iter1})")
    print(f"iter2 rows: {len(iter2_rows):>4d}  ({args.iter2})")

    if not iter1_rows and not iter2_rows:
        raise SystemExit("No rows found in either input file.")

    # Merge into a single URL-keyed dict; later writes override but we union
    # the matched_queries lists and track which iterations contributed.
    merged: dict[str, dict] = {}

    for row in iter1_rows:
        url = row["url"]
        row = dict(row)
        row["discovery_iterations"] = [1]
        merged[url] = row

    for row in iter2_rows:
        url = row["url"]
        if url in merged:
            existing = merged[url]
            # Union matched_queries
            queries_union = list(dict.fromkeys(
                (existing.get("matched_queries") or [])
                + (row.get("matched_queries") or [])
            ))
            existing["matched_queries"] = queries_union
            # Tag both iterations
            iters = existing.get("discovery_iterations", []) + [2]
            existing["discovery_iterations"] = sorted(set(iters))
            # Keep earliest discovered_at if both present
            if "discovered_at" in row and "discovered_at" in existing:
                if row["discovered_at"] < existing["discovered_at"]:
                    existing["discovered_at"] = row["discovered_at"]
        else:
            row = dict(row)
            row["discovery_iterations"] = [2]
            merged[url] = row

    # Write merged file
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as f:
        for row in merged.values():
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    # Provenance summary
    only_iter1 = sum(1 for r in merged.values()
                     if r["discovery_iterations"] == [1])
    only_iter2 = sum(1 for r in merged.values()
                     if r["discovery_iterations"] == [2])
    both = sum(1 for r in merged.values()
               if r["discovery_iterations"] == [1, 2])

    print()
    print(f"Merged total: {len(merged):>4d} unique URLs")
    print(f"  only iter1:  {only_iter1:>4d}")
    print(f"  only iter2:  {only_iter2:>4d}  (new contribution)")
    print(f"  in both:     {both:>4d}  (rediscovered)")
    print(f"  → {args.output}")


if __name__ == "__main__":
    main()
