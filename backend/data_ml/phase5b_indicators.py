#!/usr/bin/env python3
"""
Phase 5b — consolidate the SEPARATE environmental indicators into one per-venue
serving table (NOT a fused score — see the architecture decision).

Merges the four per-metric CSVs (each an ABSOLUTE, de-arbitrised facet):
  venue_noise_rate.csv     -> noise311_kde, noise311_within100m       ("Area noise" — reported)
  venue_road_class.csv     -> road_db                                 ("Area noise" — traffic)
  venue_construction.csv   -> effective_sites, construction_sites_150m ("Happening nearby")
  venue_events.csv         -> n_events_nearby, nearest_event_m        ("Happening nearby")

Output: outputs/venue_indicators.csv — the table the API/daily-batch serves.
Each indicator stays its own column on its own real-world scale — no min-max,
no fusion. "Quiet inside" is the editorial calm bar (venue_calm_bar.csv), served
separately by phase5a.

Usage:
    python data_ml/phase5b_indicators.py
"""
import os
import numpy as np
import pandas as pd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")


def load(name, cols):
    df = pd.read_csv(os.path.join(OUT, name))
    return df[cols]


def main():
    base = load("venue_noise_rate.csv",
                ["canonical_id", "canonical_name", "venue_type", "kde_per_year", "rate_100"])
    road = load("venue_road_class.csv", ["canonical_id", "road_db"])
    con = load("venue_construction.csv", ["canonical_id", "effective_sites", "n_within_150"])
    ev = load("venue_events.csv", ["canonical_id", "n_events_nearby", "nearest_event_m"])

    # All ABSOLUTE, de-arbitrised facets — no min-max, no fusion. Indoor "Quiet inside" is
    # the editorial bars (served separately). Each column is its own scale/units.
    m = (base.merge(road, on="canonical_id", how="left")
             .merge(con, on="canonical_id", how="left")
             .merge(ev, on="canonical_id", how="left")
             .rename(columns={"kde_per_year": "noise311_kde", "rate_100": "noise311_within100m",
                              "n_within_150": "construction_sites_150m"}))
    cols = ["canonical_id", "canonical_name", "venue_type",
            "road_db",                                          # traffic noise — absolute dB
            "noise311_kde", "noise311_within100m",              # reported noise — KDE rank + count/yr within 100m
            "effective_sites", "construction_sites_150m",       # construction — decay rank + count within 150m
            "n_events_nearby", "nearest_event_m"]               # loud events this week — count + nearest distance
    m = m[cols]

    print("=" * 72)
    print(f"venues: {len(m)}   (absolute environmental facets; indoor = editorial bars; no min-max, no fusion)")
    print("\nindicator ranges (each its OWN scale/units — not comparable across columns):")
    for c in ["road_db", "noise311_kde", "noise311_within100m", "effective_sites",
              "construction_sites_150m", "n_events_nearby"]:
        s = m[c].dropna()
        print(f"   {c:<24} n={len(s):>3}  min {s.min():.1f}  median {s.median():.1f}  max {s.max():.1f}")
    print("=" * 72)

    p = os.path.join(OUT, "venue_indicators.csv")
    m.to_csv(p, index=False)
    print(f"wrote {p}")


if __name__ == "__main__":
    main()
