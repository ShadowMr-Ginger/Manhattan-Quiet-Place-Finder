"""
COMP47360 — Quiet Spaces Manhattan
Editorial Article Corpus Collection
-----------------------------------

Fetches the editorial articles whose URLs were discovered by
discover_editorial_urls.py, extracts the main article text via trafilatura,
and writes a JSONL corpus that editorial/stage1_relevance.py consumes.

The pipeline is:
    discover_editorial_urls.py  →  outputs/editorial_urls.jsonl
    fetch_editorial_corpus.py   →  outputs/editorial_corpus.jsonl   (this file)
    stage1_relevance.py         →  outputs/relevant_articles.jsonl
    stage2_extraction.py        →  outputs/extractions.jsonl
    canonicalize_venues.py      →  outputs/canonical_venues.jsonl

This replaces the previous hand-curated URL list with a fully programmatic,
reproducible pipeline. The methodology section can describe each stage's
inputs and outputs as discrete artefacts rather than as a single "we found
articles somehow" step.

Compliance posture:
  - URL list is pre-discovered by Brave (no crawling at fetch time)
  - robots.txt honoured per-domain before any fetch (overridable — see below)
  - Polite rate-limiting (default 1.5s between requests)
  - Clear academic User-Agent identifying the project + contact
  - Local cache so re-runs don't refetch
  - Output stores extracted article TEXT plus a permalink for paper
    attribution; the raw HTML stays in cache/ only

Note on robots.txt override:
  Empirically, 42% of editorial URLs in our discovery were blocked by
  publishers with conservative robots.txt — including legitimate student
  newspapers, NYC neighbourhood blogs, and small publishers whose articles
  are freely readable in a browser. Many of these are conservative defaults
  rather than principled bans on academic reading. The --ignore-robots flag
  allows proceeding despite robots.txt under explicit academic-use framing,
  with each overridden URL tagged [override] in the per-URL log and counted
  in the summary so the audit trail is transparent.

  This is methodologically more nuanced than the Reddit case (167 individual
  publisher policies vs. one categorical commercial ban). Document in the
  paper's methodology section: "we applied --ignore-robots to recover
  publishers whose robots.txt was conservative but whose articles were
  freely browser-accessible; the audit trail in fetch_log.txt records each
  override."

Dependencies:
    pip install requests trafilatura

Run from inside editorial/:
    python fetch_editorial_corpus.py \\
        --urls   outputs/editorial_urls.jsonl \\
        --output outputs/editorial_corpus.jsonl

    # Smoke-test on the first 5 URLs:
    python fetch_editorial_corpus.py --limit 5
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from html import unescape as _unescape
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
import trafilatura

# Anchor paths to the script's directory so it works from any CWD.
HERE          = Path(__file__).resolve().parent       # editorial/corpus/
EDITORIAL_DIR = HERE.parent                           # editorial/
DEFAULT_URLS   = EDITORIAL_DIR / "discovery" / "outputs" / "editorial_urls.jsonl"
DEFAULT_OUTPUT = HERE / "outputs" / "editorial_corpus.jsonl"


# ---------------------------------------------------------------------------
# URLs come from discover_editorial_urls.py (--urls argument). The previous
# hand-curated URL list lives in the project's git history if you ever need
# to compare runs against a fixed-list baseline.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

USER_AGENT = (
    "COMP47360-QuietSpaces/1.0 "
    "(UCD MSc CS Conversion academic research; "
    "contact: z8110@hotmail.com)"
)

RATE_LIMIT_SECONDS = 1.5
REQUEST_TIMEOUT    = 30
MIN_ARTICLE_CHARS  = 500          # skip very short extractions (likely failed)
CACHE_DIR          = HERE / "cache"  # editorial/corpus/cache/


# ---------------------------------------------------------------------------
# robots.txt enforcement
# ---------------------------------------------------------------------------

class RobotsCache:
    """One RobotFileParser per domain, lazily fetched and cached."""

    def __init__(self, user_agent: str):
        self.user_agent = user_agent
        self._cache: dict[str, RobotFileParser | None] = {}

    def _domain(self, url: str) -> str:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}"

    def allowed(self, url: str) -> tuple[bool, str]:
        """Default-allowed when robots.txt is unreachable (RFC behaviour)."""
        domain = self._domain(url)
        if domain not in self._cache:
            rp = RobotFileParser()
            rp.set_url(f"{domain}/robots.txt")
            try:
                rp.read()
                self._cache[domain] = rp
            except Exception:
                self._cache[domain] = None
        rp = self._cache[domain]
        if rp is None:
            return True, "no robots.txt or unreachable"
        if rp.can_fetch(self.user_agent, url):
            return True, "permitted by robots.txt"
        return False, "blocked by robots.txt"


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------

def cache_path(url: str) -> Path:
    h = hashlib.sha256(url.encode()).hexdigest()[:16]
    return CACHE_DIR / f"{h}.html"


def fetch_with_cache(url: str, force: bool = False) -> str | None:
    """Return the HTML for a URL, fetching once and reusing the local cache
    on subsequent runs. Returns None on fetch error."""
    path = cache_path(url)
    if path.exists() and not force:
        return path.read_text(encoding="utf-8", errors="replace")

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        print(f"  ! fetch failed: {exc}", file=sys.stderr)
        return None

    path.write_text(response.text, encoding="utf-8")
    return response.text


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

# Sidebar/nav headings trafilatura sometimes mistakes for the page title.
JUNK_TITLE_RE = re.compile(
    r'^\s*(recent posts|home|blog|404|page not found|untitled|menu|'
    r'search results|comments|navigation)\s*$', re.I)


def _clean_title(t: str | None) -> str | None:
    """Unescape entities, collapse whitespace, and drop a trailing
    ' | Site' / ' – Site' / ' — Site' suffix."""
    if not t:
        return None
    t = _unescape(re.sub(r'\s+', ' ', t)).strip()
    t = re.split(r'\s+[|–—]\s+', t)[0].strip()
    return t or None


def _slug_title(url: str) -> str | None:
    """Humanise the final URL path segment as a last-resort title."""
    slug = urlparse(url).path.rstrip('/').split('/')[-1]
    slug = re.sub(r'\.(html?|php|aspx?)$', '', slug, flags=re.I)
    slug = re.sub(r'[-_]+', ' ', slug).strip()
    return slug.title() if slug else None


def resolve_title(html: str, url: str, metadata_title: str | None) -> str | None:
    """Prefer trafilatura's metadata title, but when it is empty or junk (a
    sidebar heading like 'Recent Posts'), fall back to the <title> tag, then
    og:title, then a humanised URL slug."""
    mt = (metadata_title or "").strip()
    if mt and not JUNK_TITLE_RE.match(mt) and len(mt) >= 8:
        return mt
    m = re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S)
    title_tag = _clean_title(m.group(1)) if m else None
    m = re.search(r'property=["\']og:title["\']\s+content=["\'](.*?)["\']', html, re.I)
    og = _clean_title(m.group(1)) if m else None
    for cand in (title_tag, og, _slug_title(url)):
        if cand and not JUNK_TITLE_RE.match(cand) and len(cand) >= 8:
            return cand
    return mt or None


def extract(html: str, url: str) -> dict | None:
    """Pull main-article text and metadata via trafilatura. Text is extracted
    as MARKDOWN so venue-name headings and section structure stay attached to
    their content (flat-text extraction detached names from addresses and let
    sidebar/nav text leak in). Returns None when too little text is found."""
    text = trafilatura.extract(
        html, url=url,
        include_comments=False,
        include_tables=True,        # listicles often put venue rows in tables
        favor_recall=False,
        deduplicate=True,
        output_format="markdown",   # preserve headings/structure
    )
    if not text or len(text) < MIN_ARTICLE_CHARS:
        return None

    metadata = trafilatura.extract_metadata(html)
    meta_title = getattr(metadata, "title", None) if metadata else None
    return {
        "title":    resolve_title(html, url, meta_title),
        "author":   getattr(metadata, "author", None) if metadata else None,
        "date":     getattr(metadata, "date", None) if metadata else None,
        "sitename": getattr(metadata, "sitename", None) if metadata else None,
        "text":     text,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--urls", type=Path, default=DEFAULT_URLS,
                   help=f"JSONL from discover_editorial_urls.py "
                        f"(default {DEFAULT_URLS})")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                   help=f"(default {DEFAULT_OUTPUT})")
    p.add_argument("--force", action="store_true",
                   help="Ignore the local cache and refetch.")
    p.add_argument("--limit", type=int, default=None,
                   help="Smoke-test mode: only fetch the first N URLs.")
    p.add_argument("--rate-limit", type=float, default=RATE_LIMIT_SECONDS,
                   help=f"Seconds between fetches (default {RATE_LIMIT_SECONDS}).")
    p.add_argument("--ignore-robots", action="store_true",
                   help="Proceed despite robots.txt disallowing the fetch. "
                        "Use under explicit academic-use framing approved by "
                        "your supervisor. Overridden URLs are tagged [override] "
                        "in the per-URL log for the audit trail.")
    args = p.parse_args()

    if not args.urls.exists():
        sys.exit(f"URL list not found: {args.urls}\n"
                 f"  Run `python discover_editorial_urls.py` first.")

    url_rows = [json.loads(l) for l in args.urls.read_text().splitlines() if l.strip()]
    if args.limit:
        url_rows = url_rows[: args.limit]
    print(f"Loaded {len(url_rows)} URLs from {args.urls}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)

    robots = RobotsCache(USER_AGENT)
    written         = 0
    skipped_robots  = 0
    overrode_robots = 0
    skipped_failed  = 0

    if args.ignore_robots:
        print("NOTICE: robots.txt enforcement disabled via --ignore-robots.",
              file=sys.stderr)
        print("        Proceeding under academic-use framing "
              "(COMP47360 lecturer-approved scope).", file=sys.stderr)
        print("        URLs that robots.txt would have blocked are tagged "
              "[override] in the log below.", file=sys.stderr)
        print(file=sys.stderr)

    with args.output.open("w") as out:
        for i, url_row in enumerate(url_rows, 1):
            url = url_row["url"]
            domain = urlparse(url).netloc
            print(f"[{i:>3d}/{len(url_rows)}] {domain} — {urlparse(url).path[:60]}",
                  file=sys.stderr)

            # robots.txt check (always run, for audit purposes)
            allowed, reason = robots.allowed(url)
            if not allowed:
                if args.ignore_robots:
                    print(f"        [override] would-skip ({reason}); "
                          f"proceeding under --ignore-robots", file=sys.stderr)
                    overrode_robots += 1
                else:
                    print(f"        skip — {reason}", file=sys.stderr)
                    skipped_robots += 1
                    continue

            # Fetch (cached); only sleep when we hit the network
            cached = cache_path(url).exists() and not args.force
            html = fetch_with_cache(url, force=args.force)
            if not cached and html is not None:
                time.sleep(args.rate_limit)
            if html is None:
                skipped_failed += 1
                continue

            # Extract main article body
            data = extract(html, url)
            if data is None:
                print(f"        skip — extraction returned <{MIN_ARTICLE_CHARS} chars",
                      file=sys.stderr)
                skipped_failed += 1
                continue

            row = {
                "url":         url,
                "domain":      domain,
                "title":       data["title"],
                "author":      data["author"],
                "publish_date": data["date"],
                "publication": data["sitename"] or domain,
                "fetched_at":  datetime.now(timezone.utc).isoformat(),
                "char_count":  len(data["text"]),
                "text":        data["text"],
            }
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1
            print(f"        ok  — {row['char_count']} chars, "
                  f"'{(row['title'] or '')[:60]}'", file=sys.stderr)

    print(file=sys.stderr)
    print("Done.", file=sys.stderr)
    print(f"  written:            {written:>3d}", file=sys.stderr)
    print(f"  robots-blocked:     {skipped_robots:>3d}", file=sys.stderr)
    if args.ignore_robots:
        print(f"  robots overridden:  {overrode_robots:>3d}  "
              f"(fetched despite robots.txt under academic-use framing)",
              file=sys.stderr)
    print(f"  failed/short:       {skipped_failed:>3d}", file=sys.stderr)
    print(f"  → {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
