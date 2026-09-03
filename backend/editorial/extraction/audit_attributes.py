"""
COMP47360 — Quiet Spaces Manhattan
Data-cleaning sub-step: audit attribute cells against their evidence
-------------------------------------------------------------------
Each extracted attribute is a {polarity, evidence} cell. This step checks that
the evidence actually describes that attribute at that polarity — important
because ~55% of venues rest on <=2 attribute cells, where one mis-attribution
distorts the whole profile.

Two phases:
  1. RULE pre-pass (free): auto-keeps cells whose evidence contains a strong,
     unambiguous keyword for their attribute; flags the rest for review.
  2. LLM pass (Claude Haiku via instructor): for each flagged cell, decides what
     attribute the evidence ACTUALLY describes (the 9 attributes, or the new
     'restroom' split out of 'accessibility', or 'none' = drop) and the correct
     polarity. Cells are then kept / re-polarised / reassigned / dropped.

Outputs (writes back into extractions_final.jsonl in place; log makes it reversible):
  * cleaned attributes in extractions_final.jsonl
  * attribute_audit_log.jsonl  — one row per change {venue, source_url, action,
    attribute, new_attribute, old_polarity, new_polarity, evidence}

Run from editorial/extraction/ AFTER resolve_venues.py:
    python audit_attributes.py --dry-run    # rule pre-pass only (free): flagged count
    python audit_attributes.py              # audit flagged cells only (needs ANTHROPIC_API_KEY)
    python audit_attributes.py --all        # audit EVERY cell (also re-checks polarity)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "outputs" / "extractions_final.jsonl"
LOG = HERE / "outputs" / "attribute_audit_log.jsonl"

ATTRS = ("noise", "wifi", "seating", "outlets", "crowding",
         "accessibility", "laptop_friendly", "price", "hours")
# valid reassignment targets: the 9 + restroom (split from accessibility) + none (drop)
TARGETS = list(ATTRS) + ["restroom", "none"]

# Strong, attribute-specific keywords. If present, the cell is confidently
# on-topic and skips the LLM. Kept deliberately tight to avoid false auto-keeps.
STRONG = {
    "wifi":            r"wi-?fi|internet",
    "outlets":         r"outlet|plug\b|socket|charg|\bpower\b|\bport",
    "hours":           r"\d\s*(?:am|pm)|open|clos|\bhours?\b|24/7|late|early|midnight",
    "noise":           r"noise|loud|quiet|silent|music|hush",
    "seating":         r"seat|table|chair|sofa|couch|bench|stool|booth",
    "crowding":        r"crowd|packed|\bbusy\b|empty|\bline\b|\bwait|fills? up|fill up",
    "price":           r"price|\$|cheap|expensive|afford|\bcost|refill|dollar|budget|pricey|free\b",
    "laptop_friendly": r"laptop|work|study|remote|freelanc|computer",
    "accessibility":   r"bathroom|restroom|toilet|wheelchair|accessib|ramp|elevator|\bada\b|step-free|disab",
}


def rule_ok(attr: str, evidence: str) -> bool:
    # accessibility never auto-passes: its keywords overlap 'bathroom/restroom',
    # so these cells must reach the LLM to be split into the new 'restroom' label.
    if attr == "accessibility":
        return False
    pat = STRONG.get(attr)
    return bool(pat and re.search(pat, evidence or "", re.I))


def collect_cells(rows):
    """Yield (row_index, attribute, polarity, evidence) for every attribute cell."""
    for i, r in enumerate(rows):
        for a in ATTRS:
            cell = (r.get("attributes") or {}).get(a)
            if isinstance(cell, dict):
                yield i, a, cell.get("polarity"), cell.get("evidence") or ""


# ---------------------------------------------------------------------------
LLM_PROMPT = """\
You are auditing extracted attribute labels for a study of NYC work/study venues.
Each item is one extracted claim: an ATTRIBUTE, a POLARITY, and the verbatim
EVIDENCE snippet it was drawn from. For each item decide what the evidence
ACTUALLY describes.

Attributes: noise, wifi, seating, outlets, crowding, accessibility,
laptop_friendly, price, hours. Plus:
  - "restroom"  -> the evidence is about toilet/bathroom availability (NOT
                   disability access). Use this for "has a bathroom" etc.
  - "none"      -> the evidence does not clearly describe any of the above.
Reserve "accessibility" for genuine disability access (wheelchair, ramp,
elevator, step-free, ADA), NOT bathrooms.

For each item return: id, the attribute the evidence truly describes (one of the
list above), and the correct polarity (positive / neutral / negative) given the
evidence. If the original attribute and polarity are already correct, return them
unchanged.

Items:
{items}
"""


def make_client():
    import instructor
    from anthropic import Anthropic
    return instructor.from_anthropic(Anthropic())


def build_models():
    from enum import Enum
    from pydantic import BaseModel

    class Attr(str, Enum):
        pass
    AttrEnum = Enum("AttrEnum", {t: t for t in TARGETS}, type=str)
    Pol = Enum("Pol", {p: p for p in ("positive", "neutral", "negative")}, type=str)

    class Verdict(BaseModel):
        id: int
        attribute: AttrEnum
        polarity: Pol

    class Batch(BaseModel):
        verdicts: list[Verdict]
    return Batch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Rule pre-pass only; no LLM, no changes.")
    ap.add_argument("--all", action="store_true",
                    help="Send EVERY cell to the LLM (skip the keyword auto-pass). "
                         "Also re-checks polarity on otherwise-confident cells.")
    ap.add_argument("--batch", type=int, default=25, help="Cells per LLM call.")
    ap.add_argument("--model", default="claude-haiku-4-5-20251001")
    args = ap.parse_args()

    rows = [json.loads(l) for l in DATA.read_text().splitlines() if l.strip()]
    cells = list(collect_cells(rows))
    if args.all:
        ok, review = [], cells
    else:
        ok = [c for c in cells if rule_ok(c[1], c[3])]
        review = [c for c in cells if not rule_ok(c[1], c[3])]
    print(f"attribute cells: {len(cells)}", file=sys.stderr)
    print(f"  rule-OK (auto-kept):     {len(ok)}", file=sys.stderr)
    print(f"  flagged for LLM review:  {len(review)}", file=sys.stderr)
    n_batches = (len(review) + args.batch - 1) // args.batch
    print(f"  -> ~{n_batches} Haiku calls (~{len(review)*40 + n_batches*400:,} tokens, well under $1)", file=sys.stderr)

    if args.dry_run:
        print("\n(dry run — no LLM, no changes written)", file=sys.stderr)
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY to run the LLM audit (or use --dry-run).")

    client = make_client()
    Batch = build_models()

    verdicts = {}   # cell-id -> (attribute, polarity)
    for b0 in range(0, len(review), args.batch):
        chunk = review[b0:b0 + args.batch]
        items = "\n".join(
            f"{j}. attribute={c[1]} polarity={c[2]} evidence=\"{c[3][:120]}\""
            for j, c in enumerate(chunk))
        try:
            res = client.chat.completions.create(
                model=args.model, response_model=Batch, max_tokens=2048,
                messages=[{"role": "user", "content": LLM_PROMPT.format(items=items)}])
            for v in res.verdicts:
                if 0 <= v.id < len(chunk):
                    verdicts[id(chunk[v.id])] = (v.attribute.value, v.polarity.value)
        except Exception as exc:
            print(f"  ! batch {b0//args.batch} failed: {exc}", file=sys.stderr)
        print(f"  audited {min(b0+args.batch, len(review))}/{len(review)}", file=sys.stderr)

    # apply
    changes = []
    for c in review:
        i, attr, pol, ev = c
        v = verdicts.get(id(c))
        if not v:
            continue
        new_attr, new_pol = v
        if new_attr == attr and new_pol == pol:
            continue
        cell = rows[i]["attributes"].pop(attr)               # remove from old attribute
        action = "drop" if new_attr == "none" else ("reassign" if new_attr != attr else "repolarise")
        if new_attr != "none":
            cell["polarity"] = new_pol
            rows[i]["attributes"][new_attr] = cell           # may create 'restroom'
        changes.append({"venue_raw": rows[i]["venue_raw"], "source_url": rows[i].get("source_url"),
                        "action": action, "attribute": attr, "new_attribute": new_attr,
                        "old_polarity": pol, "new_polarity": new_pol, "evidence": ev[:120]})

    DATA.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in changes) + "\n")

    from collections import Counter
    print(f"\nDone. cells changed: {len(changes)}  {dict(Counter(c['action'] for c in changes))}", file=sys.stderr)
    print(f"  reassigned to 'restroom': {sum(1 for c in changes if c['new_attribute']=='restroom')}", file=sys.stderr)
    print(f"  -> updated {DATA.name} + {LOG.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
