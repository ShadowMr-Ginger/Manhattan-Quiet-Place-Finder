#!/usr/bin/env python3
"""
run_daily.py — reference orchestrator for the Hush-Hub data/ML pipeline.

Runs the feature scripts in dependency order and writes the serving outputs
(venue_indicators.csv, venue_calm_bar.csv, venue_busyness_hourly.csv + meta,
construction_hotspots.geojson, events_layer.geojson). Intended to run once a day
AFTER the backend's civic-data sync.

By default it passes --refresh to the steps that cache a DB pull (311, permits)
so the daily run uses FRESH data. Use --fast to reuse caches (quick test run).

NOT included here: phase2_busyness_model.py (the ridership-model retrain) — it's a
heavy ~10-min MTA pull and MTA updates weekly, so run it as a separate weekly job;
it produces station_hourly_profile.csv, which phase6 (busyness curve) consumes.

Usage:
    python data_ml/run_daily.py            # daily: fresh pulls
    python data_ml/run_daily.py --fast     # reuse caches (testing)
"""
import argparse, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))

# (label, script, extra args that benefit from a fresh DB pull)
STEPS = [
    ("road classes (OSM cached)",       "phase3b_road_class.py",     []),
    ("311 noise",                       "phase3a_noise_features.py", ["--refresh"]),
    ("construction + hotspot layer",    "phase4a_construction.py",   ["--refresh"]),
    ("events + events layer",           "phase4b_events.py",         []),   # re-queries DB; geocode cache reused
    ("indoor calm bar",                 "phase5a_indoor.py",         []),
    ("consolidate -> venue_indicators", "phase5b_indicators.py",     []),
    ("busyness curve",                  "phase6_busyness.py",        []),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="reuse caches (skip --refresh) for a quick test run")
    args = ap.parse_args()

    t0 = time.time()
    print(f"=== run_daily start {time.strftime('%Y-%m-%d %H:%M:%S')}  (mode: {'fast' if args.fast else 'fresh'}) ===")
    for i, (label, script, extra) in enumerate(STEPS, 1):
        step_args = [] if args.fast else extra
        cmd = [sys.executable, os.path.join(HERE, script)] + step_args
        print(f"\n[{i}/{len(STEPS)}] {label}  →  {script} {' '.join(step_args)}")
        t = time.time()
        r = subprocess.run(cmd)
        if r.returncode != 0:
            print(f"\n!! step failed: {script} (exit {r.returncode}). Stopping so downstream "
                  f"steps don't consume stale/partial data.")
            sys.exit(r.returncode)
        print(f"   done in {time.time()-t:.0f}s")

    print(f"\n=== run_daily complete in {time.time()-t0:.0f}s — serving outputs refreshed in data_ml/outputs/ ===")


if __name__ == "__main__":
    main()
