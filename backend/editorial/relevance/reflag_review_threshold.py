"""
COMP47360 — Quiet Spaces Manhattan
Stage 1 post-process: re-flag needs_review against a new threshold
------------------------------------------------------------------

After Stage 1 ran with REVIEW_THRESHOLD=0.70, manual inspection of the
lowest-confidence auto-keeps revealed calibration drift between v3.1's
strict framing criterion and Haiku's borderline interpretation. The
review threshold has been raised to 0.75 to capture that band for human
review.

This script applies the new threshold post-hoc, without re-running Stage 1:

  1. Backs up the existing outputs to *.bak files.
  2. Re-flags `needs_review` on every row of relevant_articles.jsonl and
     relevance_log.jsonl using the new NEW_THRESHOLD.
  3. Writes review_queue.jsonl — a separate file containing ONLY the
     articles that now fall in the needs_review band, in the same JSONL
     format as relevant_articles.jsonl so it's easy to review row-by-row.
  4. Prints summary stats so you know how many articles moved bands.

After manual review of review_queue.jsonl, demote any articles you reject
by removing their URLs from relevant_articles.jsonl (the same pattern as
demote_reviewed.py used previously).

Run from inside editorial/relevance/:
    python reflag_review_threshold.py
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent  # editorial/relevance/
OUTPUTS = HERE / "outputs"

DEFAULT_RELEVANT     = OUTPUTS / "relevant_articles.jsonl"
DEFAULT_LOG          = OUTPUTS / "relevance_log.jsonl"
DEFAULT_REVIEW_QUEUE = OUTPUTS / "review_queue.jsonl"

NEW_THRESHOLD = 0.75
MIN_CONFIDENCE = 0.5  # mirror of the script constant; below this is dropped


def reflag_rows(rows: list[dict], new_threshold: float) -> tuple[list[dict], int, int]:
    """Apply new threshold; return (updated_rows, n_changed, n_now_review)."""
    n_changed = 0
    n_now_review = 0
    updated = []
    for row in rows:
        is_rel = bool(row.get("is_relevant"))
        conf = float(row.get("confidence", 0.0))
        old_flag = bool(row.get("needs_review", False))
        new_flag = (
            is_rel
            and MIN_CONFIDENCE <= conf < new_threshold
        )
        if new_flag != old_flag:
            n_changed += 1
        if new_flag:
            n_now_review += 1
        new_row = dict(row)
        new_row["needs_review"] = new_flag
        # Tag the post-hoc adjustment so the methodology trail is auditable
        new_row["review_threshold"] = new_threshold
        updated.append(new_row)
    return updated, n_changed, n_now_review


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    tmp.replace(path)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--relevant", type=Path, default=DEFAULT_RELEVANT,
                   help=f"(default {DEFAULT_RELEVANT})")
    p.add_argument("--log", type=Path, default=DEFAULT_LOG,
                   help=f"(default {DEFAULT_LOG})")
    p.add_argument("--review-queue", type=Path, default=DEFAULT_REVIEW_QUEUE,
                   help=f"Output: review-band articles for manual inspection "
                        f"(default {DEFAULT_REVIEW_QUEUE})")
    p.add_argument("--threshold", type=float, default=NEW_THRESHOLD,
                   help=f"New review threshold (default {NEW_THRESHOLD}).")
    p.add_argument("--no-backup", action="store_true",
                   help="Skip writing .bak files of the originals.")
    args = p.parse_args()

    print(f"New review threshold: {args.threshold}")
    print()

    # ─── Backup originals ───
    if not args.no_backup:
        for path in (args.relevant, args.log):
            if path.exists():
                bak = path.with_suffix(path.suffix + ".bak")
                shutil.copy2(path, bak)
                print(f"Backed up:  {path.name}  →  {bak.name}")
        print()

    # ─── Re-flag relevant_articles.jsonl ───
    print(f"Processing {args.relevant} ...")
    rel_rows = load_jsonl(args.relevant)
    rel_updated, rel_changed, rel_now_review = reflag_rows(rel_rows, args.threshold)
    write_jsonl(args.relevant, rel_updated)
    print(f"  rows:        {len(rel_updated):>4d}")
    print(f"  reflagged:   {rel_changed:>4d}  (needs_review flag changed)")
    print(f"  now review:  {rel_now_review:>4d}")
    print()

    # ─── Re-flag relevance_log.jsonl ───
    print(f"Processing {args.log} ...")
    log_rows = load_jsonl(args.log)
    log_updated, log_changed, log_now_review = reflag_rows(log_rows, args.threshold)
    write_jsonl(args.log, log_updated)
    print(f"  rows:        {len(log_updated):>4d}")
    print(f"  reflagged:   {log_changed:>4d}")
    print(f"  now review:  {log_now_review:>4d}")
    print()

    # ─── Write review_queue.jsonl ───
    # Only kept articles in the review band — easy to review row by row.
    queue_rows = [r for r in rel_updated if r.get("needs_review")]
    # Sort by confidence ascending so lowest-confidence (most suspect) first
    queue_rows.sort(key=lambda r: float(r.get("confidence", 0.0)))
    write_jsonl(args.review_queue, queue_rows)
    print(f"Review queue written ({len(queue_rows)} articles)")
    print(f"  → {args.review_queue}")
    print(f"  Sorted ascending by confidence (most suspect first).")
    print()
    print("To review row-by-row in your terminal:")
    print(f'  jq -r \'"[\\(.confidence) p_rel=\\(.p_relevant)] \\(.title)\\n  \\(.url)\\n  → \\(.reasoning)\\n"\' {args.review_queue.name}')


if __name__ == "__main__":
    main()
