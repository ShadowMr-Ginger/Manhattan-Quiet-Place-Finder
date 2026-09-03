"""
COMP47360 — Quiet Spaces Manhattan
Shared scope filter for the canonicalization stage.
---------------------------------------------------
A mention is OUT of scope (not resolved to a place_id, not aggregated) if ANY:
  - work_context == false                 (not a workspace; incl. transit hubs)
  - venue_category in museum / outdoor / coworking_paid / private_library /
                      university_library  (unsuitable, or restricted by type)
  - access == "restricted"                (membership / fee / student-ID)
  - is_chain_generic == true              (no single branch -> unresolvable;
                                           multi-branch mentions were folded into
                                           this flag at the cleaning stage)
  - mention_type != "featured"            (stricter corpus: a venue must earn a
                                           real write-up, not a one-line passing
                                           or comparison mention)

Every rule keys on a PERSISTENT field set at the cleaning stage
(extraction/resolve_venues.py) — restricted libraries are re-tagged to the right
out-of-scope category there, so there is no separate name-pattern gazetteer.

resolve_places.py and aggregate_venues.py BOTH import in_scope()/drop_reason()
from here so their filtering is guaranteed identical.
"""
import re

OUT_OF_SCOPE_CATEGORIES = {
    "museum", "outdoor", "coworking_paid", "private_library", "university_library",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (s or "").lower())).strip()


def drop_reason(row: dict):
    """Return why a mention is out of scope, or None if it is resolvable."""
    if row.get("work_context") is False:
        return "work_context_false"
    if row.get("venue_category") in OUT_OF_SCOPE_CATEGORIES:
        return "out_of_scope_category"
    if row.get("access") == "restricted":
        return "access_restricted"
    if row.get("is_chain_generic"):          # includes folded multi-branch
        return "chain_generic"
    if row.get("mention_type") != "featured":  # stricter corpus: featured write-ups only
        return "not_featured"
    return None


def in_scope(row: dict) -> bool:
    return drop_reason(row) is None
