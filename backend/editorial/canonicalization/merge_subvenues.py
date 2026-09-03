"""
COMP47360 — Quiet Spaces Manhattan
Resolution fix-up: merge sub-venues into their parent + drop out-of-scope venues
--------------------------------------------------------------------------------
Google sometimes gives a room/space inside a larger venue its own place_id (e.g.
the Rose Main Reading Room sits inside NYPL Schwarzman). For a per-venue map those
should be ONE place. This remaps each sub-venue's resolution rows onto the parent
place_id (adopting the parent's name/address) so they aggregate together, and
drops a few venues that are out of scope (NYU-access, or non-workspace).

Matched by place_id suffix (last 6 chars are unique within this set). Writes back
to place_resolution.jsonl (backup place_resolution.premerge.jsonl) + a log.

Run from editorial/canonicalization/:  python merge_subvenues.py
"""
from __future__ import annotations
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
RES = HERE / "outputs" / "place_resolution.jsonl"
BACKUP = HERE / "outputs" / "place_resolution.premerge.jsonl"
LOG = HERE / "outputs" / "merge_log.jsonl"

# sub-venue place_id suffix -> parent place_id suffix (adopt parent identity)
MERGE = {
    "Pyh1mI": "G7fUTs",   # Rose Main Reading Room      -> NYPL Schwarzman (476 5th Ave)
    "ePZNzo": "VP9irE",   # Thomas Yoseloff Business Ctr-> Stavros Niarchos Foundation Library (455 5th Ave)
    "wSJ7qo": "n8RfU0",   # Lobby Bar at Ace Hotel      -> Ace Hotel New York (20 W 29th)
    "xGkCP4": "6sR9GQ",   # Church of the Heavenly Rest -> Church of Heavenly Rest Café (1085 5th Ave) [dedupe]
    "iMYNso": "xemSw8",   # Hudson Eats                 -> Brookfield Place (230 Vesey)
    "hhcoE4": "xemSw8",   # Winter Garden               -> Brookfield Place (230 Vesey)
}
# place_id suffix -> drop reason
DROP = {
    "1txePQ": "not a workspace (nail studio UES; weak source dearsundays.com)",
    "afqltE": "not a workspace (nail studio SoHo; weak source dearsundays.com)",
    "p9drIo": "not a workspace (wellness hub; weak source dearsundays.com)",
    "9rXyJk": "not a workspace (organic-meal spot; weak source dearsundays.com)",
    "7zWH44": "NYU Kimmel Center — student-access, out of scope",
    "JMdeL8": "Peet's inside NYU Kimmel; also mis-resolved from article's Union Square location",
}


def suff(pid): return (pid or "")[-6:]


def main() -> None:
    rows = [json.loads(l) for l in RES.read_text().splitlines() if l.strip()]
    # parent identity templates (from the parent's own rows)
    tmpl = {}
    for r in rows:
        s = suff(r.get("place_id"))
        if s in MERGE.values() and s not in tmpl:
            tmpl[s] = {k: r.get(k) for k in ("place_id", "place_name", "formatted_address",
                                             "lat", "lng", "types", "business_status")}
    log = []
    for r in rows:
        s = suff(r.get("place_id"))
        if s in MERGE:
            parent = tmpl[MERGE[s]]
            old = r.get("place_name")
            r.update(parent)
            r["resolved_via"] = "subvenue_merge"
            log.append({"action": "merge", "venue_raw": r["venue_raw"], "was": old,
                        "into": parent["place_name"]})
        elif s in DROP:
            r.update(manual_drop=True, needs_review=False, decision="drop", drop_reason=DROP[s])
            log.append({"action": "drop", "venue_raw": r["venue_raw"],
                        "place_name": r.get("place_name"), "reason": DROP[s]})

    if not BACKUP.exists():
        BACKUP.write_text(RES.read_text())
    RES.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    LOG.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in log) + "\n")

    from collections import Counter
    print("applied:", dict(Counter(c["action"] for c in log)))
    for c in log:
        if c["action"] == "merge":
            print(f"  merge  {c['venue_raw'][:26]:<26} {c['was'][:24]!r} -> {c['into'][:26]!r}")
    for c in log:
        if c["action"] == "drop":
            print(f"  drop   {c['place_name'][:30]:<30} {c['reason']}")


if __name__ == "__main__":
    main()
