# Hush-Hub — Data & ML Plan (Quiet Score + Busyness Model)

**Owner:** Data & ML Lead · **Project:** COMP47360 — Quiet Spaces Manhattan
**Scope:** turn the live civic tables (`mta_ridership`, `nyc_noise`, + pending construction/events) and the
editorial `venues` table into (a) a **busyness model** and (b) a transparent **quiet score**, served per venue and per hour.

---

## 1. What we are actually building (and what is live vs predicted)

| Layer | Source | Nature | How it's served |
|---|---|---|---|
| **Busyness curve** | MTA ridership (weekly, 1-wk lag) | **Predicted** typical profile (hour × day-of-week). The *only* supervised ML model. | popular-times-style curve per venue card |
| **Indoor quiet base** | editorial `attribute_scores` (noise, crowding) | Static, direct (but sparse) | feeds quiet score; library default if absent |
| **Ambient noise** | 311 (daily, ~2-day lag) + road class (OSM, static) | Static baseline | feeds quiet score (modest weight) |
| **Transient noise** | construction (daily) + events (daily, forward-looking) — *pending in DB* | **Faux-live**, time-gated | map layers + time-varying penalty |

**Key design fact:** ridership has ground-truth labels (actual counts) → it can be supervised ML.
Quietness has **no** ground-truth label → it must be a **transparent composite index**, not a black-box model.
This is what keeps the busyness axis (ML) cleanly separated from the quiet axis (index), per our
"never collapse the axes" principle.

**Venue-type routing:** libraries → rule-based quiet default (downgrade only on editorial evidence);
cafés → full environmental composite. The **busyness curve runs for both** (seat availability matters everywhere).

---

## 2. Concrete schema (built on the live DB)

Live source tables (do not modify): `venues` (326), `mta_ridership` (~12.4M), `nyc_noise` (~4.4M).
Everything below is **new, derived** and precomputed. Convention: ingest 4326 → store `geom` in **EPSG:2263 (feet)**,
GIST-indexed; keep raw lat/lon as audit columns. (If PostGIS isn't enabled server-side, compute the same
distances in Python with `scipy.spatial`/`geopy` and store the weights — see Step 0.)

### 2.1 `subway_station` — station dimension
Derived `SELECT DISTINCT` from `mta_ridership`.
```
station_complex_id   varchar PK
station_complex      varchar          -- display name + lines
lat, lng             float            -- raw (audit)
geom                 geometry(Point,2263)  GIST
```

### 2.2 `station_hourly_profile` — busyness baseline + ML output
The typical-profile table; also where model predictions land.
```
station_complex_id   varchar  FK
dow                  smallint  -- 0..6
hour                 smallint  -- 0..23
mean_ridership       float     -- historical baseline (naive model)
pred_ridership       float     -- best ML model's prediction
n_obs                int       -- support, for confidence
PK (station_complex_id, dow, hour)
```

### 2.3 `venue_station_link` — decay weights venue→station
Precomputed so the busyness curve is a fast join. Only stations within cutoff `R`.
```
canonical_id         varchar  FK -> venues
station_complex_id   varchar  FK
distance_ft          float
weight               float     -- exp(-(distance_ft/σ)²)
```

### 2.4 `venue_features` — one row per venue (static features)
```
canonical_id         varchar PK FK -> venues
venue_type           varchar        -- cafe | library | ...
indoor_base          float 0..1     -- from editorial noise/crowding, or library default
indoor_confidence    float 0..1     -- editorial coverage (n of noise+crowding cells)
road_class           varchar        -- OSM highway= of nearest segment (REVIVE: see Step 3b)
road_noise_prior     float 0..1     -- mapped from road_class
noise_chronic        float 0..1     -- distance-decay 311 count, saturated + normalised
ambient_penalty      float 0..1     -- w_road*road_noise_prior + w_311*noise_chronic
sigma_ft, cutoff_ft  float          -- params used (reproducibility)
as_of                timestamp
source               varchar
```

### 2.5 `venue_quiet_hourly` — per-venue × hour display curve (precompute 326×7×24 ≈ 54.8k rows)
```
canonical_id   varchar FK
dow            smallint
hour           smallint
busyness_proxy float 0..1   -- decay-weighted pred_ridership from nearby stations, normalised
quiet_score    float 0..100 -- final composite (see §3); transient layers added when available
PK (canonical_id, dow, hour)
```

### Key derivations (sketch)
```sql
-- stations (2.1)
INSERT INTO subway_station
SELECT station_complex_id, max(station_complex), avg(latitude), avg(longitude),
       ST_Transform(ST_SetSRID(ST_MakePoint(avg(longitude),avg(latitude)),4326),2263)
FROM mta_ridership GROUP BY station_complex_id;

-- baseline profile (2.2)
INSERT INTO station_hourly_profile (station_complex_id,dow,hour,mean_ridership,n_obs)
SELECT station_complex_id,
       EXTRACT(DOW FROM transit_timestamp), EXTRACT(HOUR FROM transit_timestamp),
       avg(ridership), count(*)
FROM mta_ridership GROUP BY 1,2,3;

-- venue→station decay links (2.3), σ chosen in Step 1
INSERT INTO venue_station_link
SELECT v.canonical_id, s.station_complex_id,
       ST_Distance(v.geom,s.geom),
       exp(-power(ST_Distance(v.geom,s.geom)/:sigma,2))
FROM venues v JOIN subway_station s
  ON ST_DWithin(v.geom, s.geom, :cutoff);

-- per-venue busyness curve (feeds 2.5)
SELECT l.canonical_id, p.dow, p.hour,
       sum(p.pred_ridership * l.weight) / sum(l.weight) AS busyness_raw
FROM venue_station_link l
JOIN station_hourly_profile p USING (station_complex_id)
GROUP BY 1,2,3;   -- then min-max / percentile normalise to 0..1
```

---

## 3. Quiet score formula

Normalise all components to 0..1; combine as **base minus penalties**, then scale to 0..100.
Outside noise can only *intrude*, so it's a penalty on the indoor base — not an average with it.

```
quiet_score(t) = clamp( indoor_base
                        − λ_ambient   · ambient_penalty
                        − λ_transient · transient_penalty(t),
                        0, 1 ) · 100
```

**indoor_base** (0..1)
- café: map editorial `noise.net` + `crowding.net` → 0..1 (e.g. logistic). If both absent → neutral 0.5, `indoor_confidence` low.
- library: default **0.8**, downgraded only if editorial noise/crowding is negative.

**ambient_penalty** (0..1, static) — weighted *modestly* (external→indoor is a weak proxy)
```
ambient_penalty = w_road · road_noise_prior + w_311 · noise_chronic
road_noise_prior map: motorway/trunk .85 · primary .7 · secondary .5 · tertiary .35
                      residential .15 · living_street/pedestrian .05
noise_chronic   = normalise( saturate( Σ_complaints exp(-(d/σ)²) ) )   -- distance-decay, last-N-months
```

**transient_penalty(t)** (0..1, time-varying) — *pending construction/events tables*
```
transient_penalty(t) = w_busy·busyness_proxy(t)
                     + w_constr·construction_active(t)
                     + w_event·events_active(t)
each civic term = normalise( saturate( Σ exp(-(d/σ)²) · magnitude · temporal_overlap(t) ) )
```
Saturation (log or cap) so many nearby events don't blow the score up; `temporal_overlap` gates to the hour the user cares about.

**Libraries:** smaller λ_ambient / λ_transient (better insulated) unless editorial says otherwise.

**Params to lock** (document in methods, all tunable): `σ`, `R`, `λ_ambient`, `λ_transient`,
the `w_*` sub-weights, the road-class map, and the 311 look-back window.

**Display:** one headline "Quiet score (estimated)" + a one-line breakdown
("quiet inside · moderate street noise · currently busy") + a confidence dot from `indoor_confidence`.
Busyness curve shown **separately** as the popular-times graph.

---

## 4. Compartmentalised step plan

### Phase 0 — Access & environment
- [ ] Confirm DB reachability: direct `psql` to `43.157.51.61:5432`, else tunnel via the UCD student VM (jumper).
- [ ] Python env: `psycopg2`/`sqlalchemy`, `pandas`, `scikit-learn`; `geopandas`/`shapely` if doing spatial client-side.
- [ ] Check whether **PostGIS** is enabled on the server (`SELECT postgis_version();`). If not: ask backend to enable it, or compute distances/weights in Python and store results in the new tables.

### Phase 1 — Spatial foundation
- [ ] Build `subway_station` (distinct stations + `geom`).
- [ ] Add `geom` to a venues view (reproject 4326→2263) — or a parallel `venue_geom` table (respect Places caching note: derive, don't treat as permanent).
- [ ] Choose & document `σ` and `R`; build `venue_station_link`.

### Phase 2 — Busyness model (**the ML deliverable**)
- [ ] EDA on `mta_ridership`: coverage, gaps, outliers, hour/dow/station patterns, COVID-era caveats.
- [ ] Baseline = `station_hourly_profile.mean_ridership` (naive model to beat).
- [ ] Features: hour, dow, holiday flag, station id/embedding, optional lags.
- [ ] Train/test split (time-based); train & **compare ≥3 models** (linear, random forest, gradient boosting) vs baseline; report MAE/RMSE.
- [ ] Write best predictions into `station_hourly_profile.pred_ridership`.
- [ ] Compute per-venue `busyness_proxy` curve via `venue_station_link`; normalise.

### Phase 3 — Noise / ambient features
- [ ] EDA on `nyc_noise` (complaint types, hour-of-day, spatial density).
- [ ] Compute `noise_chronic` per venue (distance-decay, saturate, normalise; pick look-back window).
- [ ] **(3b) Revive road classification** — Overpass nearest `highway=` per venue (or one Manhattan road-network pull + nearest-join); map → `road_noise_prior`. *(Was cut with routing in v1; reviving only the noise-prior use, not routing.)*
- [ ] Assemble `ambient_penalty`.

### Phase 4 — Transient layers (when construction + events land in DB)
- [ ] Ingest/confirm `construction_permit`, `permitted_event` (+ geocoding for events/permits with no lat/lon).
- [ ] Snapshot the rolling event window so history persists.
- [ ] Build `construction_active(t)`, `events_active(t)` (decay + saturation + temporal gating).
- [ ] Add them to `transient_penalty(t)`.

### Phase 5 — Indoor base + quiet-score assembly
- [ ] Map editorial `noise`/`crowding` → `indoor_base` + `indoor_confidence`; library default rule.
- [ ] Lock weights (`λ_*`, `w_*`); assemble `quiet_score(t)`.
- [ ] Precompute `venue_quiet_hourly` (326 × 7 × 24).

### Phase 6 — Serve & integrate (with Backend Lead)
- [ ] Wire `/venues/{id}/prediction` to real `quiet_score` now/+1/+2/+3h (replaces current static stub).
- [ ] Faux-live map layers: recent 311 / active construction / upcoming events (with delay caveats).
- [ ] Venue card: busyness curve + quiet breakdown + confidence dot.

### Phase 7 — Validation & paper
- [ ] Sanity checks: known-quiet libraries score high; Times-Sq-adjacent cafés score low at peak.
- [ ] Sensitivity analysis on `σ`, `R`, weights.
- [ ] Model metrics table + **self-critical** writeup (external≠indoor proxy gap, editorial sparsity, ridership=area not venue).

---

## 5. Open decisions to settle first
1. **PostGIS available server-side?** Determines whether spatial math is SQL or Python (Phase 0).
2. **σ / R values** — start ~σ=150–250 m, R=400–600 m; tune in Phase 7.
3. **311 look-back window** for `noise_chronic` (e.g. trailing 12 months) vs all-history.
4. **Revive road class?** (recommended — cheap, fixes editorial noise sparsity).
5. **Quiet-score weights** — initial guess λ_ambient≈0.3, λ_transient≈0.4 for cafés; both smaller for libraries.
