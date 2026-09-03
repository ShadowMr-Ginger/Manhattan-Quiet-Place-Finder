# Aggregation Stage & `canonical_venues.jsonl` Schema

**Project:** COMP47360 Research Practicum — *Quiet Spaces Manhattan*
**Stage:** Stage 6b (final) — collapse mentions into one row per venue
**Script:** `aggregate_venues.py`
**Inputs:** `../extraction/outputs/extractions_final.jsonl` (mentions) + `outputs/place_resolution.jsonl` (identities)
**Output:** `outputs/canonical_venues.jsonl` — **326 Manhattan venues**, one row each

---

## 1. What it does

Each in-scope mention is joined to its Google Places resolution by
`(venue_raw, location_context)` and grouped by `place_id`. A venue is excluded if
its mention is out of scope (`scope.py`), or its resolution is manual-dropped,
unresolved, `CLOSED_PERMANENTLY`, or non-Manhattan (ZIP 10001–10282). The
surviving mentions of each `place_id` are aggregated into one venue row.

```
1,100 in-scope mentions
  − 39  manual-dropped (out-of-scope / closed-rebranded / sub-venue merges / drops)
  − 57  permanently closed (Google businessStatus)
  − 187 non-Manhattan
= 817 mentions → 326 canonical venues
```

## 2. How the scores are built

**Endorsement (continuous, −1…+1).** Every mention has an *absolute*
endorsement (Stage 2, with the 62 non-explicit mentions re-rated to absolute by
`rescore_endorsement.py`). The article's framing is applied here as a **weight**,
not baked into the value: explicit 1.0, implicit 0.8, incidental 0.5.

- `endorsement_score` = framing-weighted **mean** of the mentions' values. This is
  the **displayed rating**; it is shown next to `mention_count` so a reader can
  judge thin evidence themselves. (No shrinkage — a glowing one-off keeps its score.)
- `ranking_score` = the same mean **shrunk** toward the global average
  (`(W·mean + K·global)/(W+K)`, `W` = summed framing weight, `K`=1, `global` ≈ the
  corpus mean). **Not a displayed rating** — used only to set the *default sidebar
  order*, so a single rave doesn't sit above a well-reviewed venue.

`mention_type` and `extraction_confidence` are deliberately **not** used as
weights: 96% of mentions are `featured` and confidence is near-constant (its low
values tracked naming issues we hand-fixed, not accuracy), so they added noise.

**Attributes (discrete, 10 of them).** A mean would hide both volume and
disagreement (one positive mention would outrank nine-positive-one-negative), so
each attribute stores **raw counts** of how many mentions called it
positive / neutral / negative — rendered as a stacked bar on the card. `net`
= positive − negative is a quick sortable signal; `note` is one paraphrased
(non-quoted) hint taken from the highest-endorsement mention whose polarity
agrees with the net sign.

**Quotes.** Up to three *verbatim* `representative_quote`s, sorted by endorsement
(most positive first), each with its publication and source URL.

## 3. `canonical_venues.jsonl` — field reference

| field | type | meaning |
|---|---|---|
| `canonical_id` | str | stable id, `cv_NNNN` |
| `place_id` | str | Google Places id — the venue's identity key |
| `canonical_name` | str | Google display name |
| `formatted_address` | str | Google address (always Manhattan) |
| `lat`, `lng` | float | coordinates |
| `google_types` | list | Google place types (e.g. `coffee_shop`, `library`) |
| `business_status` | str | `OPERATIONAL` / `CLOSED_TEMPORARILY` (permanently-closed are dropped) |
| `mention_count` | int | how many in-scope mentions back this venue |
| `unique_sources` | int | distinct articles mentioning it |
| `member_strings` | list | the raw venue names that mapped here (audit) |
| `endorsement_score` | float −1…1 | **displayed rating** — framing-weighted mean |
| `ranking_score` | float −1…1 | **default-order key only** — shrunk endorsement |
| `attribute_scores` | obj | per attribute → `{positive, neutral, negative, n, net, note}` |
| `representative_quotes` | list | ≤3 `{quote, publication, source_url}`, verbatim |
| `needs_review` | bool | true only if every member resolution was still flagged (≈ none) |

Attributes (keys of `attribute_scores`): `noise, wifi, seating, outlets,
crowding, accessibility, laptop_friendly, price, hours, restroom`.
`accessibility` = genuine disability access (sparse); `restroom` = toilet
availability (split out of accessibility); both are bonus signals, not model
inputs. A score of `null`/all-zero means no mention spoke to that attribute —
absence is never treated as negative.

## 4. Example row (abridged)

```json
{
  "canonical_name": "New York Public Library - Stephen A. Schwarzman Building",
  "mention_count": 41, "unique_sources": 38,
  "endorsement_score": 0.73, "ranking_score": 0.72,
  "attribute_scores": {
    "noise":   {"positive": 17, "neutral": 0, "negative": 0, "n": 17, "net": 17, "note": "library-quiet, perfect for deep focus"},
    "seating": {"positive": 17, "neutral": 0, "negative": 0, "n": 17, "net": 17, "note": "52 rows of long oak tables"},
    "crowding":{"positive": 1,  "neutral": 0, "negative": 2, "n": 3,  "net": -1, "note": "packed during midterms and finals"}
  },
  "representative_quotes": [{"quote": "...cathedral-like space with 52-foot ceilings...", "publication": "Study Nearby", "source_url": "..."}]
}
```

## 4b. OSM layer (Stage 7 — `enrichment/osm_enrich.py`)

The enriched file `enrichment/outputs/canonical_venues_osm.jsonl` is this same
schema plus an **`osm`** block per venue (or `null` if unmatched). Matching is
spatial-first: an Overpass bbox fetch, then each venue is matched to the OSM POI
at its coordinate (≤60 m) by a **strong name match, or a weak name match only if
≤12 m away** — Manhattan is too dense for distance-only matching. **239/326
venues matched (73%)** (incl. 4 hand-verified spacing/punctuation recoveries), all
clean. The 87 unmatched are genuine OSM coverage gaps, not name mismatches.
Two libraries OSM lacks a `wheelchair` tag for carry a separate, sourced
`accessibility_manual` field instead (NYPL / venue report) — so all 27 libraries
have accessibility, and accessibility covers **82 venues vs the 9 editorial cells**.

```
"osm": {
  "osm_type": "node", "osm_id": 123, "osm_name": "...", "category": "cafe",
  "match_distance_m": 9.0, "name_sim": 88.0,
  "tags": { "wheelchair": "yes", "toilets": "yes", "internet_access": "wlan",
            "opening_hours": "Mo-Su 07:00-19:00", "cuisine": "coffee_shop",
            "outdoor_seating": "yes", "capacity": "30", "takeaway": "yes", ... }
}
```

Coverage (venues carrying the tag): opening_hours 161, cuisine 123,
**wheelchair 78**, internet_access 70, outdoor_seating 80, toilets 26
(+ toilets:wheelchair 11). The OSM layer is **factual presence**; it complements
the editorial **sentiment** layer and is **storable indefinitely with attribution**
("© OpenStreetMap contributors", ODbL). Recommended use: OSM `wheelchair` →
primary **accessibility/EDI**; `toilets` → primary **restroom**; `opening_hours`
→ storable **hours**; `internet_access` cross-validates the editorial wifi bar.

## 5. Notes for downstream

- **Rank** on `ranking_score`, **display** `endorsement_score` + `mention_count`.
- Quietness/busyness come from the `noise`/`crowding` bars and the real-time
  model — *not* from `mention_count` (editorial coverage ≠ foot traffic).
- EDI/accessibility data should come from OSM `wheelchair=*` / NYC Open Data,
  matched by `lat`/`lng` + name; the corpus `accessibility` field is too sparse.
