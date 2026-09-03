# data_ml — environmental, quiet & busyness signals

Data/ML pipeline for Hush-Hub. Turns civic datasets (MTA subway ridership, NYC 311
noise complaints, DOB construction permits, NYC permitted events) plus the editorial
venue database into **separate, absolute, interpretable** per-venue signals — no fused
"quiet score". Full details for backend + frontend are in **[HANDOVER_data_ml.md](HANDOVER_data_ml.md)**.

## Run it

```bash
pip install psycopg2-binary pandas numpy scipy scikit-learn matplotlib requests python-dotenv
python run_daily.py            # daily job: fresh DB pulls, writes serving outputs
python run_daily.py --fast     # reuse caches (quick test)
python phase2_busyness_model.py  # separate weekly job (retrains ridership model)
```

DB access: scripts read `DATABASE_URL` from a `.env` (git-ignored) or fall back to the
project DSN. See the handover §3 for cadence and the serving contract.

## Pipeline (dependency order — orchestrated by `run_daily.py`)

| # | script | writes |
|---|--------|--------|
| 1 | `phase3b_road_class.py` | `venue_road_class.csv` (traffic-noise dB) |
| 2 | `phase3a_noise_features.py` | `venue_noise_rate.csv` (311 KDE + counts) |
| 3 | `phase4a_construction.py` | `venue_construction.csv` + `construction_hotspots.geojson` |
| 4 | `phase4b_events.py` | `venue_events.csv` + `events_layer.geojson` |
| 5 | `phase5a_indoor.py` | `venue_calm_bar.csv` (editorial "Quiet inside") |
| 6 | `phase5b_indicators.py` | **`venue_indicators.csv`** (consolidates 1–4) |
| 7 | `phase6_busyness.py` | `venue_busyness_hourly.csv` + `venue_busyness_meta.csv` |

Separate/weekly: `phase2_busyness_model.py` → `station_hourly_profile.csv` (consumed by phase 6).

Methods / one-off analyses (not in the daily job): `phase3a_bandwidth.py` (311 σ from
spatial autocorrelation), `phase4b_eda.py` (event closure-type analysis), `phase0_probe.py`
(DB connectivity check).

## Outputs

`outputs/` holds the committed serving CSVs/GeoJSONs the API consumes. Large regenerable
caches (`*.pkl`, `manhattan_highways.json`) are git-ignored — the scripts rebuild them.
