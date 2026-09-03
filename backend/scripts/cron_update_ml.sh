#!/usr/bin/env bash
# cron_update_ml.sh
# Daily ML pipeline refresh + DB import for Hush-Hub.
#
# Cron usage (run from server as ubuntu, UTC times):
#   Daily  3 AM UTC  →  data refresh + import
#   Weekly Sunday 2 AM UTC  →  heavy MTA model retrain (phase2)
#
# Add to crontab with:  crontab -e
#   0 3 * * *   /home/ubuntu/Hush-Hub/backend/scripts/cron_update_ml.sh >> /home/ubuntu/Hush-Hub/logs/ml_daily.log 2>&1
#   0 2 * * 0   /home/ubuntu/Hush-Hub/backend/scripts/cron_update_ml.sh --weekly >> /home/ubuntu/Hush-Hub/logs/ml_weekly.log 2>&1

set -euo pipefail

REPO_ROOT="/home/ubuntu/Hush-Hub"
BACKEND="$REPO_ROOT/backend"
VENV="$REPO_ROOT/.venv/bin/python3"
LOG_DIR="$REPO_ROOT/logs"
WEEKLY=${1:-""}

mkdir -p "$LOG_DIR"
echo "========================================"
echo "ML update started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================"

cd "$BACKEND"

# ── Step 1 (weekly only): retrain MTA busyness model ─────────────────────────
if [ "$WEEKLY" = "--weekly" ]; then
    echo ""
    echo "[WEEKLY] Retraining busyness model (phase2 — MTA pull ~10 min)..."
    "$VENV" data_ml/phase2_busyness_model.py
    echo "[WEEKLY] phase2 done."
fi

# ── Step 2: daily ML feature pipeline ────────────────────────────────────────
echo ""
echo "[DAILY] Running ML feature pipeline (run_daily.py)..."
"$VENV" data_ml/run_daily.py
echo "[DAILY] Pipeline done."

# ── Step 3: import fresh CSVs into PostgreSQL ─────────────────────────────────
echo ""
echo "[IMPORT] Importing ML outputs into database..."
"$VENV" -m scripts.import_ml_outputs
echo "[IMPORT] Done."

echo ""
echo "========================================"
echo "ML update finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================"
