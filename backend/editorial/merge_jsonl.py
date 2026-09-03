"""
COMP47360 — Quiet Spaces Manhattan
JSONL merge utility
-------------------

Merge two or more JSONL files into one. Two intended uses in this pipeline:

1) RELEVANT stage — combine the Stage-1 kept set with the library-recovery list
   into one augmented relevant list, so Stage 2 can run ONCE over everything.
   Dedup by url so an article present in both isn't processed twice:

     python merge_jsonl.py \
         relevance/outputs/relevant_articles.jsonl \
         relevance/outputs/library_recovery.jsonl \
         --dedup-key url \
         -o relevance/outputs/relevant_articles_augmented.jsonl

   Then:  python extraction/stage2_extraction.py \
              --relevant relevance/outputs/relevant_articles_augmented.jsonl

2) EXTRACTION stage — concatenate separate Stage-2 outputs into one file before
   canonicalization (no dedup; every venue mention is kept):

     python merge_jsonl.py \
         extraction/outputs/extractions.jsonl \
         extraction/outputs/extractions_library.jsonl \
         -o extraction/outputs/extractions_all.jsonl

   NOTE: canonicalize_venues.py also accepts multiple --extractions files
   directly and records which file each venue came from in the `origins`
   field. Prefer that over a pre-merge if you want per-source provenance.

Files are read in the order given; with --dedup-key the FIRST occurrence of a
key wins, so list the authoritative file first.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", type=Path, nargs="+", help="Input JSONL files.")
    p.add_argument("-o", "--output", type=Path, required=True, help="Output JSONL file.")
    p.add_argument("--dedup-key", default=None,
                   help="If set, keep only the first row per value of this key "
                        "(e.g. 'url'). Omit to concatenate everything.")
    args = p.parse_args()

    seen: set = set()
    out: list[dict] = []
    dropped = 0
    for path in args.inputs:
        if not path.exists():
            sys.exit(f"Input not found: {path}")
        n = 0
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if args.dedup_key:
                k = row.get(args.dedup_key)
                if k in seen:
                    dropped += 1
                    continue
                seen.add(k)
            out.append(row); n += 1
        print(f"  {path.name}: +{n}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in out) + "\n"
    )
    tail = (f" ({dropped} duplicate row(s) dropped on '{args.dedup_key}')"
            if args.dedup_key else "")
    print(f"Wrote {len(out)} rows -> {args.output}{tail}", file=sys.stderr)


if __name__ == "__main__":
    main()
