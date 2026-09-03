"""
COMP47360 — Quiet Spaces Manhattan
Editorial URL Discovery via Brave Search API
--------------------------------------------

Discovers editorial article URLs about NYC workspaces using the Brave Search
API. This replaces the previous hand-curated URL list with a programmatic,
fully reproducible discovery stage, paralleling discover_reddit_urls.py in
the (now shelved) Reddit pipeline.

Output: a JSONL file with one row per unique editorial article URL.

    {
        "url":             "https://www.example-blog.com/best-cafes-nyc",
        "domain":          "www.example-blog.com",
        "title":           "Article title from Brave's snippet",
        "snippet":         "Preview text from Brave's index",
        "matched_queries": ["best cafes Manhattan", "best laptop cafes NYC"],
        "brave_rank":      3,
        "discovered_at":   "2026-06-10T..."
    }

Compliance posture:
  - Sanctioned third-party search (no Google scraping)
  - Exhausts a fixed, documented query template set; no adaptive loops
  - Filters out social/forum/Q&A/review domains so only editorial sources
    pass through (Reddit excluded since it's its own pipeline; Yelp excluded
    because it's reviews, not editorial)
  - The output is URLs only; the actual fetch happens in fetch_editorial_corpus.py

Authentication:
    BRAVE_API_KEY in .env (free tier: $5 prepaid monthly credit covers
    ~1000 searches; our ~23 queries use about $0.12 of it)

Dependencies:
    pip install requests python-dotenv

Run from inside editorial/:
    python discover_editorial_urls.py --output outputs/editorial_urls.jsonl

    # Smoke-test on the first 3 queries:
    python discover_editorial_urls.py --limit-queries 3
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

# Anchor paths to the script's directory so it works from any CWD.
HERE          = Path(__file__).resolve().parent       # editorial/discovery/
EDITORIAL_DIR = HERE.parent                           # editorial/
DEFAULT_OUTPUT = HERE / "outputs" / "editorial_urls.jsonl"

load_dotenv(EDITORIAL_DIR.parent / ".env")


# ---------------------------------------------------------------------------
# Query template set
# ---------------------------------------------------------------------------
# Phrased to surface editorial guide-style articles about NYC workspaces.
# No `site:` filter is applied — we want diverse sources. Non-editorial
# domains (Reddit, Quora, social, review sites) are filtered out after
# the search in the EXCLUDED_DOMAINS block below.

BASE_QUERIES = [
    # General city-wide workspace guides
    "best cafes to work in Manhattan",
    "best laptop friendly cafes NYC",
    "best coffee shops to work NYC",
    "best study spots Manhattan",
    "best places to study NYC",
    "best libraries to study NYC",
    "best cafes for remote work NYC",
    "quiet cafes Manhattan study",
    "best wifi cafes NYC",

    # University-adjacent (student audience) — explicit study intent on all
    # "cafes near X" patterns so we don't surface parent-visit / family-brunch
    # articles instead of student workspace pieces
    "best cafes to study near NYU",
    "best cafes to study near Columbia",
    "best study spots near NYU",
    "best study spots near Columbia",
    "best study spots near Hunter College",
    "best study spots near Baruch CUNY",

    # Additional universities (broader student demographic)
    "best cafes to study near The New School NYC",
    "best cafes to study near Pace University NYC",
    "best cafes to study near Fordham Lincoln Center",
    "best cafes to study near City College NYC",
    "best cafes to study near Pratt Manhattan",
    "best study spots CUNY Manhattan",

    # Neighbourhood-specific (Manhattan coverage) — alternating "to work" and
    # "study spots" framing both to add workspace intent (replacing the
    # generic "best cafes [district]" which surfaced brunch and date-night
    # pieces) and to diversify the queries themselves, so we hit slightly
    # different editorial pieces rather than over-fetching the same articles
    "best cafes to work Upper East Side NYC",
    "best study spots Upper West Side NYC",
    "best cafes to work East Village NYC",
    "best study spots Lower East Side NYC",
    "best cafes to work Chelsea NYC",
    "best study spots Midtown NYC",
    "best cafes to work Greenwich Village NYC",
    "best study spots Harlem NYC",

    # Additional sub-districts (spatial completeness) — same alternation
    "best cafes to work Financial District NYC",
    "best study spots Murray Hill NYC",
    "best cafes to work NoHo NYC",
    "best study spots NoLita NYC",
    "best cafes to work SoHo NYC",
    "best study spots Tribeca NYC",
    "best cafes to work Hells Kitchen NYC",
    "best study spots Battery Park City NYC",
    "best cafes to work Inwood NYC",
    "best study spots Washington Heights NYC",

    # Late-night / 24-hour (product differentiator: time-of-day filter)
    "best 24 hour cafes NYC",
    "best late night cafes NYC",
    "best all night cafes NYC",
    "best weekend study spots NYC",

    # Video-call / meeting friendly (different signal than "quiet for studying")
    "best cafes for Zoom calls NYC",
    "best cafes for video meetings NYC",
    "best cafes for Teams calls NYC",
    "best cafes with phone booths NYC",

    # Specialised study contexts
    "best group study cafes NYC",
    "best cafes for exam prep NYC",

    # Demographic / venue-type variations (different signal than student-focus)
    "best cafes for freelancers Manhattan",
    "best bookstore cafes to work NYC",
    "best cafes for writing NYC",
]


# ---------------------------------------------------------------------------
# Iter2 queries — targeted refinement based on yield data from iter1
# ---------------------------------------------------------------------------
# After running Stage 1 on the iter1 discovery, we measured per-query yields
# (kept / total). High-yield queries (≥60%) were dominated by three patterns:
#   • Explicit work framing: "for freelancers", "to work in", "for remote work"
#   • Amenity focus:         "wifi cafes", "laptop friendly"
#   • Geographic specificity in cafe-framed (not study-spots-framed) queries
# Low-yield queries (<25%) were dominated by:
#   • "Study spots near [University]" — surfaces campus-internal pages
#   • "24 hour" / "late night" — surfaces lifestyle/social rather than work
#   • "Bookstore cafes to work" — book-lover framing leakage
#
# Iter2 adds 10 queries: 3 city-wide variants of the highest-yielding patterns,
# and 7 geographic-gap fillers (neighborhoods that had a "study spots"
# variant but no "cafes for [work]" variant — the latter being the higher-
# yield pattern).
#
# Methodology note: this is a *single* informed iteration, not iterative
# refinement. The paper describes both rounds explicitly. We do NOT remove
# the iter1 low-yield queries — their inclusion is part of the unaltered
# initial discovery record.

ITER2_QUERIES = [
    # ─── City-wide variants of the top-3 highest-yielding iter1 patterns ───
    "best cafes for freelancers NYC",
    "best cafes for remote work Manhattan",
    "best laptop cafes Manhattan",
    "best cafes Manhattan with outlets and wifi",

    # ─── Geographic-gap fillers (first batch) — neighborhoods covered by ───
    # "study spots near X" in iter1 but not by the higher-yield
    # "cafes for [work framing] X" pattern
    "best cafes for remote work Upper West Side",
    "best cafes for remote work Harlem NYC",
    "best cafes for remote work Lower East Side NYC",
    "best cafes for remote work Tribeca NYC",
    "best cafes for remote work Murray Hill NYC",
    "best laptop friendly cafes Midtown NYC",

    # ─── Geographic-gap fillers (second batch) — neighborhoods not yet ───
    # covered by either iter1 or the first batch above
    "best cafes for remote work Flatiron NYC",      # work-hub neighborhood
    "best cafes for remote work Gramercy NYC",      # residential cafe-heavy
    "best cafes for remote work NoLita NYC",        # only "study spots" in iter1
    "best cafes for remote work Hudson Yards NYC",  # newest commercial area

    # ─── Framing variants of empirically-validated high-yield patterns ───
    # Different vocabulary likely surfaces different editorial sources than
    # iter1's "cafes to work" / "cafes for freelancers" templates
    "best cafes for digital nomads NYC",
    "best work-friendly cafes Manhattan",
    "best quiet cafes Manhattan for work",

    # ─── Library expansion — iter1 had only "best libraries to study NYC" ───
    # (55% yield); explicit Manhattan + studying framing should surface
    # workspace-relevant library content
    "best Manhattan libraries for studying",
]


# ---------------------------------------------------------------------------
# Domain exclusion list
# ---------------------------------------------------------------------------
# Brave's index returns a mix of editorial and non-editorial sources for these
# queries. We explicitly drop:
#  - Reddit (handled by the dedicated Reddit pipeline if reactivated)
#  - Quora (Q&A, similar to Reddit but treated separately)
#  - Social media (TikTok, X, Instagram, Facebook, Pinterest, LinkedIn,
#    YouTube — short-form / interaction-driven, not editorial)
#  - Reviews (Yelp, TripAdvisor, Foursquare — user reviews, not editorial
#    guides; would dilute the corpus with low-signal content)

EXCLUDED_DOMAINS = {
    "reddit.com", "old.reddit.com",
    "quora.com",
    "tiktok.com",
    "twitter.com", "x.com",
    "instagram.com",
    "facebook.com",
    "youtube.com", "m.youtube.com",
    "pinterest.com",
    "linkedin.com",
    "yelp.com",
    "tripadvisor.com",
    "foursquare.com",
    "lemon8-app.com",
}


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BRAVE_ENDPOINT     = "https://api.search.brave.com/res/v1/web/search"
RESULTS_PER_QUERY  = 20
RATE_LIMIT_SECONDS = 1.1
REQUEST_TIMEOUT    = 30

# Recency window for editorial articles. 5 years balances "recent enough that
# venues haven't all closed" against "old enough to include canonical guides
# that get cited and re-shared". Café-recommendation articles age slowly (a
# 2021 piece is still substantially accurate), and the 2021–2022 vintage
# specifically covers the post-lockdown 'cafés as workspaces' editorial wave,
# which is directly the signal we want. Override via --freshness-years on
# the CLI; set to 0 to disable the time filter entirely.
DEFAULT_FRESHNESS_YEARS = 5


def freshness_range(years: int) -> str:
    """Build Brave's custom freshness parameter: YYYY-MM-DDtoYYYY-MM-DD."""
    today = date.today()
    try:
        start = today.replace(year=today.year - years)
    except ValueError:
        # Handles 2024-02-29 -> 2020-02-29 if non-leap; fall back to Mar 1
        start = today.replace(year=today.year - years, day=28)
    return f"{start.isoformat()}to{today.isoformat()}"

USER_AGENT = (
    "COMP47360-QuietSpaces/1.0 "
    "(UCD MSc CS Conversion academic research; "
    "contact: z8110@hotmail.com)"
)


# ---------------------------------------------------------------------------
# Brave client
# ---------------------------------------------------------------------------

def search_brave(query: str, api_key: str,
                 freshness: str | None = None,
                 goggle_url: str | None = None,
                 count: int = RESULTS_PER_QUERY) -> list[dict]:
    """One Brave Web Search API call; returns the list of web results.

    `freshness` — Brave's native date-range filter ('YYYY-MM-DDtoYYYY-MM-DD'
                  for custom, or 'pd'/'pw'/'pm'/'py' for past day/week/etc).

    `goggle_url` — Optional URL of a public .goggle file. When provided,
                   Brave applies the goggle's $discard/$boost rules at the
                   ranking layer. For this project we use a discards-only
                   goggle to push forum/social/review domains out of the
                   top-20 so editorial sources fill the slots."""
    params = {
        "q":           query,
        "count":       count,
        "search_lang": "en",
        "country":     "US",
        "safesearch":  "moderate",
    }
    if freshness:
        params["freshness"] = freshness
    if goggle_url:
        # Brave deprecated `goggles_id` in favour of `goggles` (which accepts
        # either a URL or the goggle definition inline, and supports up to 3
        # goggles as a list). The old name is silently ignored, which is why
        # initial runs showed no goggle effect.
        params["goggles"] = goggle_url

    response = requests.get(
        BRAVE_ENDPOINT,
        headers={
            "Accept":               "application/json",
            "Accept-Encoding":      "gzip",
            "X-Subscription-Token": api_key,
            "User-Agent":           USER_AGENT,
        },
        params=params,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get("web", {}).get("results", [])


# ---------------------------------------------------------------------------
# Domain filtering
# ---------------------------------------------------------------------------

def normalize_domain(url: str) -> str:
    """Lowercase, strip 'www.' prefix from the URL's netloc."""
    netloc = urlparse(url).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def is_excluded(url: str) -> bool:
    """True if the URL's domain matches an exclusion or any of its subdomains."""
    domain = normalize_domain(url)
    if domain in EXCLUDED_DOMAINS:
        return True
    # Also catch subdomains (e.g., 'm.youtube.com')
    for excluded in EXCLUDED_DOMAINS:
        if domain.endswith(f".{excluded}"):
            return True
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                   help=f"(default {DEFAULT_OUTPUT})")
    p.add_argument("--limit-queries", type=int, default=None,
                   help="Smoke-test mode: only run the first N queries.")
    p.add_argument("--queries-set", choices=["base", "iter2", "all"],
                   default="base",
                   help="Which query set to use. 'base' (default) = the "
                        "original BASE_QUERIES from initial discovery. "
                        "'iter2' = only the 10 yield-refined queries. "
                        "'all' = both, concatenated.")
    p.add_argument("--freshness-years", type=int, default=DEFAULT_FRESHNESS_YEARS,
                   help=f"Recency window in years (default {DEFAULT_FRESHNESS_YEARS}). "
                        "Set to 0 to disable the time filter entirely.")
    p.add_argument("--goggle-url", default=os.environ.get("EDITORIAL_GOGGLE_URL"),
                   help="Optional public URL of a .goggle file. When set, Brave "
                        "applies the goggle's discard/boost rules at ranking time. "
                        "Defaults to the EDITORIAL_GOGGLE_URL env var if set in .env.")
    args = p.parse_args()

    api_key = os.environ.get("BRAVE_API_KEY")
    if not api_key:
        sys.exit("Missing BRAVE_API_KEY. Add to .env.")

    freshness = freshness_range(args.freshness_years) if args.freshness_years > 0 else None
    if freshness:
        print(f"Freshness filter: {freshness} ({args.freshness_years}-year window)",
              file=sys.stderr)
    if args.goggle_url:
        print(f"Goggle applied:   {args.goggle_url}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.queries_set == "base":
        queries_pool = BASE_QUERIES
    elif args.queries_set == "iter2":
        queries_pool = ITER2_QUERIES
    else:  # "all"
        queries_pool = BASE_QUERIES + ITER2_QUERIES
    queries = queries_pool[: args.limit_queries] if args.limit_queries else queries_pool
    print(f"Query set: {args.queries_set} ({len(queries)} queries)", file=sys.stderr)

    urls: dict[str, dict] = {}
    total_calls = 0
    failed_calls = 0
    total_results = 0
    excluded_results = 0

    print(f"Running {len(queries)} Brave queries...", file=sys.stderr)

    for i, query in enumerate(queries, 1):
        print(f"  [{i:>2d}/{len(queries)}] {query}", file=sys.stderr)
        try:
            results = search_brave(query, api_key,
                                   freshness=freshness,
                                   goggle_url=args.goggle_url)
            total_calls += 1
            total_results += len(results)
        except requests.exceptions.RequestException as exc:
            print(f"      ! Brave error: {exc}", file=sys.stderr)
            failed_calls += 1
            time.sleep(RATE_LIMIT_SECONDS)
            continue

        kept_this_query = 0
        for rank, hit in enumerate(results, start=1):
            url = hit.get("url", "")
            if not url:
                continue
            if is_excluded(url):
                excluded_results += 1
                continue

            domain = normalize_domain(url)
            now_iso = datetime.now(timezone.utc).isoformat()

            if url in urls:
                row = urls[url]
                if query not in row["matched_queries"]:
                    row["matched_queries"].append(query)
                if rank < row["brave_rank"]:
                    row["brave_rank"] = rank
            else:
                urls[url] = {
                    "url":             url,
                    "domain":          domain,
                    "title":           hit.get("title", ""),
                    "snippet":         hit.get("description", ""),
                    "matched_queries": [query],
                    "brave_rank":      rank,
                    "discovered_at":   now_iso,
                }
                kept_this_query += 1
        print(f"      {kept_this_query} new editorial URLs kept "
              f"({len(results) - kept_this_query} duplicates/excluded)",
              file=sys.stderr)

        time.sleep(RATE_LIMIT_SECONDS)

    with args.output.open("w") as f:
        for row in urls.values():
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(file=sys.stderr)
    print("Done.", file=sys.stderr)
    print(f"  Brave queries run:       {total_calls}", file=sys.stderr)
    print(f"  Failed queries:          {failed_calls}", file=sys.stderr)
    print(f"  Total results inspected: {total_results}", file=sys.stderr)
    print(f"  Excluded (social etc.):  {excluded_results}", file=sys.stderr)
    print(f"  Unique editorial URLs:   {len(urls)}", file=sys.stderr)
    print(f"  → {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
