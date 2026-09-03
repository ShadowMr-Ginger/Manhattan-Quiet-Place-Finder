#!/usr/bin/env python3
"""
Phase 3a helper — evidence-based KDE bandwidth (σ) for the 311 noise signal.

Estimates the SPATIAL-AUTOCORRELATION RANGE of the complaint field: the distance
over which noise-complaint density stays correlated. That range is the principled
basis for the KDE bandwidth σ (smooth over the scale the signal is genuinely
coherent — no more, no less), far more defensible than picking σ from block size.

Method: rasterise complaints onto a 50 m grid, compute the 2-D spatial
autocorrelation by FFT (Wiener–Khinchin), radially average it, and report the
distances at which correlation falls to 0.50 and to 1/e (0.37) — the correlation
lengths.

Usage:
    python data_ml/phase3a_bandwidth.py            # uses cached noise points
"""
import os, sys
import numpy as np
import pandas as pd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")
cache = os.path.join(OUT, "noise_points_24m.pkl")
if not os.path.exists(cache):
    sys.exit("Need outputs/noise_points_24m.pkl (run phase3a_noise_features.py first).")

df = pd.read_pickle(cache)
print(f"complaints: {len(df):,}")
lat0, lng0 = df.lat.mean(), df.lng.mean()
mlat = 111320.0; mlng = 111320.0 * np.cos(np.radians(lat0))
x = ((df.lng - lng0) * mlng).values
y = ((df.lat - lat0) * mlat).values

cell = 50.0
xi = np.floor((x - x.min()) / cell).astype(int)
yi = np.floor((y - y.min()) / cell).astype(int)
nx, ny = int(xi.max() + 1), int(yi.max() + 1)
grid = np.zeros((ny, nx)); np.add.at(grid, (yi, xi), 1.0)
print(f"grid: {ny}x{nx} cells of {cell:.0f} m")

# 2-D autocorrelation via FFT, normalised, radially averaged
g = grid - grid.mean()
F = np.fft.fft2(g)
ac = np.fft.fftshift(np.fft.ifft2(F * np.conj(F)).real)
ac /= ac.max()
yy, xx = np.indices(ac.shape)
r = np.sqrt(((yy - ny // 2) * cell) ** 2 + ((xx - nx // 2) * cell) ** 2)
bins = np.arange(0, 700, cell); mid = bins + cell / 2
prof = np.array([ac[(r >= b) & (r < b + cell)].mean() for b in bins])

print("\n dist(m)  autocorrelation")
for m, p in zip(mid, prof):
    print(f"  {m:5.0f}    {p:6.3f}  {'#' * int(max(p, 0) * 40)}")

half = np.interp(0.50, prof[::-1], mid[::-1])
e = np.interp(1 / np.e, prof[::-1], mid[::-1])
print(f"\nhalf-correlation (0.50) length ≈ {half:.0f} m")
print(f"1/e (0.37) correlation length  ≈ {e:.0f} m   ← evidence-based σ candidate")
print("\nGuide: set σ near the 1/e length (the field's coherence scale); go tighter only")
print("on the doorstep/relevance argument, but not so tight that 311 sparsity dominates.")
