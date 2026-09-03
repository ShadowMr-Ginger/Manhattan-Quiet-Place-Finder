# Editorial Review-Mining Pipeline — Quiet Spaces Manhattan (COMP47360)

The editorial track discovers Manhattan work/study venues from editorial articles
(listicles, guides, blogs) and produces a per-venue feature set for the
busyness/quietness model. Stages run in order; each folder is one stage with its
scripts and an `outputs/` directory.

```
discovery → corpus → relevance(S1) → extraction(S2) → cleaning+audit+rescore
          → canonicalization(S6) → OSM enrichment(S7)
```

## 1. discovery/  — find candidate article URLs
- `discover_editorial_urls.py` (Brave Search + `quiet_spaces_editorial.goggle`, 2 query iterations), `merge_url_lists.py`
- **out:** `editorial_urls_merged.jsonl` (481 unique URLs)

## 2. corpus/  — fetch + extract article text
- `fetch_editorial_corpus.py` (robots-aware fetch → `cache/` HTML; trafilatura **markdown** extraction + title resolution), `reextract_corpus.py` (re-extracts offline from cache)
- **out:** `editorial_corpus.jsonl` (363 articles, full text)

## 3. relevance/  — Stage 1: article relevance filter
- `stage1_relevance.py` (Claude Haiku 4.5, `STRICT_ARTICLE_RELEVANCE_PROMPT v3.1`), `reflag_review_threshold.py`, `demote_reviewed.py`
- Manual review + a deliberate **library-recovery** pass (9 library articles Stage 1 had rejected), merged via `../merge_jsonl.py`
- **out:** `relevant_articles.jsonl` (97 kept) + `library_recovery.jsonl` (9) → `relevant_articles_augmented.jsonl` (106); `relevance_log.jsonl` (full audit)

## 4. extraction/  — Stage 2: LLM venue extraction + resolution
- `stage2_extraction.py` (Claude Haiku 4.5, `ARTICLE_EXTRACTION_PROMPT`) → one row per venue mention with category, access, work_context, framing, signed endorsement, 3-class attributes + evidence, verbatim representative_quote, location_context, is_chain_generic, mention_type, confidence.
- `resolve_venues.py` — deterministic post-processing on the raw output: 37 hand-verified resolutions (name fixes, generic→branch, flagship library defaults, transit-hub exclusion); **folds genuine multi-branch mentions into `is_chain_generic=true`** (≥2 addresses, ≥3 neighbourhoods, or an explicit "multiple/branches/locations" phrase — bare 2-neighbourhood descriptors are NOT folded, to avoid dropping single venues); and **re-tags restricted libraries the LLM mis-classified to their out-of-scope category** (private_library / university_library / museum), which removes the need for a name gazetteer. No rows dropped, schema unchanged.
- `flag_extractions_for_review.py` — QA: surfaces low-confidence / chain-generic / out-of-scope rows.
- `audit_attributes.py` — second cleaning pass over the `{polarity, evidence}` attribute cells: a free keyword pre-pass auto-accepts 2,481/3,224 cells (77%); Claude Haiku validates the 743 flagged cells, dropping/reassigning/re-polarising those whose evidence doesn't support the attribute, and splitting a new `restroom` attribute out of `accessibility`. Writes corrected cells back into `extractions_final.jsonl` and logs every change to `attribute_audit_log.jsonl`. Run **after** `resolve_venues.py`. Rationale: ~55% of venues rest on ≤2 attribute cells, so one mis-attribution distorts the whole profile.
- `rescore_endorsement.py` — re-rates the 62 non-explicit mentions (7 articles) to an **absolute** endorsement using each article's text, so framing can be applied as a weight downstream instead of being baked into the value (libraries were being floored ~0.4). Old value kept as `endorsement_raw_framed`.
- **out:** `extractions.jsonl` (raw, 1,387 mentions across 106 articles) → **`extractions_final.jsonl`** (canonical: 37 fixes + 30 multi-branch folded + 20 library category re-tags, attribute cells audited, 62 non-explicit endorsements re-scored); `attribute_audit_log.jsonl`, `endorsement_rescore_log.jsonl`

## 5. canonicalization/  — Stage 6: Google Places identity + aggregation
- `scope.py` — shared scope filter (no name gazetteer). A mention is out of scope if: `work_context=false`; `venue_category` in museum/outdoor/coworking_paid/private_library/university_library; `access=restricted`; `is_chain_generic=true` (incl. folded multi-branch); or `mention_type != featured` (stricter corpus — no venue on a single passing mention).
- `resolve_places.py` → `requery_review.py` → `apply_corrections.py` → `recover_named_addresses.py` → `merge_subvenues.py` — resolve each distinct `(venue_raw + location_context)` pair → `place_id` (Pro-tier Text Search, cached/resumable), then re-query noisy matches, apply a manual-review sheet, recover address-only café names, and merge sub-venues (a room inside a venue → its parent) + drop late out-of-scope finds. Full detail in **`RESOLUTION.md`**.
- `aggregate_venues.py` — joins mentions → `place_id`; drops manual-dropped, **permanently-closed** (Google `businessStatus`) and **non-Manhattan** (ZIP 10001–10282); writes `canonical_venues.jsonl`. Scoring: endorsement = framing-**weighted** mean of absolute values (displayed) + a shrunk `ranking_score` (default order only); attributes = **raw positive/neutral/negative counts** (+ `net`, one paraphrase note); ≤3 verbatim quotes. Schema + method in **`AGGREGATION.md`**.
- Numbers: 1,387 → **287 out-of-scope** → **1,100 in-scope → 1,018 pairs resolved** → after closed/non-Manhattan/merge drops, **326 canonical Manhattan venues**. ToS: store `place_id` + derived features only.

## 6. enrichment/  — Stage 7: OpenStreetMap attribute layer
- `osm_enrich.py` — adds a factual OSM tag layer to each venue (presence-of, vs the editorial layer's sentiment). **Spatial-first matching**: one Overpass `around` query at each venue's stored lat/lng (~45 m), matched by proximity with name as a confirmation/tiebreak — no city-wide fuzzy matching, no API key. Caches the raw response to `outputs/osm_raw.json`.
- Tags captured: `internet_access` (wifi), `toilets`(+access/wheelchair) (restroom), `wheelchair`(+description) (EDI), `opening_hours` (hours), `outdoor_seating`/`indoor_seating`/`capacity` (seating), `cuisine`/`takeaway` (type/scope), `air_conditioning`/`smoking`/`drinking_water` (comfort), `level`/`building:levels` (space), `diet:*`, `operator`/`brand`. OSM becomes the **primary** source for accessibility + restroom (editorial is too sparse).
- **out:** `outputs/canonical_venues_osm.jsonl` — canonical venues + an `osm` block each (or null) + a coverage report. **239/326 matched (73%)**, clean; the 87 unmatched are OSM coverage gaps. Two libraries OSM lacks get a sourced `accessibility_manual` field, so accessibility covers 82 venues (vs 9 editorial). ODbL: store freely **with attribution** ("© OpenStreetMap contributors").

## Shared
- `prompts.py` — all Pydantic schemas + the Stage-1 and Stage-2 prompts
- `merge_jsonl.py` — generic JSONL merge utility
- `HANDOFF.md` — original Stage-1 → Stage-2 handoff note (historical)

## Final dataset lineage
`extraction/outputs/extractions.jsonl` (raw Stage 2)
→ `resolve_venues.py` → `audit_attributes.py` → `rescore_endorsement.py`
→ `extraction/outputs/extractions_final.jsonl`
→ `resolve_places.py` → `requery_review.py` → `apply_corrections.py` → `recover_named_addresses.py` → `merge_subvenues.py`
→ `canonicalization/outputs/place_resolution.jsonl`
→ `aggregate_venues.py`
→ **`canonicalization/outputs/canonical_venues.jsonl`** — 326 Manhattan venues
→ `enrichment/osm_enrich.py`
→ **`enrichment/outputs/canonical_venues_osm.jsonl`** — venues + OSM factual layer (the deliverable)
