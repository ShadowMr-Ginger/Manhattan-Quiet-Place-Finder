import { TIME_OPTIONS } from '../data/constants'
import {
  busynessPctToLevel,
  getCurrentHourlyBusyness,
  getNycDayHour,
} from './venueSignalsDisplay'

const FORECAST_SLOT_KEYS = TIME_OPTIONS.map((option) => option.key)
const FULL_DAY_HOURS = 20

function hourLabel(hour) {
  const normalized = ((hour % 24) + 24) % 24
  if (normalized === 0) return '12 AM'
  if (normalized < 12) return `${normalized} AM`
  if (normalized === 12) return '12 PM'
  return `${normalized - 12} PM`
}

function lookupHourlyPct(hourly, when = new Date()) {
  const { dow, hour } = getNycDayHour(when)
  const row =
    hourly.find((entry) => Number(entry.dow) === dow && Number(entry.hour) === hour) ??
    hourly.find((entry) => entry.dow == null && Number(entry.hour) === hour) ??
    hourly.find((entry) => Number(entry.hour) === hour)

  if (!row) return null
  return row.busynessPct ?? row.busyness_pct ?? null
}

function countUniqueHours(hourly) {
  const hours = new Set()
  for (const entry of hourly) {
    const hour = Number(entry.hour)
    const pct = entry.busynessPct ?? entry.busyness_pct
    if (!Number.isNaN(hour) && pct != null) hours.add(hour)
  }
  return hours.size
}

function buildSlot(offsetHours, hourly, now = new Date()) {
  const target = new Date(now.getTime() + offsetHours * 60 * 60 * 1000)
  const { hour } = getNycDayHour(target)
  const busynessPct = lookupHourlyPct(hourly, target)

  return {
    key: offsetHours === 0 ? 'now' : `plus${offsetHours}`,
    offsetHours,
    hour,
    busynessPct: busynessPct != null ? Math.round(busynessPct * 10) / 10 : null,
    level: busynessPctToLevel(busynessPct),
  }
}

export function buildBusynessForecastFromHourly(busyness, now = new Date()) {
  const hourly = busyness?.hourly ?? []
  if (!hourly.length) return null

  const hasFullDay = countUniqueHours(hourly) >= FULL_DAY_HOURS
  const horizon = hasFullDay ? 24 : FORECAST_SLOT_KEYS.length

  const chart = []
  for (let offset = 0; offset < horizon; offset += 1) {
    const slot = buildSlot(offset, hourly, now)
    if (slot.busynessPct == null && hasFullDay) continue
    chart.push({
      ...slot,
      key: offset === 0 ? 'now' : `plus${offset}`,
      label: hourLabel(slot.hour),
    })
  }

  if (!chart.length) return null

  const slots = chart.slice(0, FORECAST_SLOT_KEYS.length)

  const { dow } = getNycDayHour(now)
  const todayRows = hourly.filter(
    (entry) => entry.dow == null || Number(entry.dow) === dow,
  )
  const peakSource = todayRows.length ? todayRows : hourly
  let peakHour = null
  let peakBusynessPct = busyness.peakBusynessPct ?? null

  if (peakSource.length) {
    const peakRow = peakSource.reduce((best, row) => {
      const pct = row.busynessPct ?? row.busyness_pct ?? 0
      const bestPct = best.busynessPct ?? best.busyness_pct ?? 0
      return pct > bestPct ? row : best
    }, peakSource[0])
    peakHour = Number(peakRow.hour)
    peakBusynessPct = peakRow.busynessPct ?? peakRow.busyness_pct ?? peakBusynessPct
  }

  const current = getCurrentHourlyBusyness(hourly, now)

  return {
    slots,
    chart,
    variant: hasFullDay && chart.length >= FULL_DAY_HOURS ? 'line' : 'bars',
    peakHour,
    peakBusynessPct,
    lowConfidence: Boolean(busyness.lowConfidence),
    nearestStationM: busyness.nearestStationM ?? null,
    source: 'hourly_profile',
    currentHour: current?.hour ?? getNycDayHour(now).hour,
  }
}

/** Same "now" point the Busy level chart uses — keep list badges in sync. */
export function getBusyLevelNowFromBusyness(busyness, now = new Date()) {
  const forecast = buildBusynessForecastFromHourly(busyness, now)
  if (!forecast?.chart?.length) return null
  const nowSlot =
    forecast.chart.find((slot) => slot.key === 'now') ?? forecast.chart[0]
  if (!nowSlot) return null
  return {
    busynessPct: nowSlot.busynessPct,
    level: nowSlot.level ?? busynessPctToLevel(nowSlot.busynessPct),
    hour: nowSlot.hour,
    label: nowSlot.label,
  }
}
