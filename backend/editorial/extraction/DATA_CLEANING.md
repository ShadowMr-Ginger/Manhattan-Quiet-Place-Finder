# Data Cleaning Stage — Editorial Venue Extractions

**Project:** COMP47360 Research Practicum — *Quiet Spaces Manhattan*
**Stage:** Stage-2 post-processing (venue resolution & cleaning)
**Scripts:** `extraction/resolve_venues.py` (deterministic identity cleaning) →
`extraction/audit_attributes.py` (attribute–evidence audit, §8)
**Input:** `extraction/outputs/extractions.jsonl` — 1,387 raw venue mentions (106 articles)
**Output:** `extraction/outputs/extractions_final.jsonl` — same 1,387 rows, **87 edited**
by `resolve_venues`, then attribute cells corrected in place by `audit_attributes`

---

## 1. Purpose

Stage 2 used an LLM (Claude Haiku 4.5) to extract one row per venue mention from
each relevant article. That raw output contains a small number of extraction
artefacts (garbled names, generic chain mentions, mis-classified libraries) and
mentions that cannot be tied to a single physical place. This cleaning stage
corrects those artefacts and standardises venue identity so the corpus can be
resolved to Google Places `place_id`s in the canonicalization stage.

## 2. Principles

- **Deterministic & reproducible.** Every change is encoded as an explicit rule
  in `resolve_venues.py`; re-running the script reproduces the output exactly.
- **Raw is never modified.** The script reads `extractions.jsonl` and writes a
  separate `extractions_final.jsonl`.
- **No rows dropped here.** Cleaning only *corrects and annotates*. Out-of-scope
  exclusion is deferred to canonicalization, where it is logged (`drop_log.jsonl`).
- **Schema-preserving.** No new fields are added; the field set is byte-identical
  to Stage 2.
- **Minimal & auditable.** `resolve_venues.py` touches only venue-identity fields
  (`venue_raw`, `location_context`, `venue_category`, `is_chain_generic`,
  `work_context`); sentiment, quote, and provenance fields are left untouched.
  Attribute cells are corrected in a **separate, separately-logged** pass
  (`audit_attributes.py`, §8) so identity cleaning and attribute cleaning stay
  independently auditable.

## 3. The seven transformations (87 rows)

### 3.1 Name corrections — 12 rows (`venue_raw`, `location_context`)
Some mentions emerged from Stage 2 without a usable name: either an explicit
placeholder (`<UNKNOWN>`, `unnamed East Harlem spot`) or a descriptive phrase
(`coffee shop in the bottom of a FiDi residential building`) — usually because
the venue's name lived in an image/heading the article extractor could not read.
Each was hand-resolved to the real venue name and a specific address by reading
the source article, its cached HTML, or the web.
*Examples:* El Barrista (2154 Third Ave), Conwell Coffee Hall (6 Hanover St),
Cafe W (Flushing), Silence Please (132 Bowery), Birdee (316 Kent Ave),
Ngatso Cafe (39-08 63rd St, Woodside).

### 3.2 Generic → specific branch, automatic — 11 rows (`is_chain_generic`→false, `location_context`; +1 `venue_raw`)
Chain mentions flagged `is_chain_generic` where the article unambiguously points
to one branch were promoted to that branch (kept neighbourhood-level so Places
pins the exact address).
*Examples:* Joe Coffee → West Village; Stumptown → Cobble Hill; Think Coffee →
Tribeca; "2nd floor Starbucks on Dey St" → Starbucks (Dey St); La Colombe → Tribeca.

### 3.3 Generic → branch, manual review — 4 rows (`is_chain_generic`→false, `location_context`)
The remaining generics were exported to a spreadsheet (`generics_to_review.numbers`)
and reviewed by hand; four named a single branch in the article and were promoted.
*Resolved:* Ace Hotel → 20 W 29th St (NoMad); New York Public Library → 476 5th Ave
(Schwarzman); Think Coffee → 248 Mercer St; Gregorys Coffee → 58 W 44th St.

### 3.4 Flagship library defaults — 8 rows (`location_context`; +1 `is_chain_generic`)
Bare system-level library names with no branch named in the article
("The New York Public Library", "Brooklyn Public Library", "Queens Library")
were defaulted to the system flagship — verified by first checking the article
for a specific branch.
*Defaults:* NYPL → Stephen A. Schwarzman Building (476 5th Ave); Brooklyn Public
→ Central Library (Grand Army Plaza); Queens → Central Library (Jamaica).

### 3.5 Transit-hub exclusion — 2 rows (`work_context`→false)
`Penn Station` and `Grand Central` were extracted as work spots, but the source
listed them under "transit stations with charging… useful between study
locations" — i.e. not workspaces. Their `work_context` was set false so the
downstream scope filter drops them.

### 3.6 Multi-branch fold — 30 rows (`is_chain_generic`→true)
A mention whose `location_context` names several branches cannot map to a single
`place_id`, so it is treated identically to a generic chain mention and folded
into `is_chain_generic=true`. To avoid wrongly folding single venues, only
**reliable** signals trigger this: ≥2 distinct street addresses, ≥3 distinct
neighbourhoods, or an explicit "multiple / branches / locations" phrase. Bare
two-neighbourhood descriptors ("Greenwich Village / West Village") are **not**
folded — that pattern is usually one venue described loosely.
*Examples folded:* Devoción ("Williamsburg, Flatiron, Downtown Brooklyn, …"),
The Bean ("31 3rd Ave, 771 Broadway, 54 2nd Ave"), Little Ruby's (5 neighbourhoods).
*Examples spared:* Hungarian Pastry Shop, Cafe Reggio, Amano (single venues).

### 3.7 Restricted-library category re-tag — 20 rows (`venue_category`)
Some restricted (private / academic / museum) libraries were mis-classified by
the LLM as plain `library` (or `coffee_shop`/`bookstore_cafe`). Re-tagging them
to the correct out-of-scope category lets the canonicalization scope filter
exclude them **by category** — a deterministic rule on a persistent field, which
replaced an earlier (less reliable) name-pattern gazetteer.
*Re-tags:* Morgan Library & Museum → `museum`; New York Society Library, The
Center for/of Fiction, The Othmer Library, New York Academy of Medicine,
National Archives → `private_library`; Jack Brause Library, NYU Bobst →
`university_library`.

## 4. How the issues were surfaced (confidence-driven QA)

Several artefacts above — especially the descriptive non-names in §3.1 — were
not found by manually scanning 1,387 rows but by a **confidence-driven QA pass**.
Stage 2 records an `extraction_confidence` (0–1) per mention: the model's own
certainty that the venue and its attributes were extracted correctly.
`extraction/flag_extractions_for_review.py` queues every mention below a
threshold (default `<0.75`; a focused band `<0.60`). Because unnamed/descriptive
venues gave the model little to anchor on, they scored ~0.40–0.50 and rose to the
top of that queue — which is exactly how **Silence Please, The Twisted Spine,
Soft Bar, Birdee, Overflow Coffee and Verse Cafe** were identified and then
resolved in §3.1. The same pass confirmed the rest of the corpus is
high-confidence (**1,089 of 1,387 mentions ≥ 0.90**), so the manual review was
small and targeted.

This confidence is **one-sided**: low values flag uncertain extractions for
review; there is no "too-confident" ceiling (unlike the Stage-1 *relevance*
confidence, which used a two-sided band because both very-low and very-high were
auto-decided). Confidence is also carried forward as a per-mention weight in the
downstream endorsement/attribute aggregation, so shakier extractions count less.

## 5. Integrity verification

A field-by-field diff of `extractions_final.jsonl` against the raw Stage-2 file
confirmed:

| Field altered | Rows |
|---|---|
| `is_chain_generic` | 46 (16 true→false generic-resolved, 30 false→true multi-branch) |
| `location_context` | 35 |
| `venue_category` | 20 |
| `venue_raw` | 13 |
| `work_context` | 2 |

- **87 distinct rows changed** (of 1,387); row count unchanged.
- **Zero unexpected field changes** — `endorsement`, `attributes`,
  `representative_quote`, `quote_verbatim`, `access`, `mention_type`, and all
  source/provenance fields are byte-identical to raw.
- **Schema identical** to Stage 2 (no stray bookkeeping flags).

## 6. Lineage & reproducibility

```
extraction/outputs/extractions.jsonl        (raw Stage 2, 1,387 mentions)
      │   extraction/resolve_venues.py       (rule maps: NAME_FIXES, AUTO,
      ▼                                        MANUAL, FLAGSHIP, CATEGORY_FIX,
extraction/outputs/extractions_final.jsonl   is_multi_branch, TRANSIT_OUT)
```
Human decisions are preserved in the rule maps in `resolve_venues.py` and in the
review record `extraction/outputs/generics_to_review.numbers`.

## 7. Downstream

`extractions_final.jsonl` feeds the canonicalization stage
(`canonicalization/`), where `scope.py` excludes out-of-scope mentions
(work_context=false, out-of-scope category, access=restricted, is_chain_generic)
— **240 dropped, logged in `drop_log.jsonl`**, leaving 1,147 in-scope mentions
(1,018 distinct name+location pairs) to resolve to Google Places `place_id`s.

---

## 8. Attribute–evidence audit (`audit_attributes.py`)

### 8.1 Why
Each attribute is a `{polarity, evidence}` cell. Because **~55% of in-scope
venues rest on ≤2 attribute cells** (123 on zero, 216 on one, 217 on two), a
single mis-attributed cell can dominate a venue's profile — aggregation cannot
average the error away when there is almost nothing to average over. A spot audit
also found the `accessibility` attribute is semantically muddled: of 76 in-scope
accessibility cells, ~37 are about **restrooms**, only ~9 about genuine
disability access, and ~30 vague or mis-tagged. This pass validates every
attribute cell against the words it was drawn from.

### 8.2 How (two phases)
1. **Rule pre-pass (free).** A tight, attribute-specific keyword test
   (`STRONG` in the script) auto-accepts cells whose evidence unambiguously
   matches their attribute. `accessibility` is **never** auto-accepted (its
   keywords overlap "bathroom/restroom", so those cells must reach the LLM to be
   split into `restroom`). This flags **795 of 3,224 cells (25%)** for review.
   Tight patterns mean false *auto-accepts* are rare; flagged-but-correct cells
   are simply re-confirmed by phase 2, so the cost of over-flagging is only a few
   tokens. The pre-pass checks *topic* only, not polarity — so when budget allows,
   `--all` sends every cell to the LLM (≈129 calls, ~180k tokens, ≈$0.40) and
   additionally re-checks the sign of every otherwise-confident cell.
2. **LLM pass (Claude Haiku 4.5 via `instructor`).** Flagged cells are sent in
   batches of 25 (~30 calls, ~42k tokens, a few cents). For each cell the model
   returns the attribute the evidence *actually* describes — the nine attributes,
   a new **`restroom`** label split out of `accessibility`, or `none` (drop) —
   plus the correct polarity. Cells are then **kept**, **re-polarised**,
   **reassigned**, or **dropped**.

### 8.3 Outputs & integrity
- Corrected attribute cells written back into `extractions_final.jsonl` **in
  place** (identity fields untouched).
- `attribute_audit_log.jsonl` — one row per change
  (`venue_raw`, `source_url`, `action`, `attribute`, `new_attribute`,
  `old_polarity`, `new_polarity`, `evidence`), making every edit reversible.
- Introduces one new attribute key, **`restroom`** (toilet availability), so the
  downstream EDI/accessibility layer is not contaminated by bathroom mentions.
  (Genuine disability access still comes from OSM `wheelchair=*` / NYC Open Data,
  not from this corpus.)
- **Order matters:** run `resolve_venues.py` first, then `audit_attributes.py`.
  Re-running `resolve_venues.py` regenerates `extractions_final.jsonl` from raw
  and therefore requires re-running the audit.

```
python resolve_venues.py                      # identity cleaning (raw -> final)
python audit_attributes.py --dry-run          # rule pre-pass only (free)
python audit_attributes.py                    # full audit (needs ANTHROPIC_API_KEY)
```
