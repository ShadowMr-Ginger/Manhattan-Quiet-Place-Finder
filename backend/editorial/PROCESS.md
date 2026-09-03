# Quiet Spaces Manhattan — Editorial Review-Mining: Full Process

**Project:** COMP47360 Research Practicum
**Track:** editorial review-mining — discover free, public, indoor, laptop-suitable
Manhattan work/study venues from editorial articles and produce a per-venue
feature set for the busyness/quietness model and the app.
**Outcome:** **326 canonical Manhattan venues**, each with an editorial sentiment
layer, a factual OpenStreetMap layer, representative quotes, and a default ranking.
Final file: `enrichment/outputs/canonical_venues_osm.jsonl`.

This document narrates the whole pipeline end to end and records the key
methodological decisions. Per-stage script detail lives in `PIPELINE.md`;
identity resolution in `RESOLUTION.md`; scoring + schema in `AGGREGATION.md`;
Stage-2 cleaning in `DATA_CLEANING.md`; app usage in `HANDOVER_APP.md`.

---

## 1. Acquisition (Discovery → Corpus → Relevance, Stage 1)

**Discovery.** Candidate article URLs were gathered with Brave Search steered by a
custom `quiet_spaces_editorial.goggle` (re-ranking toward "best cafés/libraries to
work in NYC" listicles and guides), over two query iterations and merged →
**481 unique URLs**.

**Corpus.** URLs were fetched robots-aware into an HTML cache, with article text
extracted via trafilatura (markdown mode) plus title resolution. Unreachable,
duplicate, and non-article pages fell away → **363 articles** with full text.

**Relevance (Stage 1).** Claude Haiku 4.5 classified each article for relevance
with a strict prompt (`STRICT_ARTICLE_RELEVANCE_PROMPT v3.1`); a confidence band
queued borderline cases for manual review. A deliberate **library-recovery** pass
added back 9 library guides Stage 1 had rejected (libraries are prime study spots
but read as "non-work" to a café-tuned prompt). Result: **106 relevant articles**
(97 kept + 9 recovered), with a full `relevance_log.jsonl` audit trail.

## 2. Extraction (Stage 2)

Claude Haiku 4.5 read each article and emitted **one row per venue mention** via an
`instructor`/Pydantic schema. Per mention: `venue_raw`, `venue_category`, `access`
(public/restricted), `work_context`, `article_work_framing` (explicit/implicit/
incidental), a signed `endorsement` (−1..+1), nine 3-class **attributes** (each
`{polarity, evidence}`), a **verbatim** `representative_quote` (post-validated —
non-verbatim quotes discarded), `location_context`, `is_chain_generic`,
`mention_type`, and an `extraction_confidence`. Raw output: **1,387 mentions**.

Key design choices made here and refined later:
- **Quotes are strictly verbatim** (a post-process discards any not found in the
  source), so anything shown in quotes is real and attributable.
- **Endorsement was initially calibrated to article framing** — a decision we
  later reversed (see §3.3), because baking framing into the value distorted
  comparison and aggregation.

## 3. Post-extraction correction (still Stage 2 outputs)

Three deterministic/assisted passes turned the raw extraction into a trustworthy
corpus, all writing `extractions_final.jsonl` (raw never mutated):

**3.1 Identity cleaning (`resolve_venues.py`).** 87 rows corrected: hand-verified
name fixes (descriptive placeholders → real venue + address), generic→branch
promotions, flagship-library defaults, transit-hub exclusion, folding genuine
multi-branch mentions into `is_chain_generic`, and re-tagging restricted
(private/academic/museum) libraries to their out-of-scope category — which removed
the need for a fragile name gazetteer. No rows dropped; schema unchanged.

**3.2 Attribute audit (`audit_attributes.py`).** Because ~55% of venues rest on
≤2 attribute cells, a single mis-attribution distorts a profile. A free keyword
pre-pass auto-accepted the clearly on-topic cells (≈77%); Claude Haiku validated
the remaining ~743, dropping/reassigning/re-polarising cells whose **evidence
didn't support the attribute**, and splitting a new **`restroom`** attribute out
of the muddled `accessibility` field. ~415 cells corrected, every change logged.

**3.3 Endorsement re-score (`rescore_endorsement.py`).** Diagnosis: framing had
been baked into the endorsement *value*, so a glowing review in a non-work article
scored low (incidental capped ~+0.45), and with a mean a glowing-but-incidental
mention could *drag a venue down*. Fix: re-rate the **62 non-explicit mentions
(from 7 articles)** on an **absolute** scale using each article's text, keeping the
old value as `endorsement_raw_framed`. Framing then becomes a *weight* at
aggregation, not part of the value. This lifted the deliberately-recovered
libraries from a floored ~0.4 onto a fair 0.5–0.8.

## 4. Canonicalization (Stage 6)

**4.1 Scope filter (`scope.py`).** A mention is out of scope if `work_context=
false`, its `venue_category` is out of scope (museum/outdoor/coworking_paid/
private_library/university_library), `access=restricted`, `is_chain_generic`, or
`mention_type != featured` (a deliberate "no venue earns a place on a single
passing mention" rule). **1,387 → 287 dropped → 1,100 in-scope → 1,018 distinct
`(venue_raw, location_context)` pairs.**

**4.2 Identity resolution.** Each distinct pair → a Google Places `place_id`
(Pro-tier Text Search, kept inside the free quota; cached/resumable). A chain of
refinements followed, each backed up and logged:
- `requery_review.py` — noisy `location_context` made Text Search latch onto
  landmarks; re-querying name-first recovered ~37, with wrong "rescues" re-flagged.
- `apply_corrections.py` — a human-reviewed sheet (accept / drop / recheck /
  override) resolved the residue; we set a **rebrand→drop, relocation→keep** policy.
- `recover_named_addresses.py` — one listicle had been extracted as bare addresses;
  the café names were recovered and re-resolved (several merged with existing
  venues — correct dedup).
- `merge_subvenues.py` — rooms inside a venue that Google gives their own
  `place_id` (e.g. the Rose Main Reading Room inside NYPL) were merged into their
  parent; a handful of late out-of-scope finds (NYU Kimmel, non-workspace venues)
  dropped. A Street-View check untangled the Kaffe Tribeca cluster.

**4.3 Aggregation + scoring (`aggregate_venues.py`).** Mentions are grouped by
`place_id`, dropping manual-dropped, **permanently-closed** (Google
`businessStatus`, 57) and **non-Manhattan** (ZIP filter, 187) rows → **326
canonical venues**. Scoring decisions, each evidence-driven:
- **Endorsement = framing-weighted mean of the (absolute) values.** `mention_type`
  (96% "featured") and `extraction_confidence` (near-constant; its low values were
  naming issues we'd already hand-fixed) were dropped from the weight as noise.
- **No shrinkage on the displayed score** — but a separate, hidden **`ranking_score`**
  (empirical-Bayes shrink toward the global mean, `k=1`) sets default sidebar order
  so a thin one-off rave can't top a well-reviewed venue. Raw mean + `mention_count`
  are shown so the user judges thin evidence.
- **Attributes are raw positive/neutral/negative counts**, not a mean — a mean
  hides both volume and disagreement (a lone +1 would outrank nine-pos/one-neg).
  Each carries `net` and one paraphrased `note`. Rendered as a stacked bar.
- Up to **3 verbatim quotes**, strongest first, with publication + URL.

## 5. OpenStreetMap enrichment (Stage 7)

A factual layer (presence-of) to complement the editorial sentiment layer, and —
being ODbL — storable indefinitely with attribution. `osm_enrich.py` fetches all
Manhattan café/library/restaurant/bar/hotel POIs from Overpass (one bbox query),
then matches each venue **spatially first** — the OSM POI at the venue's stored
lat/lng (≤60 m), accepted on a strong name match, or a weak one only if ~on the
point (Manhattan storefronts are too dense for distance-only matching). **239/326
matched (73%)**, all verified clean; the 87 misses are genuine OSM coverage gaps
(concentrated in the single-mention long tail). Four spacing/punctuation variants
were hand-recovered; two libraries OSM lacks a `wheelchair` tag for carry a sourced
`accessibility_manual` field.

Tags captured: `internet_access`, `toilets`(+access/wheelchair), `wheelchair`,
`opening_hours`, `outdoor_seating`/`indoor_seating`/`capacity`, `cuisine`,
`takeaway`, `air_conditioning`, `level`, `diet:*`, more. The big win:
**accessibility coverage went from 9 editorial cells to 82 venues**, and
`opening_hours` (161) is storable where Google's is not. NYC Open Data was
evaluated and ruled out — its strongest use (library accessibility) was already
covered by OSM, and no government dataset carries the workspace attributes we need.

## 6. The final dataset

`enrichment/outputs/canonical_venues_osm.jsonl` — 326 venues, each with:
identity (`place_id`, name, address, lat/lng, type, business status); popularity
(`mention_count`, `unique_sources`); scores (`endorsement_score` displayed,
`ranking_score` for sort); ten attribute count-bars (+notes); ≤3 verbatim quotes;
and the `osm` factual layer (+ `accessibility_manual` where needed). Two layers
are kept **separate and raw** — sentiment vs fact — for the app to combine. Field
usage is specified in `HANDOVER_APP.md`.

## 7. Cross-cutting principles

- **Raw is never destroyed; every transform is logged and reversible** (backups +
  change logs at each stage).
- **Filters key on persistent fields** set upstream, so scope decisions are
  consistent and auditable (no fragile name gazetteers).
- **Show real evidence, never synthesised** — verbatim quotes only; attribute notes
  are clearly paraphrase, never quoted.
- **Separate the questions**: quality (endorsement) vs prominence (count) vs
  busyness (attributes/real-time) are distinct axes, never collapsed into one number.
- **Licensing respected throughout**: store `place_id` + our derived data + OSM
  (ODbL, attributed); Google coordinates cached within ToS.

## 8. Snapshot note
Counts and the OSM layer are a point-in-time build. OSM is live, so re-running the
enrichment later would shift coverage (likely upward).
