"""
COMP47360 — Quiet Spaces Manhattan
Offline corpus re-extraction from cached HTML
----------------------------------------------

Re-derives `text` (now MARKDOWN, structure-preserving) and `title` for every
article already in editorial_corpus.jsonl, reusing the raw HTML already in
corpus/cache/. NO network access — this only re-runs the (upgraded) extractor
in fetch_editorial_corpus.py over the existing cache.

Why: the original flat-text extraction detached venue names from their
addresses and let sidebar/nav text ("Recent Posts", "Follow Us", …) leak into
some articles, and picked sidebar headings as titles. Markdown extraction keeps
names/section headers attached, and resolve_title() recovers real titles from
the <title> tag / URL slug.

Safe by construction:
  - Only articles already in the corpus are touched (same URL set).
  - Each article's other fields (url, publication, domain, publish_date, …) are
    preserved; only `text`, `title`, and `char_count` are refreshed.
  - If a cache file is missing or re-extraction yields too little text, the
    ORIGINAL row is kept unchanged.
  - The previous corpus is backed up to *.pretext.bak before writing.

Run from inside editorial/corpus/:
    python reextract_corpus.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent              # editorial/corpus/
sys.path.insert(0, str(HERE))
# Reuse the SAME extractor + cache paths as the fetch script (single source of
# truth) — importing does not run its main() thanks to the __main__ guard.
from fetch_editorial_corpus import cache_path, extract

CORPUS = HERE / "outputs" / "editorial_corpus.jsonl"
# A re-extraction is suspicious if the body shrinks to under this fraction of
# the original length — flagged for the user to eyeball (not auto-reverted).
SHRINK_FLAG = 0.5


def main() -> None:
    if not CORPUS.exists():
        sys.exit(f"Corpus not found: {CORPUS}")

    rows = [json.loads(l) for l in CORPUS.read_text().splitlines() if l.strip()]
    backup = CORPUS.with_suffix(".jsonl.pretext.bak")
    shutil.copy(CORPUS, backup)
    print(f"Backed up {len(rows)} rows -> {backup.name}", file=sys.stderr)

    updated = titles_changed = skipped_nocache = skipped_short = 0
    shrunk = []
    out = []
    for r in rows:
        url = r.get("url")
        cp = cache_path(url) if url else None
        if not cp or not cp.exists():
            out.append(r); skipped_nocache += 1; continue

        html = cp.read_text(encoding="utf-8", errors="replace")
        data = extract(html, url)
        if not data:
            out.append(r); skipped_short += 1; continue

        old_title = r.get("title")
        old_len = len(r.get("text", "") or "")
        new_len = len(data["text"])

        r = dict(r)
        r["text"] = data["text"]
        if data.get("title") and data["title"] != old_title:
            r["title"] = data["title"]; titles_changed += 1
        elif data.get("title"):
            r["title"] = data["title"]
        if "char_count" in r:
            r["char_count"] = new_len

        if old_len and new_len < SHRINK_FLAG * old_len:
            shrunk.append((url, old_len, new_len, r.get("title", "")))
        out.append(r); updated += 1

    CORPUS.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in out) + "\n")

    print(f"\nDone.", file=sys.stderr)
    print(f"  re-extracted:        {updated}", file=sys.stderr)
    print(f"  titles changed:      {titles_changed}", file=sys.stderr)
    print(f"  skipped (no cache):  {skipped_nocache}", file=sys.stderr)
    print(f"  skipped (too short): {skipped_short}", file=sys.stderr)
    if shrunk:
        print(f"  ! {len(shrunk)} article(s) shrank >50% — eyeball these:", file=sys.stderr)
        for url, o, n, t in shrunk[:15]:
            print(f"      {o:>6}->{n:<6}  {t[:50]}", file=sys.stderr)
    print(f"  -> {CORPUS}", file=sys.stderr)


if __name__ == "__main__":
    main()
