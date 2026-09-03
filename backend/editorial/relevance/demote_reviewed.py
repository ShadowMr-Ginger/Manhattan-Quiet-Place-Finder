"""
COMP47360 — Quiet Spaces Manhattan
Stage 1 post-review demotion (v3.1 + raised review threshold)
-------------------------------------------------------------

Removes 26 articles from relevant_articles.jsonl after manual review of
the needs_review band (expanded to [0.50, 0.75) under the raised review
threshold).

Demotion categories:
  - 19 articles where article framing failed v3.1's work-context portrayal
    criterion under manual review (food/coffee-quality, aesthetic, or
    lifestyle framing dominated the workspace mentions).
  -  5 articles flagged by the LLM's own reasoning as borderline framing
    (LLM admitted "food focus", "aesthetic framing", or "coffee-quality
    descriptions dominant").
  -  2 articles that passed v3.1 framing but failed the project's
    venue-suitability criterion: Girls Write Now ("Free Writing Spots")
    covers museum lobbies and park benches not suitable for laptop work,
    and NYCITYWOMAN ("Private Libraries in NYC") covers fee-paying
    membership libraries outside the project's free-public-workspace scope.

After this script, relevant_articles.jsonl contains 97 articles ready
for Stage 2.

Run from inside editorial/relevance/:
    python demote_reviewed.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PATH = HERE / "outputs" / "relevant_articles.jsonl"

# All 26 URLs to demote, categorised for the methodology trail
DEMOTE_URLS = {
    # ─── Framing failure: food / coffee-quality / aesthetic / lifestyle ───
    "https://meet.nyu.edu/life/local-bagels-and-coffee-first-year/",
    "https://fordhamobserver.com/77919/opinions/my-favorite-coffee-shops-near-fordham-lc/",
    "https://www.abroadwithash.com/the-best-coffee-shops-on-the-ues-nyc/",
    "https://www.belaroundtheworld.com/best-coffee-shops-nyc-usa/",
    "https://www.coffeeandchampagne.com/nyc-guides/the-most-beautiful-cafes-in-manhattan",
    "https://writingtipsoasis.com/best-public-libraries-in-nyc/",
    "https://www.caseylavie.com/best-libraries-in-nyc/",
    "https://uppereastsideandbeyond.com/upper-east-side-cafes-and-coffee-shops/",
    "https://abritandasoutherner.com/best-coffee-shops-in-chelsea-nyc/",
    "https://www.glazerteam.com/news/the-best-cafes-in-greenwich-village",
    "https://niceguytours.com/the-best-coffee-shops-in-greenwich-village/",
    "https://www.yourlocalsguide.com/best-coffee-shops-west-village/",
    "https://charmedbycamille.com/best-coffee-shops-in-the-west-village/",
    "https://ny.eater.com/maps/coffee-bars-west-village",
    "https://monaghansrvc.com/post/14-best-coffee-shops-in-financial-district-new-york-city.p1356",
    "https://www.theinfatuation.com/new-york/guides/coffee-shops-that-serve-great-food-nyc",
    "https://www.coolstuff.nyc/best-of/best-all-day-cafes",
    "https://i-love-coffee-nyc.com/coffee-houses-off-6th-and-79th-st-nyc/",
    "https://www.bestofnewyorkcity.com/best-public-library-manhattan/",

    # ─── LLM-self-flagged borderlines (LLM reasoning admitted issues) ───
    "https://www.787coffee.com/blog/study-cafe-nyc-student-spaces",
    "https://www.yourlocalsguide.com/best-coffee-shops-east-village/",
    "https://monaghansrvc.com/post/23-charming-coffee-shops-in-chelsea-new-york-city.p204",
    "https://serenaslenses.net/plants-and-flower-cafes-in-nyc/",
    "https://monaghansrvc.com/post/13-most-favorite-coffee-shops-in-hell-s-kitchen-new-york-city.p124",

    # ─── Venue-suitability failure: venues outside project scope ───
    "https://girlswritenow.org/news/free-writing-spots/",          # parks / museums
    "https://www.nycitywoman.com/private-libraries-in-new-york-city/",  # fee-paying
}


def main() -> None:
    if not PATH.exists():
        raise SystemExit(f"File not found: {PATH}")

    before_total = 0
    kept_lines = []
    found_urls = set()

    for line in PATH.read_text().splitlines():
        if not line.strip():
            continue
        before_total += 1
        row = json.loads(line)
        url = row.get("url", "")
        if url in DEMOTE_URLS:
            found_urls.add(url)
            continue
        kept_lines.append(line)

    missing = DEMOTE_URLS - found_urls
    if missing:
        print("WARNING — these demotion URLs were not found in the file:")
        for u in sorted(missing):
            print(f"  - {u}")
        print("(They may already have been removed in a prior run.)")
        print()

    tmp = PATH.with_suffix(PATH.suffix + ".tmp")
    tmp.write_text("\n".join(kept_lines) + "\n")
    tmp.replace(PATH)

    after_total = len(kept_lines)
    needs_review = sum(
        1 for line in kept_lines
        if json.loads(line).get("needs_review") is True
    )

    print(f"Demotions found and applied: {len(found_urls)}")
    print()
    print(f"Before: {before_total} articles")
    print(f"After:  {after_total} articles")
    print(f"  needs_review remaining: {needs_review}")
    print()
    print(f"Wrote {PATH}")


if __name__ == "__main__":
    main()
