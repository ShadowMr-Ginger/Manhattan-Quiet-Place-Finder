#!/usr/bin/env python3
"""
Phase 2 — Busyness model (the supervised ML deliverable).

Frames subway ridership as a regression problem and benchmarks ML models against
a strong periodic baseline (the station x day-of-week x hour mean). The honest
expectation: the baseline is hard to beat for such a regular signal; ML earns its
keep mainly on holidays/seasonality and sparse cells. That benchmark IS the result.

What it does:
  1. Pulls station-hour totals from mta_ridership (summed across fare/payment classes).
  2. Quick EDA (printed + optional PNGs).
  3. Features: hour, dow, is_weekend, month, seasonal sin/cos, US-holiday flag,
     station target-encoding (train-only, no leakage).
  4. Time-based split (hold out the last N weeks).
  5. Trains: Baseline (cell mean) vs Linear vs HistGradientBoosting vs RandomForest.
  6. Prints an MAE/RMSE comparison table.
  7. Writes the servable typical profile (station x dow x hour: mean + model-smoothed)
     to data_ml/outputs/station_hourly_profile.csv  (optionally to the DB).

Usage:
    pip install psycopg2-binary python-dotenv pandas numpy scikit-learn
    # optional extras: pip install holidays matplotlib
    python data_ml/phase2_busyness_model.py
    python data_ml/phase2_busyness_model.py --holdout-weeks 6 --fast
"""
import argparse, os, sys, time, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore", message="pandas only supports SQLAlchemy")

DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"

# --- optional .env ----------------------------------------------------------
try:
    from dotenv import load_dotenv
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", ".env"), os.path.join(here, ".env")):
        if os.path.exists(c):
            load_dotenv(c); break
except Exception:
    pass

try:
    import psycopg2
    from sklearn.linear_model import LinearRegression
    from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
    from sklearn.metrics import mean_absolute_error, mean_squared_error
except ImportError as e:
    sys.exit(f"Missing dependency: {e}.  pip install psycopg2-binary pandas numpy scikit-learn")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def load_station_hours(dsn, cache=None, refresh=False):
    """Aggregate to one row per station x hour (sum over fare/payment classes).
    Cached to a local pickle so you only pay the ~10-min pull once."""
    if cache and os.path.exists(cache) and not refresh:
        log(f"Loading cached station-hours from {cache}  (--refresh to re-pull)…")
        df = pd.read_pickle(cache)
        log(f"  {len(df):,} rows from cache, {df['ts'].min()} → {df['ts'].max()}")
        return df
    log("Pulling station-hour totals from mta_ridership (server-side aggregation; ~10 min)…")
    sql = """
        SELECT station_complex_id,
               transit_timestamp AS ts,
               SUM(ridership)     AS ridership
        FROM mta_ridership
        GROUP BY station_complex_id, transit_timestamp
    """
    conn = psycopg2.connect(dsn, connect_timeout=15)
    try:
        df = pd.read_sql(sql, conn)
    finally:
        conn.close()
    df["ts"] = pd.to_datetime(df["ts"])
    log(f"  loaded {len(df):,} station-hour rows, "
        f"{df['station_complex_id'].nunique()} stations, "
        f"{df['ts'].min()} → {df['ts'].max()}")
    if cache:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        df.to_pickle(cache)
        log(f"  cached to {cache}")
    return df


def eda(df, outdir):
    log("EDA …")
    print(f"  ridership/station-hour: mean {df.ridership.mean():.1f}  "
          f"median {df.ridership.median():.1f}  max {df.ridership.max():.0f}")
    hourly = df.assign(h=df.ts.dt.hour).groupby("h").ridership.mean()
    dow = df.assign(d=df.ts.dt.dayofweek).groupby("d").ridership.mean()
    print("  peak hour:", int(hourly.idxmax()), " trough hour:", int(hourly.idxmin()))
    print("  busiest dow (0=Mon):", int(dow.idxmax()), " quietest:", int(dow.idxmin()))
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        os.makedirs(outdir, exist_ok=True)
        fig, ax = plt.subplots(1, 2, figsize=(11, 4))
        hourly.plot(ax=ax[0], marker="o"); ax[0].set(title="Mean ridership by hour", xlabel="hour")
        dow.plot(ax=ax[1], marker="o"); ax[1].set(title="Mean ridership by day-of-week", xlabel="0=Mon")
        fig.tight_layout(); fig.savefig(os.path.join(outdir, "eda_profiles.png"), dpi=110)
        log(f"  saved {outdir}/eda_profiles.png")
    except Exception as e:
        log(f"  (matplotlib plot skipped: {e})")


def addons(best, feats, test, full, outdir, plot_station=None):
    """Feature-importance readout (permutation, in MAE units) + a station sanity plot."""
    try:
        from sklearn.inspection import permutation_importance
        samp = test.sample(min(len(test), 20000), random_state=0)
        log("Add-on: permutation importance (~30s)…")
        r = permutation_importance(best, samp[feats], samp.ridership,
                                   scoring="neg_mean_absolute_error",
                                   n_repeats=5, random_state=0, n_jobs=-1)
        order = np.argsort(r.importances_mean)[::-1]
        print("\n  Feature importance (Δ test-MAE when shuffled; larger = more important):")
        for i in order:
            print(f"    {feats[i]:<18}{r.importances_mean[i]:>8.1f}  ± {r.importances_std[i]:.1f}")
    except Exception as e:
        log(f"  (permutation importance skipped: {e})")

    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        station = plot_station or full.groupby("station_complex_id").ridership.mean().idxmax()
        sub = full[(full.station_complex_id == station) & (full.dow < 5)]
        g = sub.groupby("hour").agg(actual=("ridership", "mean"), pred=("pred", "mean"))
        fig, ax = plt.subplots(figsize=(8, 4.5))
        ax.plot(g.index, g.actual, marker="o", label="actual")
        ax.plot(g.index, g.pred, marker="s", label="predicted")
        ax.set(title=f"Station {station} — weekday ridership by hour",
               xlabel="hour", ylabel="riders / hour")
        ax.legend(); fig.tight_layout()
        safe = "".join(c if c.isalnum() else "_" for c in str(station))
        path = os.path.join(outdir, f"sanity_station_{safe}.png")
        fig.savefig(path, dpi=110)
        log(f"  saved {path}  (station {station})")
    except Exception as e:
        log(f"  (sanity plot skipped: {e})")


def add_features(df):
    df = df.copy()
    df["hour"] = df.ts.dt.hour
    df["dow"] = df.ts.dt.dayofweek
    df["is_weekend"] = (df.dow >= 5).astype(int)
    df["month"] = df.ts.dt.month
    doy = df.ts.dt.dayofyear
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    df["hr_sin"] = np.sin(2 * np.pi * df.hour / 24)
    df["hr_cos"] = np.cos(2 * np.pi * df.hour / 24)
    try:
        import holidays
        from datetime import timedelta
        us = holidays.US(state="NY", years=range(df.ts.dt.year.min(), df.ts.dt.year.max() + 1))
        d = df.ts.dt.date.astype("O")
        df["is_holiday"] = d.map(lambda x: int(x in us))
        # adjacent = day before or day after a public holiday (bridge days), but not the holiday itself
        df["is_holiday_adj"] = d.map(
            lambda x: int(((x - timedelta(days=1)) in us or (x + timedelta(days=1)) in us)
                          and x not in us))
    except Exception:
        df["is_holiday"] = 0
        df["is_holiday_adj"] = 0
        log("  (holidays pkg not installed → is_holiday=is_holiday_adj=0; pip install holidays to enable)")
    return df


FEATURES = ["hour", "dow", "is_weekend", "month", "doy_sin", "doy_cos",
            "hr_sin", "hr_cos", "is_holiday", "is_holiday_adj", "station_te"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    ap.add_argument("--holdout-weeks", type=int, default=6)
    ap.add_argument("--fast", action="store_true",
                    help="subsample for the RandomForest (speed)")
    ap.add_argument("--rich-encoding", action="store_true",
                    help="add station x hour and station x dow target-encodings (train-only)")
    ap.add_argument("--addons", action="store_true",
                    help="feature-importance readout + a station sanity plot")
    ap.add_argument("--plot-station", default=None,
                    help="station_complex_id for the sanity plot (default: busiest)")
    ap.add_argument("--write-db", action="store_true",
                    help="also write station_hourly_profile back to the DB")
    ap.add_argument("--outdir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs"))
    ap.add_argument("--refresh", action="store_true", help="force re-pull, ignore the cached data")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)

    cache = os.path.join(args.outdir, "station_hours.pkl")
    df = load_station_hours(args.dsn, cache=cache, refresh=args.refresh)
    eda(df, args.outdir)
    df = add_features(df)

    # ---- time-based split -------------------------------------------------
    cutoff = df.ts.max() - pd.Timedelta(weeks=args.holdout_weeks)
    train, test = df[df.ts <= cutoff].copy(), df[df.ts > cutoff].copy()
    log(f"Split @ {cutoff:%Y-%m-%d}: train {len(train):,}  test {len(test):,}")

    # station target-encoding, fit on TRAIN ONLY (no leakage)
    te = train.groupby("station_complex_id").ridership.mean()
    global_mean = train.ridership.mean()
    for d in (train, test):
        d["station_te"] = d.station_complex_id.map(te).fillna(global_mean)

    # rich encoding: station x hour and station x dow profiles (train-only, fall back to station_te)
    feats = list(FEATURES)
    sh_map = sd_map = None
    if args.rich_encoding:
        log("Rich encoding ON: adding station_hour_te + station_dow_te (train-only).")
        sh_map = train.groupby(["station_complex_id", "hour"]).ridership.mean()
        sd_map = train.groupby(["station_complex_id", "dow"]).ridership.mean()
        for d in (train, test):
            d["station_hour_te"] = pd.Series(
                d.set_index(["station_complex_id", "hour"]).index.map(sh_map),
                index=d.index).fillna(d["station_te"])
            d["station_dow_te"] = pd.Series(
                d.set_index(["station_complex_id", "dow"]).index.map(sd_map),
                index=d.index).fillna(d["station_te"])
        feats += ["station_hour_te", "station_dow_te"]

    # baseline lookup: (station, dow, hour) mean from train
    base = train.groupby(["station_complex_id", "dow", "hour"]).ridership.mean()
    base_pred = test.set_index(["station_complex_id", "dow", "hour"]).index.map(base)
    base_pred = pd.Series(base_pred, index=test.index).fillna(global_mean).astype(float)

    Xtr, ytr = train[feats], train.ridership
    Xte, yte = test[feats], test.ridership

    def score(name, pred):
        mae = mean_absolute_error(yte, pred)
        rmse = mean_squared_error(yte, pred) ** 0.5
        return name, mae, rmse

    results = [score("Baseline (cell mean)", base_pred)]

    log("Training Linear …")
    lin = LinearRegression().fit(Xtr, ytr)
    results.append(score("LinearRegression", lin.predict(Xte)))

    log("Training HistGradientBoosting …")
    hgb = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.06,
                                        max_depth=8, random_state=0).fit(Xtr, ytr)
    results.append(score("HistGradientBoosting", hgb.predict(Xte)))

    log("Training RandomForest …" + (" (subsampled)" if args.fast else ""))
    rf_tr = train.sample(min(len(train), 300_000), random_state=0) if args.fast else train
    rf = RandomForestRegressor(n_estimators=120, max_depth=18, n_jobs=-1,
                               random_state=0).fit(rf_tr[feats], rf_tr.ridership)
    results.append(score("RandomForest", rf.predict(Xte)))

    # ---- results table ----------------------------------------------------
    print("\n" + "=" * 58)
    print(f"{'model':<26}{'MAE':>10}{'RMSE':>12}{'  vs base':>10}")
    print("-" * 58)
    base_mae = results[0][1]
    for name, mae, rmse in results:
        delta = "" if name.startswith("Baseline") else f"{(base_mae-mae)/base_mae*100:+.1f}%"
        print(f"{name:<26}{mae:>10.1f}{rmse:>12.1f}{delta:>10}")
    print("=" * 58)
    print("Interpretation: a small/again-marginal ML gain over the baseline is the")
    print("expected, honest result for a signal this periodic — report it as such.\n")

    # ---- servable typical profile: station x dow x hour -------------------
    log("Building servable typical profile (station x dow x hour)…")
    ml_models = {"LinearRegression": lin, "HistGradientBoosting": hgb, "RandomForest": rf}
    best_name = min((r for r in results if not r[0].startswith("Baseline")),
                    key=lambda r: r[1])[0]
    best = ml_models[best_name]
    log(f"  using best ML model by test MAE: {best_name}")
    full = df.copy()
    full["station_te"] = full.station_complex_id.map(te).fillna(global_mean)
    if args.rich_encoding:
        full["station_hour_te"] = pd.Series(
            full.set_index(["station_complex_id", "hour"]).index.map(sh_map),
            index=full.index).fillna(full["station_te"])
        full["station_dow_te"] = pd.Series(
            full.set_index(["station_complex_id", "dow"]).index.map(sd_map),
            index=full.index).fillna(full["station_te"])
    full["pred"] = best.predict(full[feats])
    prof = (full.groupby(["station_complex_id", "dow", "hour"])
                .agg(mean_ridership=("ridership", "mean"),
                     pred_ridership=("pred", "mean"),
                     n_obs=("ridership", "size"))
                .reset_index())
    out_csv = os.path.join(args.outdir, "station_hourly_profile.csv")
    prof.to_csv(out_csv, index=False)
    log(f"  wrote {out_csv}  ({len(prof):,} rows = {prof.station_complex_id.nunique()} stations x 7 x 24)")

    if args.addons:
        addons(best, feats, test, full, args.outdir, args.plot_station)

    if args.write_db:
        log("Writing station_hourly_profile to DB …")
        try:
            from sqlalchemy import create_engine
            eng = create_engine(args.dsn)
            prof.to_sql("station_hourly_profile", eng, if_exists="replace", index=False)
            log("  done.")
        except Exception as e:
            log(f"  DB write failed ({e}). CSV is still available; load it manually if needed.")

    log("Phase 2 complete.")


if __name__ == "__main__":
    main()
