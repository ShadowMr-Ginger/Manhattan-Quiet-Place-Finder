// Sign of (positive - negative). The former `net >= 2` / `net <= -2` branches were
// dead code: net >= 2 implies positive > negative, so the later comparison already
// caught them. Verified identical output across all 326 venues.
export function computeCalmLabel(positive, neutral, negative) {
  if (positive > negative) return 'leansCalm'
  if (negative > positive) return 'leansLively'
  return 'mixed'
}

export function calmLabelToLevel(labelKey) {
  if (labelKey === 'leansCalm') return 'calm'
  if (labelKey === 'leansLively') return 'lively'
  return 'mixed'
}

/**
 * Indoor-quiet level for a place, or null when no reviewer mentioned noise
 * or crowding. 166 of 326 venues have no indoor signal at all, so callers
 * must treat null as "unknown", never as "not quiet".
 */
export function quietInsideLevelFromSignals(signals) {
  const calm = signals?.quietInside
  if (!calm || (calm.n ?? 0) < 1) return null
  return calmLabelToLevel(calm.labelKey ?? 'mixed')
}

export function isConstructionHoursActive(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const isWeekday = !['Sat', 'Sun'].includes(weekday)
  return isWeekday && hour >= 7 && hour < 18
}

// busyness_pct / quiet-profile current_pct: shared 0–100 scale.
// Keep in sync with backend `_crowdedness_from_busyness` (venues.py): low < 8, medium < 25.
export const BUSYNESS_PCT_LOW_MAX = 8
export const BUSYNESS_PCT_HIGH_MIN = 25

export function busynessPctToLevel(busynessPct) {
  if (busynessPct == null || Number.isNaN(busynessPct)) return null
  if (busynessPct < BUSYNESS_PCT_LOW_MAX) return 'low'
  if (busynessPct < BUSYNESS_PCT_HIGH_MIN) return 'medium'
  return 'high'
}

export function getNycDayHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const dowMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

  return {
    dow: dowMap[weekday] ?? 0,
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
  }
}

export function getCurrentHourlyBusyness(hourly = [], now = new Date()) {
  if (!hourly.length) return null

  const { dow, hour } = getNycDayHour(now)
  const row =
    hourly.find(
      (entry) => Number(entry.dow) === dow && Number(entry.hour) === hour,
    ) ??
    hourly.find(
      (entry) => entry.dow == null && Number(entry.hour) === hour,
    )

  if (!row) return null

  return {
    dow,
    hour,
    busynessPct: row.busynessPct ?? row.busyness_pct ?? null,
  }
}

export function getBusynessCrowdednessLevel(busyness) {
  if (!busyness) return null

  const rawLevel = busyness.level ?? busyness.busynessLevel
  if (rawLevel === 'moderate') return 'medium'
  if (['low', 'medium', 'high'].includes(rawLevel)) return rawLevel

  const currentPct =
    busyness.currentBusynessPct ??
    busyness.current_busyness_pct ??
    busyness.currentPct ??
    busyness.current_pct ??
    getCurrentHourlyBusyness(busyness.hourly)?.busynessPct

  return busynessPctToLevel(currentPct)
}

export function buildQuietInsideFromAttributes(attributeScores = {}) {
  const noise = attributeScores.noise
  const crowding = attributeScores.crowding
  const positive = (noise?.positive ?? 0) + (crowding?.positive ?? 0)
  const neutral = (noise?.neutral ?? 0) + (crowding?.neutral ?? 0)
  const negative = (noise?.negative ?? 0) + (crowding?.negative ?? 0)
  const n = positive + neutral + negative
  if (n < 1) return null

  return {
    positive,
    neutral,
    negative,
    n,
    labelKey: computeCalmLabel(positive, neutral, negative),
  }
}
