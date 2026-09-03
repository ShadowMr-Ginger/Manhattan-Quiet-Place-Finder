# Canonicalization Stage — Venue → Google Places `place_id`

**Project:** COMP47360 Research Practicum — *Quiet Spaces Manhattan*
**Stage:** Stage 6 (identity resolution; precedes aggregation)
**Scripts:** `resolve_places.py` → `requery_review.py` → `apply_corrections.py` → `recover_named_addresses.py` → `merge_subvenues.py` (+ a field-verified Kaffe patch)
**Input:** `extraction/outputs/extractions_final.jsonl` — 1,387 cleaned mentions
**Output:** `outputs/place_resolution.jsonl` — 1,018 distinct pairs, each resolved to a `place_id` or marked `manual_drop`

---

## 1. Purpose

The cleaning stage standardised venue *identity strings*; this stage maps each
distinct venue to a stable **Google Places `place_id`** — the key the aggregation
and the live app use to merge mentions, place pins, and (later) attach
open-data/EDI layers. A `place_id` is the only Google field we may store
indefinitely, so resolving correctly here is what makes the downstream dataset
durable. The stage also decides what is *out of scope* and records why.

## 2. Principles

- **One physical place = one resolution.** We resolve each distinct
  `(venue_raw, location_context)` pair once (not per mention); a café named in
  eight articles is one place, resolved once and reused.
- **Nothing is silently discarded.** Out-of-scope and dropped pairs are kept in
  the file with an explicit `drop_reason` / `manual_drop`, not deleted — the row
  count is invariant (1,018) at every step.
- **Every automated step is reversible.** Each script snapshots the file before
  writing (`place_resolution.backup.jsonl`, `place_resolution.preapply.jsonl`)
  and logs its changes (`requery_log.jsonl`, `apply_log.jsonl`).
- **Free-tier by design.** The Places field mask is held to the Pro tier
  (`id, displayName, formattedAddress, location, types, businessStatus`), so the
  ~1,018 lookups stay inside the free monthly allowance. Review aggregates and
  opening hours are deliberately *not* requested (not needed, not storable).
- **Improve-or-keep.** No automated retry is allowed to make a confident match
  worse; a candidate replaces the incumbent only when it scores higher *and*
  lands in Manhattan.
- **Humans decide identity edge cases.** Where the data is genuinely ambiguous
  (closures, rebrands, multi-branch chains), the call is escalated to a
  ground-truth review rather than guessed.

## 3. The pipeline (six steps)

### 3.1 Scope filter — `scope.py` (240 dropped)
A pair is excluded *before* any API call if any persistent field says so:
`work_context=false`, an out-of-scope `venue_category`
(museum / outdoor / coworking_paid / private_library / university_library),
`access=restricted`, or `is_chain_generic=true` (incl. folded multi-branch).
**1,387 mentions → 240 dropped (logged in `drop_log.jsonl`) → 1,147 in-scope.**

### 3.2 Distinct-pair dedup (1,147 → 1,018)
The 1,147 in-scope mentions collapse to **1,018 distinct
`(venue_raw, location_context)` pairs** — the unit of resolution.

### 3.3 First-pass resolution — `resolve_places.py`
Each pair is sent to Places Text Search with a Midtown location bias (so chains
pin to the NYC branch). The top candidate's name is compared to `venue_raw` with
`rapidfuzz`; a pair is flagged `needs_review` if similarity < 80 or there were
multiple close candidates. Results are cached in `place_cache.json` (resumable,
no double-billing).
**Result: 1,018 resolved, 3 no-match, 110 flagged for review.**

### 3.4 Re-query of flagged pairs — `requery_review.py`
The dominant first-pass failure was a **noisy query**: a descriptive
`location_context` ("close to Katz's", "near NYU") made Text Search latch onto a
nearby *landmark*. This step retries each flagged pair with cleaner queries
(name-only, and name + the street address parsed out of the prose), keeping a new
candidate only if it beats the incumbent and is in Manhattan. Pairs the article
explicitly places in another borough are skipped (dropped downstream anyway).
**Result: 90 retried → 40 improved (37 cleared the flag); 11 wrong recoveries
re-flagged** (chain wrong-branch / different same-named business).

### 3.5 Manual review — `manual_review.csv` + `apply_corrections.py`
The remaining 83 flagged pairs were exported to a review sheet with article
`source_url`s. Each got a decision — **accept** (correct, name-variance only),
**drop**, **recheck** (a corrected query I supplied), or an explicit
**user override** (query / `place_id` / "drop") for the cases needing
ground-truth. `apply_corrections.py` applied them: re-resolving rechecks/overrides
via Text Search (or Place Details for a pasted `place_id`), clearing accepts, and
marking drops `manual_drop`. The aggregator honours `manual_drop` (rows kept on
disk for audit, excluded from output).
**Result: 31 accept, 22 re-resolve, 30 drop; 9 left flagged.**

### 3.6 Ground-truth resolution of the residue
The final 9 were field-checked (Google Street View, April 2026). Eight were
**closed or rebranded** (the address now hosts a different business —
WhyNot→Una Pizza, Kobrick→Corvo, Aroma→Cafe Aroma, …) and one was a bad
auto-clear (Shakespeare & Co → a downtown theatre); all were dropped. A separate
field check untangled the **Kaffe** cluster: five mentions had over-merged onto
one `place_id` because all three Tribeca branches share the bare name "Kaffe".
They were re-mapped to the two correct branches (275 Greenwich ×4, 401 Greenwich
×1) using `place_id`s already in hand.
**Result: needs_review = 0.**

### 3.7 Name recovery for address-only rows — `recover_named_addresses.py`
Ten pairs from a single listicle had been extracted as bare street addresses (no
café name), so they resolved to address points (`type=street_address`, no
`business_status`). The names were recovered by hand from the source article and
each pair re-resolved to the real business — **keeping `venue_raw`/`location_context`
unchanged** (they are the join keys to the mentions) and only upgrading the
resolved fields. Six of the ten landed on a `place_id` already in the set and
**merged** with the existing venue (Variety Coffee, Ariston, Felix Roasting,
Conwell, La Cabra, Cafe Regular); two are new Manhattan cafés (Lê Phin, Café
Lyria); two are new Brooklyn cafés (drop at aggregation).
**Result: every kept row now has a business listing + `business_status`; distinct
kept `place_id`s 510 → 504.**

### 3.8 Sub-venue merge + late drops — `merge_subvenues.py`
A final pass on issues that only surface once venues are resolved and viewed
together. Google gives some *rooms inside a venue* their own `place_id`; these are
remapped onto the parent so they aggregate as one place:
Rose Main Reading Room → NYPL Schwarzman, Thomas Yoseloff Business Center → SNFL,
Lobby Bar → Ace Hotel, Hudson Eats + Winter Garden → Brookfield Place, and a
duplicate Church-of-the-Heavenly-Rest listing deduped. The same pass drops a small
set found out of scope on inspection: the NYU Kimmel Center (student-access) and a
Peet's inside it, and four non-workspace venues (two nail-studio branches, a
wellness hub, an organic-meal spot) from one weak source. Permanently-closed
venues are filtered separately — see below.

### 3.9 Permanently-closed filter (in `aggregate_venues.py`)
Google's `businessStatus` (kept from resolution) is used to drop venues marked
`CLOSED_PERMANENTLY` — **57 mentions / venues** that were written up in the
articles but have since shut. `CLOSED_TEMPORARILY` is kept (status carried into
the output for a badge).

## 4. Rebrand vs. relocation policy

Two identity cases recur and are treated differently:

- **Rebrand / new ownership → drop.** A change of operator can flip the exact
  signals the model depends on (noise tolerance, laptop/outlet policy, layout),
  so the article's hand-review describes a venue that effectively no longer
  exists. Such cases surface naturally as *low* match confidence (the name
  changed), so they land in the review pile by construction; a scan of all 791
  kept Manhattan venues for name divergence found **no rebrands hiding among the
  confident matches** — they were all benign (generic chains, host venues,
  institutional renames). Detectable rebrands ≈ the 9 dropped here.
- **Relocation → keep, resolved to the current address.** Same operator and
  identity means atmosphere and policy travel with the venue; we pin the *current*
  `place_id` so the live map is right, accepting that article-derived physical
  attributes (seat/outlet counts) may reflect the prior site. Only one case
  (Townhouse Cafe) surfaced; relocations are otherwise invisible and benign
  because a moved venue keeps its name and resolves cleanly to its new address.

A same-name reopening under new ownership is undetectable from Google data — the
on-the-ground review is the backstop.

## 5. Integrity verification

A reconciliation from the pre-requery snapshot to the final file confirmed:

| Check | Result |
|---|---|
| Distinct pairs at every stage (backup / preapply / final) | 1,018 = 1,018 = 1,018 |
| Pair key-sets identical across stages; duplicates | identical; 0 dupes |
| In-scope mentions covered by a resolution row | 1,147 → 1,018 pairs, **0 missing**, 0 orphan rows |
| `needs_review` remaining | **0** |
| Dropped rows still flagged / kept rows still flagged | 0 / 0 |
| Kept rows missing a core field | **0** (the 10 address-only rows fixed in §3.7) |

The 10 originally-missing `business_status` were pairs whose `venue_raw` was a
**bare street address** (no business name was ever extracted); Google returned the
address point (`type: street_address`). These were an extraction carry-over, not a
resolution error, and were resolved to real businesses in §3.7.

## 6. Lineage & reproducibility

```
extraction/outputs/extractions_final.jsonl
      │  resolve_places.py        → extractions_in_scope.jsonl, drop_log.jsonl, place_cache.json
      ▼
place_resolution.jsonl            (first pass)
      │  requery_review.py        → place_resolution.backup.jsonl, requery_log.jsonl
      ▼
place_resolution.jsonl            (re-queried)
      │  apply_corrections.py     ← manual_review.csv
      │                           → place_resolution.preapply.jsonl, apply_log.jsonl
      ▼
place_resolution.jsonl            (manual decisions + Street-View Kaffe patch)
      │  recover_named_addresses.py → place_resolution.prerecover.jsonl, recover_log.jsonl
      ▼
place_resolution.jsonl            (address-only rows recovered)  ← input to aggregate_venues.py
```
Human decisions live in `manual_review.csv`; every machine step has a backup and
a change log, so the file can be rebuilt or audited at any point.

## 7. Downstream

`aggregate_venues.py` joins the in-scope mentions to these resolutions, **skips
`manual_drop`, permanently-closed, and non-Manhattan rows**, and collapses by
`place_id` into one row per canonical venue. The endorsement re-score
(`extraction/rescore_endorsement.py`) and the full scoring method + output schema
are documented in **`AGGREGATION.md`**. Result: **326 canonical Manhattan venues**.

## 8. Numbers at a glance

```
1,387 mentions
  − 287 out-of-scope (scope.py: work_context / category / access / chain-generic /
                      not-featured — logged)
= 1,100 in-scope → 1,018 distinct pairs resolved → needs_review = 0
then at aggregation:
  − manual_drop (incl. closed-rebranded, sub-venue merges, NYU/non-workspace drops)
  − 57 permanently-closed (Google businessStatus)
  − 187 non-Manhattan (ZIP filter)
= 326 canonical Manhattan venues
```
