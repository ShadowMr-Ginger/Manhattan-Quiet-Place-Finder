"""
COMP47360 — Quiet Spaces Manhattan
Stage 1: Editorial Article Relevance Classification (STRICT, v3)
----------------------------------------------------------------

Reads the editorial corpus produced by ../corpus/fetch_editorial_corpus.py
and classifies each article for relevance using STRICT_ARTICLE_RELEVANCE_PROMPT
from editorial/prompts.py.

Methodology
  This v3 pass replaces two earlier attempts:
    v1 (Haiku, "Manhattan-primary ≥60%")  — too generous on framing; passed
        generic "best cafés" articles whose individual venues had wifi/seating
        details but whose overall purpose was food/lifestyle coverage.
    v2 (Haiku reconsideration, "≥5 substantive Manhattan venues") — produced
        22/27 false positives on manual review; deprecated.
  v3 uses Claude Sonnet 4.6 (more capable filter) with the strict prompt
  requiring three explicit gates: (1) explicit work-context framing,
  (2) ≥5 Manhattan venues each with ≥2 concrete work-amenity details, and
  (3) Manhattan-primary (≥60% of named venues).

Outputs (this stage)
  relevance/outputs/relevant_articles.jsonl  — kept articles, ready for Stage 2.
  relevance/outputs/relevance_log.jsonl      — every classification (KEEP +
                                               DROP), with unified p_relevant
                                               score for downstream analysis.

P(relevant) — unified scale
  Each row carries `p_relevant` ∈ [0, 1] computed at write-time. The LLM
  uses `confidence` with two semantics depending on verdict (see
  compute_p_relevant docstring); the unified score normalizes both onto a
  single scale so the audit log can be filtered consistently (e.g. "show
  all rows with p_relevant in [0.3, 0.5)" for borderline cases regardless
  of verdict direction).

Provider-agnostic via `instructor`. Same factory as stage2_extraction.py.
Defaults to Claude Sonnet 4.6 when ANTHROPIC_API_KEY is set.

Dependencies:
    pip install instructor pydantic python-dotenv anthropic openai

Run from inside editorial/relevance/:
    python stage1_relevance.py --limit 5     # smoke test (~$0.05 on Haiku)
    python stage1_relevance.py                # full pass (~$3.50 on Haiku)
    python stage1_relevance.py --resume       # pick up after a crash
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Paths anchored to the script's location (work regardless of CWD)
# ---------------------------------------------------------------------------

HERE          = Path(__file__).resolve().parent          # editorial/relevance/
EDITORIAL_DIR = HERE.parent                              # editorial/
DEFAULT_CORPUS = EDITORIAL_DIR / "corpus" / "outputs" / "editorial_corpus.jsonl"
DEFAULT_OUTPUT = HERE / "outputs" / "relevant_articles.jsonl"
DEFAULT_LOG    = HERE / "outputs" / "relevance_log.jsonl"

# Make the shared prompts module importable
sys.path.insert(0, str(EDITORIAL_DIR))
from prompts import ThreadRelevance, STRICT_ARTICLE_RELEVANCE_PROMPT

# Load .env from the project root (two levels up from editorial/relevance/)
load_dotenv(EDITORIAL_DIR.parent / ".env")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_MODEL_BY_PROVIDER = {
    "anthropic": "claude-haiku-4-5-20251001",    # [recommended] best $/quality
    "deepseek":  "deepseek-chat",
    "groq":      "llama-3.3-70b-versatile",
    "gemini":    "gemini-flash-latest",
    "openai":    "gpt-4o-mini",
}

MIN_CONFIDENCE       = 0.5    # below: drop entirely (logged but not written to corpus)
REVIEW_THRESHOLD     = 0.75   # [min..review) keeps get needs_review=true flag
                              # raised from 0.70 after observed calibration drift —
                              # Haiku was producing food/lifestyle-framed false
                              # positives in the 0.70-0.74 band under v3.1.
                              # See methodology notes for the post-hoc adjustment.
MAX_RETRIES          = 3
RETRY_BACKOFF_S      = 2.0
RATE_LIMIT_SECONDS   = 0.0
BODY_EXCERPT_CHARS   = 25000  # near-full article; only 12 of 324 corpus articles
                              # in our fetch exceed this cap


# ---------------------------------------------------------------------------
# Billing-error short-circuit
# ---------------------------------------------------------------------------

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
# Unified P(relevant) score
# ---------------------------------------------------------------------------

def compute_p_relevant(is_relevant: bool, confidence: float) -> float:
    """Map (verdict, confidence) onto a single P(relevant) ∈ [0, 1] scale.

    The LLM uses `confidence` with two different semantic interpretations
    depending on the verdict — this normalizes both to a single relevance
    probability:

      is_relevant=True  →  confidence already = P(relevant)
      is_relevant=False, confidence > 0.5  →  LLM meant "confident in drop"
                                              ⇒ P(relevant) = 1 - confidence
      is_relevant=False, confidence ≤ 0.5  →  LLM meant P(relevant) directly
                                              ⇒ P(relevant) = confidence

    See methodology section: this enables consistent log analysis across both
    KEEP and DROP rows on a single [0, 1] scale.
    """
    if is_relevant:
        return confidence
    if confidence > 0.5:
        return 1.0 - confidence
    return confidence


# ---------------------------------------------------------------------------
# LLM client factory
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
        "No LLM API key in .env. Set ANTHROPIC_API_KEY for Sonnet (recommended)\n"
        "or one of: DEEPSEEK_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY."
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def classify(client, model, article):
    body = (article.get("text") or "")[:BODY_EXCERPT_CHARS]
    prompt = STRICT_ARTICLE_RELEVANCE_PROMPT.format(
        publication=article.get("publication", article.get("domain", "")),
        url=article.get("url", ""),
        title=article.get("title", "") or "(no title)",
        body_excerpt=body,
    )
    for attempt in range(MAX_RETRIES):
        try:
            return client.chat.completions.create(
                model=model,
                response_model=ThreadRelevance,   # reused schema; same shape
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,                  # required by Anthropic
            )
        except Exception as exc:
            if is_billing_error(exc):
                raise CreditExhausted(str(exc)[:200]) from exc
            if attempt == MAX_RETRIES - 1:
                raise
            wait = RETRY_BACKOFF_S * (attempt + 1)
            print(f"      ! LLM error ({type(exc).__name__}); retry in {wait}s",
                  file=sys.stderr)
            time.sleep(wait)


def load_processed_urls(log_path: Path) -> set[str]:
    """URLs already classified, for resume support."""
    if not log_path.exists():
        return set()
    urls = set()
    for line in log_path.read_text().splitlines():
        if line.strip():
            try:
                urls.add(json.loads(line).get("url"))
            except json.JSONDecodeError:
                continue
    return urls


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS,
                   help=f"(default {DEFAULT_CORPUS})")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                   help=f"(default {DEFAULT_OUTPUT})")
    p.add_argument("--log", type=Path, default=DEFAULT_LOG,
                   help=f"Per-article audit log (default {DEFAULT_LOG})")
    p.add_argument("--model", default=None,
                   help="Override the per-provider default model.")
    p.add_argument("--min-confidence", type=float, default=MIN_CONFIDENCE,
                   help=f"Drop articles below this confidence (default {MIN_CONFIDENCE}).")
    p.add_argument("--review-threshold", type=float, default=REVIEW_THRESHOLD,
                   help=f"Keeps in [min, review) flagged needs_review=true "
                        f"(default {REVIEW_THRESHOLD}).")
    p.add_argument("--rate-limit", type=float, default=RATE_LIMIT_SECONDS,
                   help=f"Seconds between LLM calls (default {RATE_LIMIT_SECONDS}). "
                        f"Use ~6.5 to stay under Gemini's 10-RPM free-tier cap.")
    p.add_argument("--limit", type=int, default=None,
                   help="Smoke test: only classify the first N articles.")
    p.add_argument("--resume", action="store_true",
                   help="Skip URLs already in the audit log.")
    args = p.parse_args()

    if not args.corpus.exists():
        sys.exit(f"Corpus not found: {args.corpus}\n"
                 f"  Run `python ../corpus/fetch_editorial_corpus.py` first.")

    articles = [
        json.loads(l) for l in args.corpus.read_text().splitlines() if l.strip()
    ]
    if args.limit:
        articles = articles[: args.limit]
    print(f"Loaded {len(articles)} articles from {args.corpus}", file=sys.stderr)

    already_done: set[str] = set()
    if args.resume:
        already_done = load_processed_urls(args.log)
        print(f"  resume: {len(already_done)} already classified", file=sys.stderr)

    client, provider = make_client()
    model = args.model or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o-mini")
    print(f"LLM provider: {provider}, model: {model}", file=sys.stderr)
    if args.rate_limit:
        print(f"  rate limit: {args.rate_limit}s between calls", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.log.parent.mkdir(parents=True, exist_ok=True)
    out_mode = "a" if args.resume else "w"
    log_mode = "a" if args.resume else "w"

    n_classified    = 0
    n_relevant      = 0
    n_written       = 0
    n_needs_review  = 0
    n_failed        = 0

    with args.output.open(out_mode) as f_out, args.log.open(log_mode) as f_log:
        for i, article in enumerate(articles, 1):
            url = article.get("url")
            if url in already_done:
                continue
            title = (article.get("title") or "(no title)")[:60]
            print(f"  [{i:>3d}/{len(articles)}] {title}", file=sys.stderr)

            try:
                result = classify(client, model, article)
                n_classified += 1
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

            needs_review = (
                result.is_relevant
                and args.min_confidence <= result.confidence < args.review_threshold
            )
            p_relevant = compute_p_relevant(result.is_relevant, result.confidence)

            row = {
                "url":          url,
                "domain":       article.get("domain"),
                "publication":  article.get("publication"),
                "title":        article.get("title"),
                "is_relevant":  result.is_relevant,
                "confidence":   result.confidence,
                "p_relevant":   round(p_relevant, 4),
                "needs_review": needs_review,
                "reasoning":    result.reasoning,
                "method":       "llm",
                "model":        model,
                "prompt":       "STRICT_ARTICLE_RELEVANCE_PROMPT_v3.1",
            }
            f_log.write(json.dumps(row, ensure_ascii=False) + "\n")
            f_log.flush()

            verdict = "KEEP"
            if not result.is_relevant:
                verdict = "drop"
            elif needs_review:
                verdict = "REVIEW"
            print(f"      {verdict} "
                  f"(conf={result.confidence:.2f}, p_rel={p_relevant:.2f}) — "
                  f"{result.reasoning[:60]}", file=sys.stderr)

            if result.is_relevant:
                n_relevant += 1
                if result.confidence >= args.min_confidence:
                    f_out.write(json.dumps(row, ensure_ascii=False) + "\n")
                    f_out.flush()
                    n_written += 1
                    if needs_review:
                        n_needs_review += 1

            if args.rate_limit:
                time.sleep(args.rate_limit)

    print(file=sys.stderr)
    n_auto_kept = n_written - n_needs_review
    print("Done.", file=sys.stderr)
    print(f"  articles loaded:        {len(articles):>3d}", file=sys.stderr)
    print(f"  classified by LLM:      {n_classified:>3d}", file=sys.stderr)
    print(f"  marked relevant:        {n_relevant:>3d}", file=sys.stderr)
    print(f"  written (>= min conf):  {n_written:>3d}", file=sys.stderr)
    print(f"    auto-kept (>= {args.review_threshold}):  "
          f"{n_auto_kept:>3d}", file=sys.stderr)
    print(f"    needs review (< {args.review_threshold}): "
          f"{n_needs_review:>3d}", file=sys.stderr)
    print(f"  failed:                 {n_failed:>3d}", file=sys.stderr)
    print(f"  → {args.output}", file=sys.stderr)
    print(f"  → {args.log}  (audit log, with p_relevant column)", file=sys.stderr)


if __name__ == "__main__":
    main()
