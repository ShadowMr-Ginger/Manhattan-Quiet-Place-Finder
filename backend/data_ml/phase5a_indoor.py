#!/usr/bin/env python3
"""
Phase 5a — indoor "Calm to work" bar feed (noise + crowding pooled).

Indoor quiet is shown as the editorial attribute BARS, not a scalar (at n=2–3 a
scalar/rate hides how thin the evidence is). The frontend already renders the
per-attribute bars from the editorial DB; this script produces the ONE extra
thing needed: the pooled "Calm to work" bar = noise + crowding positive/neutral/
negative counts summed (both attributes are scored same-direction — positive =
good for calm work — confirmed from the extraction prompt; crowding notes printed
below to re-confirm).

Display gate is n >= 1 (a single mention is still signal as long as the count is
shown). The combined bar pools noise+crowding, so a venue with noise n=1 +
crowding n=1 yields a calm bar of n=2 while each component bar (n=1) also shows —
no orphaned bar.

Output: outputs/venue_calm_bar.csv
        (noise_* , crowding_* , calm_*  pos/neu/neg/n per venue)

Usage:
    python data_ml/phase5a_indoor.py
"""
import json, os, sys
import numpy as np
import pandas as pd

DEFAULT_DSN = "postgresql://hushhub:hushhub@43.157.51.61:5432/hushhub"

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
except ImportError:
    sys.exit("pip install psycopg2-binary pandas python-dotenv")


def cell(attrs, key):
    return attrs.get(key) if isinstance(attrs, dict) else None


def counts(a, key):
    """(positive, neutral, negative, n) for an attribute, zeros if absent."""
    c = cell(a, key) or {}
    return (int(c.get("positive", 0)), int(c.get("neutral", 0)),
            int(c.get("negative", 0)), int(c.get("n", 0)))


def main():
    dsn = os.environ.get("DATABASE_URL", DEFAULT_DSN)
    conn = psycopg2.connect(dsn, connect_timeout=15)
    v = pd.read_sql("SELECT canonical_id, canonical_name, venue_type, attribute_scores FROM venues", conn)
    conn.close()

    def parse(x):
        if isinstance(x, str):
            try: return json.loads(x)
            except Exception: return {}
        return x or {}
    v["acells"] = v.attribute_scores.map(parse)

    # ---- coverage at n>=1 vs n>=2 (shows the gain from lowering the gate) --
    print("=" * 72)
    print(f"venues: {len(v)}")
    for attr in ["noise", "crowding"]:
        n1 = v["acells"].map(lambda a: counts(a, attr)[3] >= 1).sum()
        n2 = v["acells"].map(lambda a: counts(a, attr)[3] >= 2).sum()
        print(f"   {attr:<10} coverage: n>=1 {n1:>3}/{len(v)}   n>=2 {n2:>3}/{len(v)}")

    # ---- crowding polarity re-check: print notes with their net -----------
    print("\ncrowding — sample cells (confirm +net = LESS crowded / good for work):")
    shown = 0
    for _, r in v.iterrows():
        c = cell(r["acells"], "crowding")
        if c and c.get("n", 0) >= 2:
            net = c.get("positive", 0) - c.get("negative", 0)
            print(f"   net={net:>+3}  n={c.get('n')}  {str(c.get('note'))[:52]:<52} | {r.canonical_name[:24]}")
            shown += 1
            if shown >= 8:
                break

    # ---- build the pooled "Calm to work" bar ------------------------------
    rows = []
    for _, r in v.iterrows():
        np_, nu, ng, nn = counts(r["acells"], "noise")
        cp, cu, cg, cn = counts(r["acells"], "crowding")
        rows.append(dict(
            canonical_id=r.canonical_id, canonical_name=r.canonical_name, venue_type=r.venue_type,
            noise_pos=np_, noise_neu=nu, noise_neg=ng, noise_n=nn,
            crowding_pos=cp, crowding_neu=cu, crowding_neg=cg, crowding_n=cn,
            calm_pos=np_ + cp, calm_neu=nu + cu, calm_neg=ng + cg, calm_n=nn + cn))
    out = pd.DataFrame(rows)
    out["show_calm"] = out.calm_n >= 1                      # frontend display gate (n>=1)

    print(f"\nCalm bar available (calm_n >= 1): {int(out.show_calm.sum())}/{len(out)} venues")
    print("sample (calm bar = noise + crowding pooled):")
    for _, r in out[out.show_calm].sort_values("calm_n", ascending=False).head(6).iterrows():
        print(f"   {r.canonical_name[:26]:<26} {r.venue_type:<9} "
              f"calm[+{r.calm_pos}/~{r.calm_neu}/-{r.calm_neg}] (n={r.calm_n})  "
              f"= noise[+{r.noise_pos}/-{r.noise_neg}] + crowd[+{r.crowding_pos}/-{r.crowding_neg}]")
    print("=" * 72)

    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs", "venue_calm_bar.csv")
    out.to_csv(p, index=False)
    print(f"wrote {p}")


if __name__ == "__main__":
    main()
