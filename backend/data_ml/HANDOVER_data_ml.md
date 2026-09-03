# Data/ML Handover — Environmental, Quiet & Busyness Signals

**From:** Data & ML Lead · **To:** Backend Lead + Frontend Lead · **Project:** Hush-Hub (COMP47360)

This document covers everything the data/ML pipeline produces: **what each output means**, **how the frontend should display it**, and **how the backend should run and serve it**. The pipeline scripts live in `data_ml/`; a reference orchestrator is `data_ml/run_daily.py`.

---

## 0. The headline change (read this first)

**We are no longer displaying a single fused "quiet score."** We deliberately moved away from that. There is no one number for quietness — instead there are **separate, independent indicators**, each on its own real-world scale, shown in their own place on the card.

**Why:** we measured these signals and found they are largely *orthogonal* (e.g. traffic noise vs 311 complaints correlate at ρ ≈ −0.08 — nearly independent). A venue can be quiet-street-but-party-heavy, or loud-avenue-but-uncomplained. Fusing them into one number would (a) require arbitrary weights we have no ground truth for, (b) double-count (editorial reviewers already experienced ambient noise), and (c) destroy the distinct information each signal carries. So each stays separate and honest.

**The four display groups** (details in §2):

| Group | What it answers | Source |
|---|---|---|
| **Quiet inside** | Is it calm *inside* to work? | editorial reviews (noise + crowding) |
| **Area noise** | How noisy are the *surroundings*? | traffic (road class) + reported (311) |
| **Happening nearby** | Any disruption *right now / this week*? | active construction + loud events |
| **Busyness** | How busy is the area, and when? | subway ridership (popular-times curve) |

Every number below is **absolute and interpretable** (dB, complaints/year, counts, distances) — there are no relative 0–1 "scores." A reader can sanity-check any figure against the source data.

---

## 1. Files the frontend consumes (via the backend API)

Everything is served through the API; the frontend does **not** read files off disk, and must **never** query the raw `nyc_permitted_events` / `dob_permits` tables directly (those are unfiltered and, for events, have no coordinates — all our filtering + geocoding lives in the pipeline).

**Per-venue record** (joined by `canonical_id`, ideally merged into the venue object by the backend):
- **`venue_indicators.csv`** — environmental facets (Area noise + Happening nearby).
- **`venue_calm_bar.csv`** — the indoor "Quiet inside" bar.
- **`venue_busyness_hourly.csv`** + **`venue_busyness_meta.csv`** — the busyness curve + confidence.
- The existing **editorial `venues` record** — name, address, lat/lng, type, `endorsement_score`, `ranking_score`, attribute bars, quotes, OSM tags. Everything above attaches to this.

**Map layers** (standalone):
- **`construction_hotspots.geojson`** — construction hotspot rings.
- **`events_layer.geojson`** — loud events (points with name/date).

---

## 2. Data dictionary + how to display each

### 2a. Quiet inside — `venue_calm_bar.csv`  (editorial)

The pooled **"Calm to work"** bar = noise + crowding editorial mentions combined.

| column | meaning |
|---|---|
| `calm_pos`, `calm_neu`, `calm_neg`, `calm_n` | pooled positive / neutral / negative mention counts (+ total) |
| `noise_*`, `crowding_*` | the underlying per-attribute counts (if you want to show the split) |
| `show_calm` | true when `calm_n ≥ 1` |

**Display:** a stacked bar — **green = `calm_pos`, grey = `calm_neu`, red = `calm_neg`** (same convention as the other attribute bars). Show the **mention count** beside it so thin evidence reads as thin. Only render when `show_calm` is true; for a venue with no signal, show nothing here and let **Area noise** carry it (libraries with no signal can show a "typically quiet" label).

> **⚠ FRONTEND ACTION — attribute-bar gate is now n ≥ 1, not n ≥ 2.** We lowered the display threshold so single-mention attributes show (with the count visible). This applies to **both** the existing per-attribute bars *and* the new calm bar. Please re-render the existing bars at n ≥ 1 and always show the count.

### 2b. Area noise — `venue_indicators.csv`  (two facets, kept separate)

| column | meaning | units / scale | display |
|---|---|---|---|
| `road_db` | traffic noise from the nearest road, distance-attenuated | **dB(A)**, ~52–70; higher = louder street | "Street noise: ~68 dB (busy avenue)" |
| `noise311_kde` | 311 noise complaints near the venue, distance-weighted, per year (ranking) | weighted complaints/yr | use for ranking/sorting |
| `noise311_within100m` | 311 noise complaints within 100 m, per year (display) | complaints/yr, median ~490 | "≈490 noise complaints/yr nearby" |

Show these as **two distinct readings** ("street/traffic" vs "reported"), not one combined bar — they measure different things.

### 2c. Happening nearby — `venue_indicators.csv`  (transient)

| column | meaning | display |
|---|---|---|
| `effective_sites` | active construction sites nearby, distance-weighted (ranking) | use for ranking |
| `construction_sites_150m` | count of active disruptive construction sites within 150 m | "N active construction sites within 150 m" |
| `n_events_nearby` | count of **loud** events within 250 m during the current window | show the count… |
| `nearest_event_m` | distance to the closest such event (m), blank if none | …plus the actual event name/date from `events_layer.geojson` |

> Construction is **ubiquitous** in Manhattan (most venues have several sites nearby) — treat it as a minor/context signal, not a headline. Events are **sparse** — usually 0, occasionally 1 — so treat them as an occasional "loud event nearby this week" alert and show the specific event (name + date), which is far more useful than a count.

> **Construction time-gate (serve-time):** NYC construction runs **Mon–Fri 07:00–18:00** only (after-hours needs a rare variance). So construction should be shown as "active" **only during those hours**, and hidden/faded evenings & weekends — both on the card and the map layer. This is a serve-time rule (check the clock), not something baked into the daily data.

### 2d. Busyness — `venue_busyness_hourly.csv` + `venue_busyness_meta.csv`

The popular-times curve, from subway ridership as an **area foot-traffic** proxy.

| column | meaning |
|---|---|
| `dow`, `hour` | 0–6 (Mon=0), 0–23 |
| `busyness` | distance-weighted nearby riders/hour (absolute) |
| `busyness_pct` | that on a **0–100 shared scale** (100 = the busiest venue-hour anywhere) |
| `nearest_station_m` (meta) | distance to nearest subway station — **confidence** flag |
| `peak_busyness_pct` (meta) | the venue's peak height on the shared scale |

**Display:** a bar-per-hour curve for the current day-of-week using **`busyness_pct`**. Because it's a *shared* scale, curve **heights are comparable across venues** (a Midtown café towers over a quiet West Village one). For a single-venue detail view you may re-normalise to the venue's own peak to read its *shape* better. Two honest notes: it's *area* foot traffic (so it peaks at the commute, ~8/17, not a café's own rhythm), and for venues with large `nearest_station_m` (>800 m; only ~2 venues) flag the curve as low-confidence.

### 2e. Map layers

- **`construction_hotspots.geojson`** — `LineString` contour rings around dense-construction cores (property `level`); render as hotspot zones (fill or outline), gated to construction hours (top-level `display_hours` property). Do **not** plot individual sites.
- **`events_layer.geojson`** — one `Point` per loud event with `name`, `type`, `closure`, `start`, `end`. Plot directly (events are sparse) and **time-filter by `start`/`end`** so only currently/soon-active events show.

---

## 3. Backend — running & serving the pipeline

### 3a. The pipeline

Scripts in `data_ml/` (each pulls what it needs + caches). Dependency order is handled by **`data_ml/run_daily.py`**, which runs:

1. `phase3b_road_class.py` → `venue_road_class.csv` (road noise; OSM road net cached)
2. `phase3a_noise_features.py` → `venue_noise_rate.csv` (311 KDE + counts)
3. `phase4a_construction.py` → `venue_construction.csv` + `construction_hotspots.geojson`
4. `phase4b_events.py` → `venue_events.csv` + `events_layer.geojson`
5. `phase5a_indoor.py` → `venue_calm_bar.csv`
6. `phase5b_indicators.py` → **`venue_indicators.csv`** (consolidates 1–4)
7. `phase6_busyness.py` → `venue_busyness_hourly.csv` + `venue_busyness_meta.csv`

Separately (weekly, heavy ~10-min MTA pull): `phase2_busyness_model.py` retrains the ridership model → `station_hourly_profile.csv` (which `phase6` consumes). Not part of the daily job.

### 3b. Refresh cadence

- **Daily** (after your civic-data sync): 311, construction, events — i.e. steps 2, 3, 4, then 6 and the 5b consolidation. Run `run_daily.py --refresh` to force fresh DB pulls.
- **On change / rarely:** road (`3b`) when OSM/venues change; calm bar (`5a`) when the editorial dataset changes; busyness model (`phase2`) weekly with new MTA data.

### 3c. Serve-time rules (NOT in the batch)

- **Construction hours gate:** show construction only Mon–Fri 07:00–18:00 (see §2c).
- **Busyness "now":** pick the row for the current `dow`/`hour` when rendering the live curve.

### 3d. Serving contract

The batch writes the CSV/GeoJSON outputs; the API should load the per-venue CSVs into (or join them onto) the venue record, and expose the two GeoJSON layers as map endpoints. **The frontend consumes these processed outputs only — never the raw permit/event tables** (our filters + geocoding exist only in the pipeline).

> This is a **reference** pipeline. You will likely want your own orchestration/scheduling and to write outputs to tables rather than files — that's expected; the contract that matters is *what* each output means (§2) and the cadence (§3b).

---

## 4. Honest limitations (for the card copy and the paper)

- **Indoor quiet is sparse** — only ~60–160 of 326 venues have editorial noise/crowding mentions; the rest rely on Area noise. Absence ≠ loud.
- **External ≠ indoor** — road/311 describe the *surroundings*; a well-insulated café on a loud street can be quiet inside. That's exactly why we keep them separate from the editorial indoor bar.
- **Construction is ubiquitous** (weak discriminator); **events are sparse** (occasional alert).
- **Busyness = area foot traffic** (subway-derived, commute-shaped), not a venue's own clientele curve.
- **Geocoding:** events ~92–96% of loud locations resolve; the unmatched few are dropped.
