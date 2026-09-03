"""
COMP47360 — Quiet Spaces Manhattan
Venue resolution & data cleaning (Stage-2 post-processing).
-----------------------------------------------------------
Start from the RAW Stage-2 output (extractions.jsonl) and apply ONLY the
hand-verified resolutions, leaving the row count and field schema untouched
(no rows dropped, nothing split, no bookkeeping flags added):

  * 12 venue-name corrections   — garbled/missing names + descriptive non-names
                                  resolved to real names + addresses
  * 11 auto-resolved generics   — chain mentions the article points to one branch
  *  4 manual-review promotions  — generics confirmed to a single branch by hand
  *  8 flagship library defaults — bare system names (NYPL/BPL/Queens) with no
                                  branch in the article -> the flagship branch
  *  2 transit hubs excluded     — Penn Station / Grand Central set work_context
                                  =false (charging stops, not workspaces)
  * multi-branch mentions        — locations listing >=2 branches are folded into
                                  is_chain_generic=true (chain-level: one author
                                  naming several branches can't map to one place)

Output: extractions_final.jsonl (37 targeted fixes + multi-branch folding).

Run from editorial/extraction/:  python resolve_venues.py
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC  = HERE / "outputs" / "extractions.jsonl"          # raw Stage 2
OUT  = HERE / "outputs" / "extractions_final.jsonl"

# 5 name corrections, matched on a distinctive substring of the ORIGINAL venue_raw
NAME_FIXES = [
    ("unnamed East Harlem spot",            {"venue_raw": "El Barrista",        "location_context": "2154 Third Ave, East Harlem, New York, NY 10035"}),
    ("coffee shop in the bottom of a FiDi",  {"venue_raw": "Conwell Coffee Hall","location_context": "6 Hanover St, New York, NY 10005"}),
    ("Joe & the Juice (any location",        {"venue_raw": "Joe & the Juice",    "location_context": "67 Spring St, SoHo, New York, NY 10012", "is_chain_generic": False}),
    ("unnamed cafe that turns into a bar",   {"venue_raw": "Sunrise/Sunset",     "location_context": "351 Evergreen Ave, Brooklyn, NY 11221"}),
    ("<UNKNOWN>",                            {"venue_raw": "Cafe W",             "location_context": "35-27 154th Street, Flushing, NY 11354"}),
    # descriptive non-names surfaced by the <0.6 review pass, resolved from articles
    ("unmarked door on Bowery",             {"venue_raw": "Silence Please",     "location_context": "132 Bowery Fl 2, New York, NY 10013"}),
    ("horror-centric bookstore",            {"venue_raw": "The Twisted Spine",  "location_context": "306 Grand St, Brooklyn, NY 11211"}),
    ("Greenpoint nonalcoholic bar",         {"venue_raw": "Soft Bar",           "location_context": "200 Banker St, Brooklyn, NY 11222"}),
    ("all-day cafe in The Refinery",        {"venue_raw": "Birdee",             "location_context": "316 Kent Ave, Brooklyn, NY 11249"}),
    ("charming Long Island City",           {"venue_raw": "Overflow Coffee",    "location_context": "46-36 Vernon Blvd, Long Island City, NY 11101"}),
    ("neighborhood cafe in Astoria",        {"venue_raw": "Verse Cafe",         "location_context": "28-13 Astoria Blvd, Long Island City, NY 11102"}),
    ("Tibetan cafe",                        {"venue_raw": "Ngatso Cafe",        "location_context": "39-08 63rd St, Woodside, NY 11377"}),
]

# Out-of-scope transit hubs (charging stops, not workspaces) -> mark
# work_context=False so the canonicalization scope filter drops them.
TRANSIT_OUT = {"Penn Station", "Grand Central"}

# Category corrections for restricted libraries the LLM mis-tagged as plain
# library/coffee_shop/bookstore_cafe. Re-tagging them to the right out-of-scope
# category lets the scope filter drop them BY CATEGORY (deterministic) and
# removes the need for a separate name-pattern gazetteer. (substring, category)
CATEGORY_FIX = [
    ("Jack Brause", "university_library"),
    ("NYU Bobst", "university_library"),
    ("Morgan Library", "museum"),
    ("National Archives", "private_library"),
    ("Academy of Medicine", "private_library"),
    ("Society Library", "private_library"),
    ("Center for Fiction", "private_library"),
    ("Center of Fiction", "private_library"),
    ("Othmer", "private_library"),
]

# 11 auto-resolved generics, matched on exact (venue_raw, original location_context)
AUTO = {
    ("Joe Coffee", "West Village original location"):       {"location_context": "West Village, New York, NY"},
    ("Perk Kafe", "East Village"):                          {"location_context": "534 E 14th St, East Village, New York, NY 10009"},
    ("Coffee Project", "5th Ave, not too far from Bowery"): {"location_context": "239 E 5th St, East Village, New York, NY 10003"},
    ("Stumptown Coffee Roaster", "Cobble Hill, Brooklyn"):  {"location_context": "Cobble Hill, Brooklyn, NY"},
    ("The Oasis Cafe", "Astoria, Queens"):                  {"location_context": "Astoria, Queens, NY"},
    ("Think Coffee", "Tribeca, near One Pace Plaza"):       {"location_context": "Tribeca, New York, NY"},
    ("2nd floor Starbucks on Dey St", "Dey St"):           {"venue_raw": "Starbucks", "location_context": "Dey St, Financial District, New York, NY"},
    ("Everyman Espresso", "SoHo"):                          {"location_context": "SoHo, New York, NY"},
    ("Cafe Grumpy", "Greenpoint"):                          {"location_context": "Greenpoint, Brooklyn, NY"},
    ("La Colombe Coffee Roasters", "Tribeca"):             {"location_context": "Tribeca, New York, NY"},
    ("Buunni Coffee", "Northern Manhattan, Inwood"):        {"location_context": "Inwood, New York, NY"},
}

# 4 manual-review promotions, matched on (exact source_url path, venue_raw)
MANUAL = {
    ("studynearme.com/blog/remote-work-new-york-ny-2025", "Ace Hotel"):                 "20 W 29th St, NoMad, New York, NY 10001",
    ("resident.com/resource-guide/2024/10/15/the-best-libraries", "New York Public Library"): "476 5th Ave (Stephen A. Schwarzman Building), New York, NY 10018",
    ("nosleep.city/best-coffee-shops-to-work-in-manhattan", "Think Coffee"):            "248 Mercer St, New York, NY 10012",
    ("nosleep.city/best-coffee-shops-to-work-in-manhattan", "Gregorys Coffee"):         "58 W 44th St, New York, NY 10036",
}

# Flagship default for BARE system-level library names (no branch found in the
# article), keyed (source_url, venue_raw). Only applied when the row has no
# address in its location_context.
_NYPL = "476 5th Ave (Stephen A. Schwarzman Building), New York, NY 10018"
_BPL  = "10 Grand Army Plaza (Central Library), Brooklyn, NY 11238"
_QPL  = "89-11 Merrick Blvd (Queens Central Library), Jamaica, NY 11432"
FLAGSHIP = {
    ("https://www.hercampus.com/school/the-new-school/the-best-places-to-study-in-nyc/", "The New York Public Library"): _NYPL,
    ("https://resident.com/resource-guide/2024/10/15/the-best-libraries-for-students-in-new-york-city", "Queens Library"): _QPL,
    ("https://en.uhomes.com/blog/best-libraries-in-nyc", "Brooklyn Public Library"): _BPL,
    ("https://www.casita.com/blog/top-public-libraries-in-new-york-city", "New York Public Library"): _NYPL,
    ("https://www.casita.com/blog/top-public-libraries-in-new-york-city", "Brooklyn Public Library"): _BPL,
    ("https://amberstudent.com/blog/post/explore-best-libraries-in-new-york-a-readers-retreat", "Queens Library"): _QPL,
    ("https://www.timeout.com/newyork/things-to-do/most-gorgeous-nyc-libraries", "New York Public Library"): _NYPL,
    ("https://studynearme.com/blog/remote-work-new-york-ny-2025/", "The New York Public Library"): _NYPL,
}


# Multi-branch detector: a mention whose location lists >=2 branches (>=2 street
# addresses, or >=2 neighbourhoods) is chain-level like a generic mention — it
# can't resolve to a single place_id — so it is folded into is_chain_generic.
_TOK = r"(?:[A-Z][\w.\']*|\d+(?:st|nd|rd|th))"
_SUF = (r"(?:St|Street|Ave|Avenue|Blvd|Boulevard|Broadway|Pl|Place|Rd|Road|"
        r"Way|Sq|Square|Ln|Lane|Plaza|Pkwy|Parkway)")
_ADDR = re.compile(rf"\d{{1,4}}(?:-\d{{1,4}})?\s+(?:{_TOK}\s+){{0,4}}{_SUF}\b")
_NB = ['williamsburg', 'flatiron', 'soho', 'tribeca', 'chelsea', 'east village',
       'west village', 'union square', 'midtown', 'greenpoint', 'astoria', 'harlem',
       'dumbo', 'lower east side', 'upper east side', 'upper west side', 'nolita',
       'greenwich village', 'financial district', 'bushwick', 'park slope', 'gramercy',
       'inwood', 'murray hill', 'downtown brooklyn', 'fort greene', 'prospect heights',
       'nomad', 'hudson yards', 'morningside heights', 'long island city']


_MULTI_KW = re.compile(r"\bmultiple\b|\bbranches\b|\blocations\b|\boutposts\b", re.I)


def is_multi_branch(loc: str) -> bool:
    """A mention names several branches -> can't map to one place. RELIABLE
    signals only: >=2 distinct street addresses, OR >=3 distinct neighbourhoods,
    OR an explicit multi-location phrase ('multiple', 'branches', 'locations',
    'outposts') alongside >=2 neighbourhoods. A bare two-neighbourhood descriptor
    ('Greenwich Village / West Village', 'Gramercy - Flatiron') is NOT folded —
    that is usually ONE venue described loosely or by cross-street."""
    loc = loc or ""
    if len(set(_ADDR.findall(loc))) >= 2:
        return True
    n_nb = sum(1 for x in _NB if x in loc.lower())
    if n_nb >= 3:
        return True
    return bool(_MULTI_KW.search(loc)) and n_nb >= 2


def main() -> None:
    raw = [json.loads(l) for l in SRC.read_text().splitlines() if l.strip()]
    changed = 0
    auto_log, manual_log, name_log, flagship_log, transit_log, multibranch_log, cat_log = [], [], [], [], [], [], []
    for r in raw:
        u, v, loc = r.get("source_url", ""), r.get("venue_raw", ""), r.get("location_context")
        # name fixes
        for needle, vals in NAME_FIXES:
            if needle.lower() in (v or "").lower():
                r.update(vals); changed += 1
                name_log.append((vals["venue_raw"], r["location_context"], u)); break
        else:
            # generic->specific resolutions apply ONLY to rows still marked generic
            if r.get("is_chain_generic"):
                if (v, loc) in AUTO:
                    r.update(AUTO[(v, loc)]); r["is_chain_generic"] = False; changed += 1
                    auto_log.append((r["venue_raw"], r["location_context"], u))
                else:
                    for (usub, vraw), newloc in MANUAL.items():
                        if usub in u and v == vraw:
                            r["location_context"] = newloc; r["is_chain_generic"] = False; changed += 1
                            manual_log.append((r["venue_raw"], newloc, u)); break
        # flagship default for bare system-level libraries (no branch in article)
        if (u, v) in FLAGSHIP and not any(c.isdigit() for c in (r.get("location_context") or "")):
            r["location_context"] = FLAGSHIP[(u, v)]; r["is_chain_generic"] = False; changed += 1
            flagship_log.append((v, FLAGSHIP[(u, v)], u))
        # exclude out-of-scope transit hubs (not workspaces)
        if v in TRANSIT_OUT and r.get("work_context"):
            r["work_context"] = False; changed += 1
            transit_log.append((v, u))
        # fold multi-branch mentions into is_chain_generic (chain-level: one author
        # naming several branches -> cannot resolve to a single place_id)
        if not r.get("is_chain_generic") and is_multi_branch(r.get("location_context")):
            r["is_chain_generic"] = True; changed += 1
            multibranch_log.append((v, r.get("location_context"), u))
        # correct mis-tagged restricted libraries -> dropped by category downstream
        for needle, cat in CATEGORY_FIX:
            if needle.lower() in (v or "").lower() and r.get("venue_category") != cat:
                r["venue_category"] = cat; changed += 1
                cat_log.append((v, cat)); break

    OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in raw) + "\n")

    # ---- verification ----
    raw_keys = set().union(*[set(json.loads(l)) for l in SRC.read_text().splitlines() if l.strip()])
    out_keys = set().union(*[set(r) for r in raw])
    print(f"rows: {len(raw)} (raw stage-2 = unchanged count)", file=sys.stderr)
    print(f"rows edited: {changed}  (37 fixed + {len(multibranch_log)} multi-branch folded into is_chain_generic)", file=sys.stderr)
    print(f"extra keys vs raw (should be none): {out_keys - raw_keys or '{}'}", file=sys.stderr)
    print(f"-> {OUT.name}", file=sys.stderr)
    print("\n=== AUTO-RESOLVED GENERICS (for your review) ===", file=sys.stderr)
    for v, l, u in auto_log:
        print(f"  {v:<26} {l:<42} {u}", file=sys.stderr)
    print("\n=== FLAGSHIP-DEFAULTED SYSTEM LIBRARIES (no branch in article) ===", file=sys.stderr)
    for v, l, u in flagship_log:
        print(f"  {v:<28} {l}", file=sys.stderr)
    print("\n=== TRANSIT HUBS EXCLUDED (work_context=false) ===", file=sys.stderr)
    for v, u in transit_log:
        print(f"  {v}", file=sys.stderr)
    print(f"\n=== MULTI-BRANCH FOLDED into is_chain_generic ({len(multibranch_log)}) ===", file=sys.stderr)
    for v, l, u in multibranch_log[:10]:
        print(f"  {v[:24]:<24} {str(l)[:50]}", file=sys.stderr)
    print(f"\n=== RESTRICTED-LIBRARY CATEGORY FIXES ({len(cat_log)}) ===", file=sys.stderr)
    for v, c in cat_log:
        print(f"  {v[:40]:<40} -> {c}", file=sys.stderr)


if __name__ == "__main__":
    main()
