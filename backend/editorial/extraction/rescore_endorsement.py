"""
COMP47360 — Quiet Spaces Manhattan
Stage-2 correction: re-score non-explicit endorsements on an ABSOLUTE scale
--------------------------------------------------------------------------
Stage 2 calibrated `endorsement` to the article's framing, which compressed
non-explicit mentions (incidental capped ~+0.45, implicit ~+0.80) regardless of
how glowing the prose was. That makes a glowing-but-incidental review score low,
and with a mean it can DRAG a venue's score down. Fix: re-rate those mentions on
an absolute scale ("how strongly does THIS passage recommend the venue as a place
to work/study, ignoring the article's theme"), and let `aggregate_venues.py`
apply the framing discount as a WEIGHT instead (absolute value × framing weight).

Only the 62 in-scope, non-explicit (implicit/incidental) mentions are touched —
from 7 articles. Explicit mentions already span the full range and are left as-is.
Everything except `endorsement` is preserved; the old value is kept as
`endorsement_raw_framed` for audit, and `endorsement_rescored=true` is set.

Reads each venue's home article from the corpus for context, batched one call per
article (7 calls total).

Run from editorial/extraction/ (needs ANTHROPIC_API_KEY):
    python rescore_endorsement.py --dry-run     # show targets + per-article grouping
    python rescore_endorsement.py
"""
from __future__ import annotations

import argparse, json, os, sys
from pathlib import Path
from collections import defaultdict

HERE = Path(__file__).resolve().parent
EDITORIAL = HERE.parent
sys.path.insert(0, str(EDITORIAL / "canonicalization"))
import scope  # noqa: E402

MENTIONS = HERE / "outputs" / "extractions_final.jsonl"
BACKUP = HERE / "outputs" / "extractions_final.preendorse.jsonl"
LOG = HERE / "outputs" / "endorsement_rescore_log.jsonl"
CORPUS = EDITORIAL / "corpus" / "outputs" / "editorial_corpus.jsonl"
RESOLUTION = EDITORIAL / "canonicalization" / "outputs" / "place_resolution.jsonl"
MAX_ARTICLE_CHARS = 24000

PROMPT = """\
You are RE-RATING editorial venue mentions on an ABSOLUTE scale — the SAME scale
the main extractor used for dedicated "best places to work" articles, applied to a
venue REGARDLESS of the article's overall theme.

Below is the full text of one article, then a numbered list of venues it mentions.
For EACH venue, output `endorsement` in [-1.0, 1.0] = how strongly the description
supports the venue as a place to WORK or STUDY, judged ONLY on what the article
says about THAT venue (its calm, space, light, seating, amenities, study-friendliness).

Use this scale — identical to the work-article scale:
  +0.3..+0.5  a positive but bare/brief mention (being singled out as a good spot
              is itself a soft endorsement)
  +0.6..+1.0  an enthusiastic, detailed, or amenity-rich write-up
  ~0          named with no evaluative content
  negative    ONLY for an explicit caveat ("too loud to actually work")

CRITICAL: do NOT score low merely because the article is a library guide or a
"prettiest cafés" roundup rather than a work list — judge the venue on its own
description (a glowing, study-friendly write-up earns +0.6..+1.0 either way). These
are curated, positive editorials; do NOT manufacture negativity.

ARTICLE:
{article}

VENUES (return one score per id):
{venues}
"""


def make_client():
    import instructor
    from anthropic import Anthropic
    return instructor.from_anthropic(Anthropic())


def build_model():
    from pydantic import BaseModel, Field

    class VScore(BaseModel):
        id: int
        endorsement: float = Field(ge=-1.0, le=1.0)

    class Batch(BaseModel):
        scores: list[VScore]
    return Batch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--model", default="claude-haiku-4-5-20251001")
    args = ap.parse_args()

    mentions = [json.loads(l) for l in MENTIONS.read_text().splitlines() if l.strip()]
    corpus = {r["url"]: r.get("text", "") for r in (json.loads(l) for l in CORPUS.read_text().splitlines() if l.strip())}
    resol = {(r["venue_raw"], r.get("location_context") or ""): r
             for r in (json.loads(l) for l in RESOLUTION.read_text().splitlines() if l.strip())}

    # targets: in-scope, non-explicit mentions
    targets = [m for m in mentions
               if m.get("article_work_framing") != "explicit" and scope.in_scope(m)]
    by_article = defaultdict(list)
    for m in targets:
        by_article[m.get("source_url")].append(m)

    def ident(m):
        r = resol.get((m["venue_raw"], m.get("location_context") or ""))
        name = (r.get("place_name") if r else None) or m["venue_raw"]
        loc = m.get("location_context") or ""
        return f"{name}" + (f"  [{loc}]" if loc else "")

    print(f"{len(targets)} non-explicit in-scope mentions from {len(by_article)} articles", file=sys.stderr)
    if args.dry_run:
        for url, mm in by_article.items():
            print(f"\n  {url}  ({len(mm)} venues, {'in corpus' if url in corpus else 'MISSING'})", file=sys.stderr)
            for m in mm:
                print(f"     - {ident(m)}  (was {m.get('endorsement')})", file=sys.stderr)
        print("\n(dry run — no API calls)", file=sys.stderr)
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY to run (or use --dry-run).")
    client = make_client()
    Batch = build_model()

    log = []
    for url, mm in by_article.items():
        text = corpus.get(url, "")
        if not text:
            print(f"  ! no corpus text for {url}; skipped", file=sys.stderr)
            continue
        venues = "\n".join(f"{i}. {ident(m)}" for i, m in enumerate(mm))
        try:
            res = client.chat.completions.create(
                model=args.model, response_model=Batch, max_tokens=1024,
                messages=[{"role": "user", "content": PROMPT.format(
                    article=text[:MAX_ARTICLE_CHARS], venues=venues)}])
            scores = {s.id: s.endorsement for s in res.scores}
        except Exception as exc:
            print(f"  ! {url}: {exc}", file=sys.stderr); continue
        for i, m in enumerate(mm):
            if i not in scores:
                continue
            old = m.get("endorsement")
            m["endorsement_raw_framed"] = old
            m["endorsement"] = round(float(scores[i]), 3)
            m["endorsement_rescored"] = True
            log.append({"venue_raw": m["venue_raw"], "framing": m.get("article_work_framing"),
                        "old": old, "new": m["endorsement"], "source_url": url})
        print(f"  {url.split('/')[2]:<28} {len(mm)} venues re-scored", file=sys.stderr)

    if not BACKUP.exists():
        BACKUP.write_text(MENTIONS.read_text())
    MENTIONS.write_text("\n".join(json.dumps(m, ensure_ascii=False) for m in mentions) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in log) + "\n")

    import statistics
    if log:
        d = [c["new"] - c["old"] for c in log]
        print(f"\nDone. re-scored {len(log)} mentions | mean Δ {statistics.mean(d):+.2f} "
              f"(raised {sum(1 for x in d if x>0)}, lowered {sum(1 for x in d if x<0)})", file=sys.stderr)
    print(f"  backup {BACKUP.name}; log {LOG.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
