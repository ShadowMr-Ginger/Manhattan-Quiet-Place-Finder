"""
COMP47360 — Quiet Spaces Manhattan
Stage 2: Editorial-Article Venue Extraction
-------------------------------------------

Adapted version of the Reddit Stage 2 extractor for editorial articles.

Pipeline:
  - Input is editorial_corpus.jsonl (one row per article with full text),
    filtered by relevant_articles.jsonl from Stage 1.
  - Each article is sent to the LLM as a single call, with the full body (no
    truncation — articles are small relative to model context, and truncating
    would drop tail venues in long listicles).
  - Output is extractions.jsonl, one row per venue mention, in the editorial
    schema (venue_category, work_context, article_work_framing, signed
    endorsement, 3-class attributes + evidence, representative_quote +
    quote_verbatim, location_context, is_chain_generic, mention_type) plus
    source provenance. The representative_quote is validated against the body
    and blanked unless it is a literal span (quote_verbatim records the result).

Uses ARTICLE_EXTRACTION_PROMPT + ArticleExtraction from prompts.py.

Provider-agnostic via `instructor`. With ANTHROPIC_API_KEY set it runs on
Claude Haiku 4.5 (~$2 for the 97-article corpus); DeepSeek/Groq/Gemini work too.

NOTE: downstream canonicalize_venues.py still expects the old Reddit-mapped
field names and must be updated to this schema before Stage 6 is run.

Dependencies:
    pip install instructor pydantic python-dotenv openai

Run from inside editorial/:
    python stage2_extraction.py \\
        --corpus   outputs/editorial_corpus.jsonl \\
        --relevant outputs/relevant_articles.jsonl \\
        --output   outputs/extractions.jsonl

    # Skip the relevance filter (e.g., to extract from everything):
    python stage2_extraction.py --no-relevance-filter

    # Smoke-test on first 3 articles:
    python stage2_extraction.py --limit 3
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Anchor paths to the script's directory so it works from any CWD.
HERE          = Path(__file__).resolve().parent        # editorial/extraction/
EDITORIAL_DIR = HERE.parent                            # editorial/
DEFAULT_CORPUS   = EDITORIAL_DIR / "corpus"    / "outputs" / "editorial_corpus.jsonl"
DEFAULT_RELEVANT = EDITORIAL_DIR / "relevance" / "outputs" / "relevant_articles.jsonl"
DEFAULT_OUTPUT   = HERE / "outputs" / "extractions.jsonl"

# Make the shared prompts module importable
sys.path.insert(0, str(EDITORIAL_DIR))
from prompts import ArticleExtraction, ARTICLE_EXTRACTION_PROMPT

load_dotenv(EDITORIAL_DIR.parent / ".env")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_MODEL_BY_PROVIDER = {
    "anthropic": "claude-haiku-4-5-20251001",    # [recommended] best $/quality
    "deepseek":  "deepseek-chat",                # free 5M tokens; ~$1-2 beyond
    "groq":      "llama-3.3-70b-versatile",      # free, no card
    "gemini":    "gemini-flash-latest",          # free, no card
    "openai":    "gpt-4o-mini",                  # paid
}

MAX_RETRIES        = 3
RETRY_BACKOFF_S    = 2.0
RATE_LIMIT_SECONDS = 0.0   # set >0 if hitting provider RPM limits
# Output-token ceiling. Long listicles (26-29 venues) overflow a small cap and
# truncate mid-array; 16000 gives ample headroom for the biggest articles.
# Lower it only if the provider rejects max_tokens as exceeding the model limit.
MAX_OUTPUT_TOKENS  = 16000


# ---------------------------------------------------------------------------
# Billing-error short-circuit (mirrors stage1_relevance.py)
# ---------------------------------------------------------------------------
# When the provider's credit runs out mid-pass, retrying won't help — bail
# cleanly so the audit log preserves work done so far and the user can top up
# and resume rather than burn ~12s × N remaining articles on dead retries.

class CreditExhausted(Exception):
    """LLM provider rejected the call due to insufficient credit/balance."""
    pass


def is_billing_error(exc: Exception) -> bool:
    """True if the exception message indicates an unrecoverable billing error."""
    msg = str(exc).lower()
    return any(kw in msg for kw in (
        "credit balance",          # Anthropic
        "insufficient_quota",      # OpenAI
        "insufficient credit",     # generic
        "insufficient balance",    # DeepSeek
        "billing",
        "payment required",
        "out of credit",
        "quota exceeded",
        " 402",
    ))


# ---------------------------------------------------------------------------
# LLM client factory — same shape as reddit/stage2_extraction.py
# ---------------------------------------------------------------------------

def make_client():
    import instructor

    if os.environ.get("ANTHROPIC_API_KEY"):
        from anthropic import Anthropic
        return instructor.from_anthropic(Anthropic()), "anthropic"

    if os.environ.get("DEEPSEEK_API_KEY"):
        from openai import OpenAI
        client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com/v1",
        )
        return instructor.from_openai(client), "deepseek"

    if os.environ.get("GROQ_API_KEY"):
        from openai import OpenAI
        client = OpenAI(
            api_key=os.environ["GROQ_API_KEY"],
            base_url="https://api.groq.com/openai/v1",
        )
        return instructor.from_openai(client), "groq"

    if os.environ.get("GEMINI_API_KEY"):
        try:
            from google import genai
            client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
            return instructor.from_genai(client), "gemini"
        except ImportError:
            print("! GEMINI_API_KEY set but google-genai not installed.",
                  file=sys.stderr)

    if os.environ.get("OPENAI_API_KEY"):
        from openai import OpenAI
        return instructor.from_openai(OpenAI()), "openai"

    sys.exit(
        "No LLM API key found. Set one in .env (in preference order):\n"
        "  ANTHROPIC_API_KEY  (Claude — best quality; ~$30-50 for full Stage 2)\n"
        "  DEEPSEEK_API_KEY   (DeepSeek V3 — ~Sonnet quality, ~free) [recommended]\n"
        "  GROQ_API_KEY       (Groq + Llama 3.3 — free, 14,400 RPD)\n"
        "  GEMINI_API_KEY     (Google AI Studio — free, 1,500 RPD)\n"
        "  OPENAI_API_KEY     (OpenAI; or Together with base_url)"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_processed_urls(output_path: Path) -> set[str]:
    """Read existing extractions.jsonl to find which articles have been
    processed already, for resume support."""
    if not output_path.exists():
        return set()
    urls = set()
    for line in output_path.read_text().splitlines():
        if line.strip():
            try:
                urls.add(json.loads(line).get("source_url"))
            except json.JSONDecodeError:
                continue
    return urls


def _norm(s: str) -> str:
    """Whitespace-collapsed, lowercased text for substring comparison."""
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def quote_is_verbatim(snippet: str, body: str) -> bool:
    """True if `snippet` appears (whitespace-normalised, case-insensitive) as a
    literal span of `body`. Surrounding quote marks/periods are stripped so a
    model that wraps the span in quotes still validates."""
    s = _norm(snippet).strip('".“”\'')
    return bool(s) and s in _norm(body)


def publish_date_epoch(date_str: str | None) -> int:
    """Best-effort conversion of a publish-date string to epoch seconds."""
    if not date_str:
        return 0
    try:
        # trafilatura emits ISO-ish dates; fall back to dateutil if needed
        return int(datetime.fromisoformat(date_str).timestamp())
    except (ValueError, TypeError):
        try:
            return int(datetime.strptime(date_str, "%Y-%m-%d").timestamp())
        except (ValueError, TypeError):
            return 0


def extract_from_article(client, model, article):
    """Run ARTICLE_EXTRACTION_PROMPT against the article body. Returns an
    ArticleExtraction with zero or more VenueMentions."""
    # Full article body — no truncation. Editorial articles are small relative
    # to the model context, and slicing would drop tail venues in long listicles.
    prompt = ARTICLE_EXTRACTION_PROMPT.format(
        publication=article.get("publication", article.get("domain", "")),
        url=article.get("url", ""),
        title=article.get("title", ""),
        article_text=article.get("text", "") or "",
    )
    for attempt in range(MAX_RETRIES):
        try:
            return client.chat.completions.create(
                model=model,
                response_model=ArticleExtraction,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=MAX_OUTPUT_TOKENS,
            )
        except Exception as exc:
            if is_billing_error(exc):
                # Don't retry; bubble up so main() can exit cleanly
                raise CreditExhausted(str(exc)[:200]) from exc
            if attempt == MAX_RETRIES - 1:
                raise
            wait = RETRY_BACKOFF_S * (attempt + 1)
            print(f"      ! LLM error ({type(exc).__name__}); retrying in {wait}s",
                  file=sys.stderr)
            time.sleep(wait)


def flatten(extraction, article):
    """One JSONL row per VenueMention, with editorial provenance attached.

    Each row carries the new editorial schema (venue_category, work_context,
    signed endorsement, 3-class attributes, representative_quote,
    location_context, is_chain_generic, mention_type) plus source fields. The
    publication is preserved verbatim for downstream source-reputation
    weighting; venue identity/dedup and scoring are separate downstream stages.

    NOTE: canonicalize_venues.py expects the *old* Reddit-mapped field names
    (source_thread_id, source_subreddit, comment_score, overall_sentiment,
    is_sarcastic, ...). It must be updated to this schema before Stage 6.
    """
    pub_epoch = publish_date_epoch(article.get("publish_date"))
    publication = article.get("publication") or article.get("domain")
    body = article.get("text", "") or ""
    framing = extraction.article_work_framing.value
    for venue in extraction.venues:
        v = venue.model_dump(mode="json")
        # Validate the representative quote: discard it unless it is a literal
        # span of the article body. Downstream falls back to a score-based
        # summary when no verbatim quote survives.
        quote = v.get("representative_quote") or ""
        q_ok = quote_is_verbatim(quote, body)
        if not q_ok:
            quote = ""
        yield {
            "venue_raw":             v["venue_raw"],
            "venue_category":        v["venue_category"],
            "access":                v["access"],
            "work_context":          v["work_context"],
            "article_work_framing":  framing,
            "endorsement":           v["endorsement"],
            "attributes":            v["attributes"],
            "representative_quote":  quote,
            "quote_verbatim":        q_ok,
            "location_context":      v["location_context"],
            "is_chain_generic":      v["is_chain_generic"],
            "mention_type":          v["mention_type"],
            "extraction_confidence": v["extraction_confidence"],
            "source_url":            article.get("url"),    # article URL = mention identity
            "source_title":          article.get("title", ""),
            "source_publication":    publication,           # for source-weight table
            "publish_date_epoch":    pub_epoch,
            "source_kind":           "editorial",
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_relevant_urls(path: Path) -> set[str]:
    """URLs flagged is_relevant=true by Stage 1."""
    urls = set()
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("is_relevant"):
            urls.add(row.get("url"))
    return urls


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS,
                   help=f"Editorial corpus from corpus/ stage (default {DEFAULT_CORPUS})")
    p.add_argument("--relevant", type=Path, default=DEFAULT_RELEVANT,
                   help=f"Stage 1 kept set from relevance/ stage "
                        f"(default {DEFAULT_RELEVANT})")
    p.add_argument("--no-relevance-filter", action="store_true",
                   help="Skip the Stage 1 filter and run extraction over every article.")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                   help=f"(default {DEFAULT_OUTPUT})")
    p.add_argument("--model", default=None,
                   help="Model identifier. Defaults to a sensible model for "
                        "whichever provider is detected from your .env keys.")
    p.add_argument("--limit", type=int, default=None,
                   help="Smoke-test mode: only process the first N articles.")
    p.add_argument("--resume", action="store_true",
                   help="Skip article URLs already present in the output file.")
    args = p.parse_args()

    if not args.corpus.exists():
        sys.exit(f"Corpus not found: {args.corpus}\n"
                 f"  Run `python fetch_editorial_corpus.py` first.")

    articles = [
        json.loads(l) for l in args.corpus.read_text().splitlines() if l.strip()
    ]
    print(f"Loaded {len(articles)} articles from {args.corpus}", file=sys.stderr)

    # Filter by Stage 1 relevance unless explicitly disabled
    if not args.no_relevance_filter:
        if not args.relevant.exists():
            sys.exit(f"Relevant-articles file not found: {args.relevant}\n"
                     f"  Run `python stage1_relevance.py` first, "
                     f"or pass --no-relevance-filter to skip the filter.")
        relevant_urls = load_relevant_urls(args.relevant)
        before = len(articles)
        articles = [a for a in articles if a.get("url") in relevant_urls]
        print(f"  filtered to {len(articles)} relevant (of {before} loaded)",
              file=sys.stderr)
    else:
        print(f"  relevance filter disabled — processing all articles",
              file=sys.stderr)

    already_done: set[str] = set()
    if args.resume:
        already_done = load_processed_urls(args.output)
        print(f"  resume: {len(already_done)} articles already extracted",
              file=sys.stderr)
        articles = [a for a in articles if a.get("url") not in already_done]
        print(f"  remaining: {len(articles)}", file=sys.stderr)

    if args.limit:
        articles = articles[: args.limit]

    client, provider = make_client()
    model = args.model or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o-mini")
    print(f"LLM provider: {provider}, model: {model}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    out_mode = "a" if args.resume else "w"

    n_processed      = 0
    n_with_venues    = 0
    n_venues_written = 0
    n_failed         = 0

    with args.output.open(out_mode) as f:
        for i, article in enumerate(articles, 1):
            url = article.get("url", "")
            title = article.get("title") or "(no title)"
            print(f"  [{i:>3d}/{len(articles)}] {title[:60]}", file=sys.stderr)

            try:
                extraction = extract_from_article(client, model, article)
                n_processed += 1
            except CreditExhausted as exc:
                print(f"      ! billing error: {exc}", file=sys.stderr)
                print(file=sys.stderr)
                print("=" * 64, file=sys.stderr)
                print(f"  CREDIT EXHAUSTED — stopping at article "
                      f"{i}/{len(articles)}.", file=sys.stderr)
                print(f"  No retry attempted (billing errors don't resolve "
                      f"on retry).", file=sys.stderr)
                print(f"  Top up at console.anthropic.com (or your provider's "
                      f"billing page),", file=sys.stderr)
                print(f"  then re-run with --resume to pick up from article "
                      f"{i}.", file=sys.stderr)
                print("=" * 64, file=sys.stderr)
                break
            except Exception as exc:
                print(f"      ! failed: {exc}", file=sys.stderr)
                n_failed += 1
                continue

            wrote = 0
            for row in flatten(extraction, article):
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                wrote += 1
            f.flush()

            n_venues_written += wrote
            if wrote > 0:
                n_with_venues += 1

            print(f"      {wrote} venue mention{'s' if wrote != 1 else ''}",
                  file=sys.stderr)

            if RATE_LIMIT_SECONDS:
                time.sleep(RATE_LIMIT_SECONDS)

    print(file=sys.stderr)
    print("Done.", file=sys.stderr)
    print(f"  articles processed:       {n_processed:>4d}", file=sys.stderr)
    print(f"  articles yielding venues: {n_with_venues:>4d}", file=sys.stderr)
    print(f"  total venue mentions:     {n_venues_written:>4d}", file=sys.stderr)
    print(f"  failures:                 {n_failed:>4d}", file=sys.stderr)
    print(f"  → {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
