"""
COMP47360 — Quiet Spaces Manhattan
NLP Extraction Pipeline: Schemas and Prompts

Two-stage LLM pipeline for the editorial-article corpus:
  Stage 1 — Article relevance: classify which articles concern Manhattan
            workspaces (STRICT_ARTICLE_RELEVANCE_PROMPT).
  Stage 2 — Venue extraction: pull venue + category + work_context + signed
            endorsement + per-attribute sentiment + a representative quote
            from each article (ARTICLE_EXTRACTION_PROMPT).

Canonicalization (mapping `venue_raw` to a stable Google Places `place_id`) is a
separate downstream stage that runs *after* extraction; it uses RapidFuzz for
dedup and Google Places for identity/geocoding, and is NOT part of this file.

Designed for use with the `instructor` library
(https://python.useinstructor.com/), which constrains LLM output to the
Pydantic schemas below. Works with OpenAI, Anthropic, Google Gemini, Ollama
(local Llama / Mistral / Qwen), and any OpenAI-compatible endpoint (Groq,
Together, DeepSeek). Choose provider based on cost / free-tier access.

Notes:
  • Keep prompts short. Brevity both saves tokens and reduces the chance the
    model improvises beyond the schema.
  • Run the full pipeline against a 50-comment hand-labelled holdout before
    trusting the corpus output. Reported metrics belong in Section 6 of the
    paper.
"""

from __future__ import annotations
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------

class Sentiment(str, Enum):
    """Three-class polarity. 'neutral' is reserved for genuinely mixed or
    purely factual statements — the prompt instructs the model not to default
    to neutral when one polarity dominates."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class AttributeMention(BaseModel):
    """Per-attribute sentiment with a short evidence snippet, so reviewers can
    audit extractions without re-reading the full comment."""
    polarity: Sentiment
    evidence: str = Field(
        description="Short verbatim quote or close paraphrase from the comment "
                    "supporting this rating. Max ~20 words."
    )


# ---------------------------------------------------------------------------
# Stage 1 — Thread relevance schema
# ---------------------------------------------------------------------------

class ThreadRelevance(BaseModel):
    is_relevant: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(
        max_length=200,
        description="One-sentence justification (short, for audit/debug)."
    )


# ---------------------------------------------------------------------------
# Stage 2 — Comment extraction schema
# ---------------------------------------------------------------------------

class VenueCategory(str, Enum):
    """Coarse venue type. Drives downstream scope filtering — some categories
    (coworking_paid, private_library, university_library, museum, outdoor) are
    out of project scope and dropped at canonicalization with a visible rule."""
    CAFE = "cafe"
    COFFEE_SHOP = "coffee_shop"
    LIBRARY = "library"                    # free public library (NYPL, BPL, QPL)
    UNIVERSITY_LIBRARY = "university_library"  # academic; needs enrolment/ID (out of scope)
    BOOKSTORE_CAFE = "bookstore_cafe"
    COWORKING_PAID = "coworking_paid"
    PRIVATE_LIBRARY = "private_library"    # paid-membership library (out of scope)
    MUSEUM = "museum"
    HOTEL_LOBBY = "hotel_lobby"
    OUTDOOR = "outdoor"
    OTHER = "other"


class Access(str, Enum):
    """Whether the venue is freely open to the public. Drives the access scope
    filter (restricted = dropped). Default to public/unknown rather than
    guessing restricted; a deterministic gazetteer catches the known restricted
    libraries the article text won't flag."""
    PUBLIC = "public"          # free / open to the public
    RESTRICTED = "restricted"  # membership, fee/admission, student-ID, or appointment-only
    UNKNOWN = "unknown"        # the article does not say (treated as keep)


class MentionType(str, Enum):
    """How the venue figures in the article (used for weighting)."""
    FEATURED = "featured"      # a curated pick in the article's list
    PASSING = "passing"        # named as an aside, not a curated pick
    COMPARISON = "comparison"  # named only to compare against another venue


class ArticleWorkFraming(str, Enum):
    """How strongly the article AS A WHOLE is framed around working/studying,
    assessed from its title + preamble. Governs whether bare-listed venues
    inherit work_context (see the prompt)."""
    EXPLICIT = "explicit"      # title/preamble frames the whole piece as a work guide
    IMPLICIT = "implicit"      # work portrayal via venue descriptions; no work headline
    INCIDENTAL = "incidental"  # non-work headline; workspace only softly/secondarily implied


class VenueAttributes(BaseModel):
    """Nine tracked work-relevant attributes. Any attribute NOT discussed in
    the article must be None — never infer an attribute from silence, and
    never treat absence as negative. Each value is a 3-class polarity plus a
    short verbatim evidence snippet; polarity maps to +1/0/-1 for aggregation."""
    noise: Optional[AttributeMention] = None
    wifi: Optional[AttributeMention] = None
    seating: Optional[AttributeMention] = None
    outlets: Optional[AttributeMention] = None
    crowding: Optional[AttributeMention] = None
    accessibility: Optional[AttributeMention] = None
    laptop_friendly: Optional[AttributeMention] = None
    price: Optional[AttributeMention] = None
    hours: Optional[AttributeMention] = None


class VenueMention(BaseModel):
    venue_raw: str = Field(
        description="The venue's NAME exactly as it appears in the article. Do "
                    "NOT normalize, correct, or canonicalize. If the article "
                    "gives no usable name (e.g. the name is only in an image), "
                    "use the street ADDRESS instead — never a description such "
                    "as 'cafe with large windows'."
    )
    venue_category: VenueCategory = Field(
        description="Coarse venue type (mostly descriptive; museum/outdoor/"
                    "coworking_paid are excluded downstream by nature)."
    )
    access: Access = Field(
        description="public / restricted / unknown. 'restricted' ONLY when the "
                    "text explicitly states membership, a fee/admission, "
                    "student-ID/enrolment, or appointment-only access. Default "
                    "to public, or unknown when unstated — do not guess restricted."
    )
    work_context: bool = Field(
        description="True if the article portrays THIS venue with a work signal "
                    "(a work-relevant amenity, or language like quiet / spacious "
                    "/ good for long stays / laptop-friendly / study). False for "
                    "venues named only for food, drink, vibe, décor, dates, or "
                    "sightseeing. Libraries and study-oriented bookstore cafés "
                    "default True by institutional purpose, even without explicit "
                    "amenity discussion. This flag is the downstream inclusion gate."
    )
    endorsement: float = Field(
        ge=-1.0, le=1.0,
        description="Signed strength of recommendation as a place to WORK. "
                    "+1 = strong explicit endorsement; +0.3..+0.6 = clearly "
                    "endorsed with enthusiasm; +0.1..+0.2 = bare inclusion in a "
                    "work list (inclusion is a soft positive); 0 = named with no "
                    "evaluative content; negative = an explicit caveat/warning "
                    "against working there. Magnitude IS the strength. These are "
                    "curated editorials — do not force negativity."
    )
    attributes: VenueAttributes
    representative_quote: str = Field(
        description="One short verbatim snippet (~15-25 words) from the article "
                    "capturing the work-relevant gist for this venue, for the "
                    "venue UI. Empty string if the venue is only named with no "
                    "descriptive text."
    )
    location_context: Optional[str] = Field(
        default=None,
        description="Any street, cross-street, neighborhood, or borough stated "
                    "near the venue (e.g. 'Williamsburg', 'on Bleecker St', "
                    "'Midtown'). Disambiguates chains and hints Stage 6 "
                    "geocoding. None if no location is given."
    )
    is_chain_generic: bool = Field(
        description="True if a chain is named generically with no specific "
                    "branch or location (e.g. 'Starbucks' with no address)."
    )
    mention_type: MentionType = Field(
        description="featured (a curated pick), passing (an aside), or "
                    "comparison (named only to compare)."
    )
    extraction_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Model's confidence in this extraction "
                    "(0 = uncertain guess, 1 = explicit)."
    )


class ArticleExtraction(BaseModel):
    article_work_framing: ArticleWorkFraming = Field(
        description="How strongly the article as a whole is framed around "
                    "working/studying (assessed from title + preamble FIRST). "
                    "Governs work_context inheritance for bare-listed venues."
    )
    venues: list[VenueMention] = Field(
        default_factory=list,
        description="Every specific venue named in the article (including ones "
                    "with work_context=false, which are filtered downstream). "
                    "Empty list if none."
    )
    contains_no_venue: bool = Field(
        description="True iff the article names zero specific venues."
    )


# Backward-compatible alias (older importers referenced CommentExtraction).
CommentExtraction = ArticleExtraction


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

THREAD_RELEVANCE_PROMPT = """\
You are classifying Reddit threads for relevance to a study of NYC cafés, \
libraries, and public workspaces for students and remote workers.

A thread is RELEVANT if it:
- Asks for recommendations of cafés, coffee shops, libraries, or other places \
to study, work, or focus.
- Discusses experiences working or studying at specific NYC venues.
- Compares NYC venues for laptop work, studying, or quiet focus.
- Discusses noise levels, wifi, seating, outlets, or atmosphere of NYC \
workspaces.

A thread is NOT RELEVANT if it:
- Is about coffee brewing, beans, or barista craft (not the venue experience).
- Is about café ownership, jobs, hiring, or business operations.
- Reviews food or drink without reference to working or studying.
- Is about places outside NYC.
- Is purely social (dating, hookups, meetups) with no workspace angle.

Be conservative. Borderline cases should be is_relevant=false with confidence \
≤ 0.6 so they surface for manual review rather than entering the corpus.

--- THREAD ---
Subreddit: {subreddit}
Title:     {title}
Body:      {body}
"""


# ---------------------------------------------------------------------------
# Stage 1 STRICT relevance prompt for editorial articles
# ---------------------------------------------------------------------------
# Methodology history:
#   v1 (Haiku, "Manhattan-primary ≥60%") — too generous on framing; passed
#      generic "best cafés" articles whose individual venues had seating/WiFi
#      descriptions but whose overall purpose was food/lifestyle coverage.
#   v2 (Haiku reconsideration, "≥5 substantive Manhattan venues, any borough
#      mix") — produced 22/27 false positives on manual review for the same
#      framing reason; deprecated.
#   v3 (Sonnet, draft) — required explicit work framing + ≥2 amenity details
#      per venue + ≥60% Manhattan. Reviewer pushback identified three
#      issues: (a) explicit-framing-only loses articles with strong
#      implicit work portrayal; (b) ≥2 amenity details per venue throws
#      away breadth-focused workspace lists whose per-venue depth is
#      shallow but whose endorsement-in-context is real signal; (c) the
#      60% Manhattan threshold contradicts our prior agreement that
#      downstream spatial filtering (Stage 6) is the authoritative borough
#      check, and would re-lose mixed-borough articles like The Infatuation's
#      "Coffee Shops for Doing Work" (14 Manhattan venues at 42%).
#
# This v3.1 prompt addresses all three:
#   (A) WORK-CONTEXT PORTRAYAL — explicit OR implicit framing accepted, with
#       a clear distinction between portrayal (counts) and incidental
#       mention (doesn't). Distinguishing the two is the LLM's main job
#       here.
#   (B) MANHATTAN VENUE SIGNAL — OR rule: ≥5 venues in a workspace list
#       (B1, breadth path) OR ≥3 venues each with substantive amenity
#       discussion (B2, depth path). No Manhattan-percentage threshold —
#       Stage 6 handles that.
#
# Methodologically: this is more permissive on borough mix and per-venue
# depth (catching breadth-focused workspace lists), but stricter on
# framing (rejecting food/dining/lifestyle articles even when individual
# venues happen to have WiFi).

STRICT_ARTICLE_RELEVANCE_PROMPT = """\
You are classifying editorial articles for relevance to a study of Manhattan \
cafés, libraries, and public workspaces for students and remote workers.

We're building a corpus of editorial sources that meaningfully contribute to \
assessing Manhattan venues for working or studying. Articles can contribute \
useful signal in different ways:
  • BREADTH — listing many Manhattan venues in a workspace-themed piece, \
even if individual descriptions are brief (the venue endorsement itself is \
the signal; per-venue depth comes from other articles via aggregation)
  • DEPTH — detailed descriptions of work-amenities on a smaller set of \
Manhattan venues (rich per-venue content)
  • Both.

Downstream pipeline notes that affect this filter:
  • A later spatial-join stage filters venues to Manhattan using Google \
Places coordinates against the borough polygon. We therefore DO NOT impose \
a Manhattan-percentage threshold at this stage — multi-borough articles \
with substantial Manhattan signal are valuable; non-Manhattan venues are \
discarded downstream automatically.
  • A later canonicalization stage aggregates per-venue signal across all \
articles. Shallow signal from many sources combines into useful aggregate \
signal, so "many venues briefly named in a workplace context" is genuinely \
useful, not noise.

An article is RELEVANT if BOTH (A) AND (B) are satisfied:

(A) WORK-CONTEXT PORTRAYAL
The article portrays its named venues as workspaces — through EITHER:
  - EXPLICIT framing: article is titled or premised as a workspace guide \
("best cafés to work from", "study spots", "remote-work-friendly", \
"laptop-friendly", "places to write / focus", "WiFi cafés for working")
  - IMPLICIT framing: the description language portrays venues as \
work-suitable — venues described as "quiet for focus", "spacious tables", \
"good for long stays", "open all day", "laptop-friendly", "great for \
freelancers / students", or similar work-relevant portrayal.

Disqualifying framings (NOT acceptable, even if some venues are objectively \
good workspaces):
  - Food/coffee-quality focus: "best coffee in NYC", "best brunch", "best \
caffeine experiences", "where to find the best espresso"
  - Social/dining focus: "best date spots", "best brunches", "where to meet \
friends", "Instagrammable cafés", "cosy spots"
  - Tourism / neighborhood / lifestyle: "things to do in SoHo", \
"neighborhood guide to Hell's Kitchen", "best of NYC"
  - Reading-leisure (when distinct from study): "bookstore cafés for book \
lovers" without work portrayal
A venue casually mentioning "they have WiFi" inside a brunch guide does \
NOT count as work portrayal — the article's portrayal of the venue must \
position it as a workspace.

(B) MANHATTAN VENUE SIGNAL
At least ONE of the following thresholds is met:
  - (B1) ≥5 named Manhattan venues in a workspace-themed list (per-venue \
descriptions can be brief; the count + workspace framing is the signal), OR
  - (B2) ≥3 named Manhattan venues each with substantive work-amenity \
discussion (at least one work-relevant attribute discussed per venue: noise \
level for focus, WiFi, seating type / table availability, outlets, hours \
conducive to extended stays, laptop / lingering policy, crowding at work \
hours).

Manhattan-percentage of the article's overall venue list is NOT a filter \
criterion — articles with 5 Manhattan venues alongside 20 Brooklyn venues \
PASS as long as the article's portrayal is work-context.

An article is NOT RELEVANT if:
  - Framing is food / dining / coffee-quality / social / tourism / \
lifestyle — work portrayal absent or merely incidental to one or two \
venues.
  - Fewer than 3 named Manhattan venues with workspace portrayal (fails \
both B1 and B2).
  - Purely about paid commercial coworking memberships (WeWork-type \
rentals).
  - Exclusively on-campus university content requiring student ID access.
  - Pure SEO-thin content: venue names with no portrayal context.
  - 404 page, login wall, directory listing, or other non-article content.
  - Article is about places outside NYC entirely.

Confidence calibration (use this scale precisely):
  - 0.85–1.0:  Strong workspace portrayal + abundant Manhattan signal \
(≥10 venues with work-amenity discussion, OR a clear workspace-themed list \
of ≥10 Manhattan venues).
  - 0.70–0.85: Clear workspace portrayal + adequate Manhattan signal \
(satisfies B1 with workspace framing, OR satisfies B2 with substantive \
per-venue content).
  - 0.50–0.70: Borderline. Workspace portrayal present but thin, OR Manhattan \
signal at the threshold (exactly 3 venues with one amenity attribute each, \
OR exactly 5 venues in a list with very brief mentions). ENTERS the corpus, \
flagged for human review.
  - < 0.50:    is_relevant=false. Workspace portrayal absent (food / dining \
/ lifestyle framing dominates), OR fewer than 3 named Manhattan venues with \
workspace context.

Critical guidance: distinguishing workspace portrayal from incidental \
mention is the key skill here. A café described as "cozy spot for a date" \
or "Instagrammable brunch" is NOT being portrayed as a workspace, even if \
laptop users could use it. A café described as "spacious tables, quiet \
weekday mornings, reliable WiFi, open till 10pm" IS being portrayed as a \
workspace, even if the word "work" never appears. Apply this distinction \
consistently.

--- ARTICLE ---
Publication: {publication}
URL:         {url}
Title:       {title}
Article body (full text, truncated only if longer than ~25,000 chars):
{body_excerpt}
"""


ARTICLE_EXTRACTION_PROMPT = """\
You are extracting structured information from an editorial article (a blog \
post, listicle, or guide) about places in New York City, for a study of venues \
to WORK or STUDY in. Work the steps in order.

STEP 1 — ASSESS THE ARTICLE'S WORK FRAMING (set article_work_framing once).
Read the TITLE and the opening PREAMBLE first, then judge how strongly the \
article as a whole is framed around working/studying:
  • "explicit" — the title or preamble explicitly presents the WHOLE piece as a \
guide to places to work or study (e.g. "Best Cafés to Work From", \
"Laptop-Friendly Cafés", "Study Spots in NYC", "Where to Get Work Done"); the \
list is curated for work suitability. Work-themed section sub-headings count too.
  • "implicit" — no explicit work headline, but across the article venues are \
portrayed as work-suitable through their descriptions (quiet, spacious tables, \
reliable WiFi, outlets, long hours, good for focus).
  • "incidental" — the headline/purpose is NOT about working (e.g. "Best \
Brunch", "Prettiest Cafés", "Coolest Coffee", a food or neighbourhood guide) \
and workspace suitability is only softly or secondarily implied, in the \
preamble or for a few venues.

STEP 2 — EXTRACT EACH SPECIFIC, EXPLICITLY NAMED VENUE as a VenueMention.
How you set work_context DEPENDS on the Step 1 framing — this is the most \
important rule:
  • framing = "explicit": EVERY venue that is one of the article's actual picks \
INHERITS work_context=true, EVEN IF its own write-up mentions no amenities. The \
article-level framing already establishes these are work spots — do NOT punish \
a venue for a short or amenity-free description. (Venues named ONLY to compare \
against, or to warn readers away from, do not inherit — see mention_type.)
  • framing = "implicit": set work_context=true when the VENUE'S OWN portrayal \
carries a work signal (an amenity, or work-oriented language); otherwise false.
  • framing = "incidental": REQUIRE a per-venue work signal. A venue with no \
work/amenity mention gets work_context=false — neither the article nor its \
description portrays it as a workspace, so it should be filtered downstream.
  • LIBRARIES and study-oriented bookstore cafés are PRESUMED work_context=true \
by institutional purpose — give them the benefit of the doubt even with a brief \
write-up. BUT set work_context=false if the article shows the venue has no \
sit-down / study function (reference-only, archival / special-collections, \
children's, or lending-only with no seating).

Fields for each VenueMention:
- venue_raw: the venue's NAME exactly as written; do NOT normalize or fix \
spelling. If the article gives no usable name (e.g. it is only in an image), \
use the street ADDRESS instead — never a description like "cafe with large \
windows".
- venue_category: cafe, coffee_shop, library, university_library, \
bookstore_cafe, coworking_paid, private_library, museum, hotel_lobby, outdoor, \
or other. Use "library" for FREE PUBLIC libraries (New York Public, Brooklyn, \
Queens, etc.); "university_library" for academic / college libraries; \
"private_library" for membership libraries. (Category is mostly descriptive; \
restriction is captured by the access field below, so still label accurately.)
- access: public / restricted / unknown. Set "restricted" ONLY when the text \
explicitly indicates membership, a fee/admission, student-ID/enrolment, or \
appointment-only access; "public" for free public venues; "unknown" when the \
article does not say. Default to public/unknown — do NOT guess "restricted" \
(a separate gazetteer catches the known restricted libraries).
- work_context: per the framing rule above.
- endorsement: signed -1..+1 strength of recommendation as a place to WORK, \
calibrated to the framing:
    · explicit-framed pick, even a bare one-line listing → +0.3..+0.5 (being \
curated into a dedicated work list IS a real endorsement); +0.6..+1.0 if the \
write-up is enthusiastic or amenity-rich.
    · implicit-framed bare mention → ~+0.15.
    · incidental, non-work venue → ~0 (with work_context=false).
    · negative ONLY for an explicit caveat ("too loud to actually work"). \
These are curated editorials — do NOT manufacture negativity.
- attributes: per-attribute sentiment for noise, wifi, seating, outlets, \
crowding, accessibility, laptop_friendly, price, hours. Each is positive / \
neutral / negative WITH a SHORT supporting evidence snippet (≤12 words; a \
faithful close paraphrase of the article is fine here). Use null for any \
attribute NOT discussed — never infer from silence, and absence is NOT \
negative. A bare listing with no amenity text must have ALL attributes null.
- representative_quote: COPY a single exact span (≤20 words) straight from the \
article body — a real clause or sentence the author actually wrote about this \
venue, character-for-character. Do NOT paraphrase, stitch fragments together, \
summarise, or invent. If no single suitable span exists (e.g. a bare listing), \
use "" (empty). A post-process step DISCARDS any quote not found verbatim in \
the body, so a paraphrase here is wasted — copy exactly or leave it empty.
- location_context: any street, cross-street, neighbourhood, or borough stated \
near the venue; null if none. Important for disambiguating chains.
- is_chain_generic: true if a chain is named generically with no specific \
branch/location.
- mention_type: featured (one of the article's curated picks), passing (an \
aside, not a pick), or comparison (named only to compare). Only "featured" \
venues inherit work_context under explicit framing.
- extraction_confidence: your confidence in this extraction (0-1).

General rules:
1. Only extract venues that are SPECIFIC and explicitly named. Skip generic \
references ("a café near NYU", "the local library", "coffee shops in SoHo").
2. Extract EVERY named venue (including work_context=false ones — they are \
filtered downstream, not here).
3. Extract each venue once per article; merge repeat mentions into one.
4. Do NOT extract neighbourhoods, the publication itself, products, or people \
as venues.
5. Attribute sentiment is about THAT attribute, not the venue overall ("WiFi is \
spotty but a lovely place to work" → wifi=negative, endorsement positive).
6. Keep output COMPACT: omit amenity evidence you do not have and do not pad \
quotes. If the article names zero specific venues, return venues=[] and \
contains_no_venue=true.

--- ARTICLE ---
Publication: {publication}
URL:         {url}
Title:       {title}
Article body:
{article_text}
"""

# Backward-compatible alias (older importers referenced COMMENT_EXTRACTION_PROMPT).
COMMENT_EXTRACTION_PROMPT = ARTICLE_EXTRACTION_PROMPT


# ---------------------------------------------------------------------------
# Example usage (provider-agnostic via `instructor`)
# ---------------------------------------------------------------------------
#
#   import instructor
#   from openai import OpenAI          # OpenAI, Groq, Together, DeepSeek
#   # from anthropic import Anthropic  # Claude
#   # from google import genai         # Gemini
#   # from ollama import Client        # local Llama / Mistral / Qwen
#
#   client = instructor.from_openai(OpenAI())   # set base_url for non-OpenAI
#
#   relevance = client.chat.completions.create(
#       model="gpt-4o-mini",                     # or gemini-flash, llama3.1:8b, ...
#       response_model=ThreadRelevance,
#       messages=[{
#           "role": "user",
#           "content": THREAD_RELEVANCE_PROMPT.format(
#               subreddit="AskNYC",
#               title="Best quiet cafés to work from in the Lower East Side?",
#               body="Looking for somewhere with good wifi and outlets...",
#           ),
#       }],
#   )
#   # → relevance.is_relevant=True, confidence=0.92
#
#   extraction = client.chat.completions.create(
#       model="claude-haiku-4-5-20251001",
#       response_model=ArticleExtraction,
#       messages=[{
#           "role": "user",
#           "content": ARTICLE_EXTRACTION_PROMPT.format(
#               publication="The Infatuation",
#               url="https://www.theinfatuation.com/new-york/...",
#               title="The Best Coffee Shops For Doing Work In NYC",
#               article_text=(
#                   "Joe Coffee on Columbus has spacious tables and is quiet on "
#                   "weekday mornings, though the wifi can be unreliable..."
#               ),
#           ),
#       }],
#   )
#   # → Joe Coffee: cafe, work_context=True, endorsement~+0.6,
#   #     seating=positive, noise=positive, wifi=negative,
#   #     location_context="Columbus Ave", mention_type=featured


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
# Before trusting the pipeline output, hand-label ~50 randomly sampled comments
# and compute these metrics. Include the numbers in Section 6 of the paper.

VALIDATION_METRICS = [
    "venue_extraction_precision",   # of LLM-extracted venues, % that are correct
    "venue_extraction_recall",      # of true venues in article, % the LLM found
    "work_context_accuracy",        # accuracy of the work_context inclusion gate
    "endorsement_mae",              # mean abs error of endorsement vs human label
    "noise_sentiment_accuracy",     # 3-class accuracy on the noise attribute
]


# ---------------------------------------------------------------------------
# Tuning notes
# ---------------------------------------------------------------------------
# - If venue_extraction_recall is low: relax the "explicitly named" rule in
#   the prompt to allow common abbreviations (e.g., "WF" for Whole Foods),
#   OR run a second cheap pass with a different model and union the results.
# - If noise_sentiment_accuracy is low: examine evidence snippets — usually
#   the model is conflating crowding with noise. Add a clarifying example to
#   the prompt.
# - If endorsement_mae is high: Haiku tends to compress the scale toward the
#   positive middle on curated lists. Check that bare one-word listings land
#   near +0.15 (not 0) and that explicit caveats actually go negative; add a
#   worked example to the prompt if the spread is too narrow.
# - If work_context precision is low on libraries: confirm the library-leniency
#   default is firing (libraries should be work_context=true even with no
#   amenity discussion).
