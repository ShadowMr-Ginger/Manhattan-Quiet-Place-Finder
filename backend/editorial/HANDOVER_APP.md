# Frontend / Backend Handover — Quiet Spaces Manhattan venue dataset

**Project:** COMP47360 Research Practicum — *Quiet Spaces Manhattan*
**Dataset:** `editorial/enrichment/outputs/canonical_venues_osm.jsonl`
**Rows:** 326 canonical Manhattan venues, one JSON object per line (JSONL)
**Purpose of this doc:** what each field is, where it came from, and how the app
should use it (display, sort, filter, store).

---

## 1. What this dataset is

Each row is one **physical venue** (keyed by Google `place_id`) discovered from
editorial "best places to work/study" articles, with three layers of signal:

1. **Editorial layer** — *sentiment* mined from the articles (how strongly the
   venue is endorsed for work, and per-attribute positive/neutral/negative counts
   with a human quote). Subjective, opinion-based.
2. **OSM layer** (`osm`) — *factual presence* from OpenStreetMap (has wifi / step-
   free access / toilets / opening hours …). Objective, ODbL-licensed.
3. **Manual accessibility** (`accessibility_manual`) — for 2 libraries OSM lacks.

The two main layers are kept **separate and raw** — do not merge them; they answer
different questions ("is the wifi *good*" vs "does it *have* wifi"). The app
decides how to present them together.

## 2. Field reference

### Identity & location
| field | type | use |
|---|---|---|
| `canonical_id` | str `cv_NNNN` | stable internal id |
| `place_id` | str | **primary key**; Google Places id — use for map pin / Place details / dedupe. Storable indefinitely. |
| `canonical_name` | str | venue display name |
| `formatted_address` | str | display; always Manhattan |
| `lat`, `lng` | float | **map pin**; Google-sourced (store ≤30 days per Google ToS, or re-derive — see §6) |
| `google_types` | list | derive the **venue-type icon** (see §4): `library`, `coffee_shop`/`cafe`, `book_store`, `restaurant`, `hotel`, `bar`… |
| `business_status` | str | `OPERATIONAL` or `CLOSED_TEMPORARILY` (permanently-closed already removed). Show a "temporarily closed" badge for the 5 `CLOSED_TEMPORARILY`. |

### Score, popularity, ranking
| field | type | use |
|---|---|---|
| `endorsement_score` | float −1..1 | **the displayed rating** — how strongly endorsed as a workspace. Normalise for display (see §3). |
| `ranking_score` | float −1..1 | **default sort key only — never display.** Shrunk version so thin one-off raves don't top the list. Sort the sidebar by this descending. |
| `mention_count` | int | **show next to the score** ("from N write-ups"). Also the recommended **display floor**: surface `mention_count ≥ 3` by default (86% OSM coverage, more reliable scores). |
| `unique_sources` | int | distinct publications; a stronger trust signal than raw mentions if you want it |
| `member_strings` | list | the raw names that mapped here — debug/audit only, don't display |
| `needs_review` | bool | QA flag; effectively all `false` — ignore in UI |

### Attributes (`attribute_scores`)
Object keyed by attribute. **Ten attributes:** `noise, wifi, seating, outlets,
crowding, accessibility, laptop_friendly, price, hours, restroom`.
Each value:
```json
"wifi": { "positive": 9, "neutral": 1, "negative": 1, "n": 11, "net": 8,
          "note": "fast, reliable wifi" }
```
- `positive/neutral/negative` → render a **stacked horizontal bar** (green/grey/red).
- `n` = total mentions of this attribute. **Only show an attribute if `n ≥ 2`**
  (one opinion isn't a signal — "only those with sufficient signal", per design).
- `net` = positive − negative; a quick sortable/filterable scalar.
- `note` = one short *paraphrased* hint (NOT a verbatim quote — don't show in quotes).
- `accessibility` and `restroom` are sparse from editorial — prefer the **OSM**
  values for those two (see below).

### Quotes (`representative_quotes`)
Up to 3 objects, sorted strongest first:
```json
{ "quote": "...verbatim sentence...", "publication": "Study Nearby", "source_url": "https://..." }
```
These ARE verbatim and attributed — safe to show in quotation marks with the
publication name as a credit + link. Lead with the first.

### OSM layer (`osm`) — factual; `null` if unmatched (87 venues)
```json
"osm": {
  "osm_type": "node", "osm_id": 123, "osm_name": "...", "category": "cafe",
  "match_distance_m": 9.0, "name_sim": 88.0, "recovered": true,
  "tags": { "wheelchair": "yes", "toilets": "yes", "internet_access": "wlan",
            "opening_hours": "Mo-Su 07:00-19:00", "cuisine": "coffee_shop",
            "outdoor_seating": "yes", "capacity": "30", "takeaway": "yes",
            "air_conditioning": "yes", "level": "1", "diet:vegan": "yes", ... }
}
```
Render the present tags as **small icons in a footer strip** (see §4). Coverage
across the 239 matched venues: `opening_hours` 163, `cuisine` ~123, `wheelchair`
80, `internet_access` 71, `outdoor_seating` ~80, `toilets` 26 (+`toilets:wheelchair` 11).

### Manual accessibility (`accessibility_manual`) — only on 2 library rows
```json
"accessibility_manual": { "wheelchair": "yes", "source": "NYPL — ADA-compliant elevator..." }
```
Use exactly like `osm.tags.wheelchair`, but cite the `source` string (not OSM).

## 3. The rating — recommended normalisation

`endorsement_score` is −1..1 (most venues land +0.3..+0.85). For a friendly UI,
map to a 0–5 scale and pair with the count:

```
display_rating = round( ((endorsement_score + 1) / 2) * 5, 1 )      # −1→0.0, 0→2.5, +0.73→4.3, +1→5.0
```

Show e.g. **"4.3 ★ · from 41 write-ups"**. Keep the raw `endorsement_score` in the
API for transparency. **Sort** the list by `ranking_score` (not this display value),
so a single glowing mention can't outrank a well-reviewed venue.

## 4. Display guidance (the venue card)

- **Type icon** from `google_types` (coffee cup, book for library, fork for
  restaurant, bed for hotel…).
- **Header:** name, neighbourhood (from address), `display_rating ★` + `mention_count`.
- **Attribute bars:** for each attribute with `n ≥ 2`, a stacked pos/neu/neg bar +
  label; skip the rest. Lead with the work-relevant ones (noise, wifi, seating,
  outlets, crowding, hours).
- **Quote:** the first `representative_quotes` entry, italic, with publication credit.
- **OSM footer icons** (only when the tag is present): ♿ `wheelchair=yes`,
  📶 `internet_access`, 🚻 `toilets`, 🕒 `opening_hours`, 🌿 `outdoor_seating`,
  ❄ `air_conditioning`, 🥗 `diet:vegan/vegetarian`, ☕ `cuisine`. Tooltip = the raw
  tag value (e.g. `opening_hours` string).
- **Default list:** `mention_count ≥ 3`, sorted by `ranking_score`. Let users widen
  to all venues if they want the long tail.

## 5. Filtering / search the backend can support

- by neighbourhood / map bounds (`lat`/`lng`)
- by attribute (`attribute_scores.<attr>.net > 0`, e.g. "quiet" = `noise.net` high)
- by OSM facts (`osm.tags.wheelchair = yes`, `osm.tags.internet_access` present,
  `osm.tags.outdoor_seating = yes`)
- by type (`google_types`), by openness (`business_status`)
- by trust (`mention_count`, `unique_sources`)

## 6. Storage, licensing & attribution (important)

- **Store freely & indefinitely:** `place_id`, all **editorial** fields (our own
  derived data), and all **OSM** fields (ODbL).
- **Google `lat`/`lng`:** Google ToS allows caching ≤30 days. For permanent
  storage either re-fetch monthly or re-geocode the address via a free geocoder
  (US Census / Nominatim) — see RESOLUTION.md.
- **Attribution (must display):**
  - OSM tags → **"© OpenStreetMap contributors"** wherever shown (ODbL).
  - Quotes → the `publication` (+ link `source_url`).
  - `accessibility_manual` → its `source` string.

## 7. Caveats

- **OSM is a point-in-time snapshot** (fetched at build time); a re-run would shift
  coverage. Treat the `osm` layer as "as of last build".
- **87 venues have `osm: null`** (OSM coverage gaps) — fall back to the editorial
  layer; these cluster in the single-mention long tail, so the `≥3` display floor
  hides most of them.
- **Quietness/busyness** should come from the `noise`/`crowding` bars and the
  real-time model — *not* from `mention_count` (editorial coverage ≠ foot traffic).

## 8. Related docs
`PIPELINE.md` (full pipeline), `RESOLUTION.md` (identity resolution),
`AGGREGATION.md` (scoring method + base schema), `DATA_CLEANING.md` (Stage-2 cleaning).
