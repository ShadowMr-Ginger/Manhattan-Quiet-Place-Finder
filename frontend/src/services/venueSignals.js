import { apiRequest } from './api'
import {
  buildQuietInsideFromAttributes,
  computeCalmLabel,
  getBusynessCrowdednessLevel,
  getCurrentHourlyBusyness,
  getNycDayHour,
} from '../utils/venueSignalsDisplay'

/**
 * Backend contract: GET /venues/{id}/quiet-profile
 *
 * Maps ML quiet-profile payload into the signals shape used by VenueSignalsSection.
 */
function mapQuietInside(raw) {
  if (!raw) return null
  const positive = raw.positive ?? raw.calmPos ?? 0
  const neutral = raw.neutral ?? raw.calmNeu ?? 0
  const negative = raw.negative ?? raw.calmNeg ?? 0
  const n = raw.n ?? raw.calmN ?? positive + neutral + negative
  const show = raw.show ?? raw.showCalm ?? n >= 1
  if (!show || n < 1) return null

  return {
    show: true,
    positive,
    neutral,
    negative,
    n,
    labelKey: raw.labelKey ?? raw.label ?? computeCalmLabel(positive, neutral, negative),
  }
}

function mapAreaNoise(raw) {
  if (!raw) return null
  return {
    roadDb: raw.roadDb ?? raw.road_db ?? null,
    complaintsPerYear: raw.complaintsPerYear ?? raw.noise311Within100m ?? raw.noise311_within100m ?? null,
    radiusM: raw.radiusM ?? raw.radius_m ?? 100,
  }
}

function mapHappeningNearby(raw) {
  if (!raw) return null
  return {
    constructionSites150m: raw.constructionSites150m ?? raw.construction_sites_150m ?? null,
    eventsCount: raw.eventsCount ?? raw.nEventsNearby ?? raw.n_events_nearby ?? 0,
    events: raw.events ?? [],
  }
}

function mapBusyness(raw) {
  if (!raw) return null
  const hourly = (raw.hourly ?? []).map((row) => ({
    dow: row.dow,
    hour: row.hour,
    busynessPct: row.busynessPct ?? row.busyness_pct ?? 0,
  }))

  // Source of truth for "now": quiet-profile `busyness.current_pct`.
  const quietProfileCurrentPct =
    raw.current_pct ??
    raw.currentPct ??
    raw.currentBusynessPct ??
    raw.current_busyness_pct ??
    null

  const fromCurve = getCurrentHourlyBusyness(hourly)?.busynessPct ?? null

  const mapped = {
    peakBusynessPct: raw.peakBusynessPct ?? raw.peak_busyness_pct ?? null,
    nearestStationM: raw.nearestStationM ?? raw.nearest_station_m ?? null,
    lowConfidence: raw.lowConfidence ?? (raw.nearestStationM ?? raw.nearest_station_m ?? 0) > 800,
    hourly,
    currentBusynessPct: quietProfileCurrentPct ?? fromCurve,
    level: raw.level ?? raw.busynessLevel ?? null,
  }

  mapped.level = mapped.level ?? getBusynessCrowdednessLevel(mapped)
  return mapped
}

function mapQuietProfileResponse(data) {
  if (!data) return null

  const calm = data.calm_bar?.calm
  const quietInside =
    data.calm_bar?.show && calm && (calm.n ?? 0) >= 1
      ? mapQuietInside({
          show: true,
          positive: calm.pos ?? 0,
          neutral: calm.neu ?? 0,
          negative: calm.neg ?? 0,
          n: calm.n ?? 0,
        })
      : null

  const noise = data.noise
  const areaNoise = noise
    ? mapAreaNoise({
        roadDb: noise.road_db,
        complaintsPerYear: noise.complaints_within_100m ?? noise.complaints_per_year,
        radiusM: 100,
      })
    : null

  const construction = data.construction
  const events = data.events
  const happeningNearby =
    construction || events
      ? mapHappeningNearby({
          constructionSites150m: construction?.sites_within_150m,
          eventsCount: events?.n_nearby ?? 0,
          events: [],
        })
      : null

  const busynessRaw = data.busyness
  const transit = data.transit
  const { dow } = getNycDayHour()
  const hourly = (busynessRaw?.today_curve ?? [])
    .map((row) => ({
      dow,
      hour: row.hour,
      busynessPct: row.busyness_pct ?? row.busynessPct ?? null,
    }))
    .filter((row) => row.busynessPct != null)

  const busyness = busynessRaw
    ? mapBusyness({
        peakBusynessPct: busynessRaw.peak_pct,
        nearestStationM: transit?.nearest_station_m,
        // Explicit quiet-profile field — used for list/detail crowdedness badges.
        current_pct: busynessRaw.current_pct,
        hourly,
      })
    : null

  return {
    quietInside,
    areaNoise,
    happeningNearby,
    busyness,
  }
}

function isQuietProfilePayload(data) {
  return Boolean(
    data.noise ||
      data.construction ||
      data.events ||
      data.transit ||
      data.calm_bar ||
      (data.busyness && ('today_curve' in data.busyness || 'current_pct' in data.busyness)),
  )
}

export function mapVenueSignalsResponse(data) {
  if (!data) return null

  if (isQuietProfilePayload(data)) {
    return mapQuietProfileResponse(data)
  }

  // Already in frontend signals shape
  if (data.quietInside || data.areaNoise || data.happeningNearby || data.busyness) {
    return {
      quietInside: mapQuietInside(data.quietInside ?? data.quiet_inside),
      areaNoise: mapAreaNoise(data.areaNoise ?? data.area_noise),
      happeningNearby: mapHappeningNearby(data.happeningNearby ?? data.happening_nearby),
      busyness: mapBusyness(data.busyness),
    }
  }

  return null
}

export async function fetchVenueSignals(venueId) {
  try {
    const data = await apiRequest(`/venues/${encodeURIComponent(venueId)}/quiet-profile`)
    return mapVenueSignalsResponse(data)
  } catch {
    return null
  }
}

export function resolveVenueSignals(apiSignals, place) {
  const quietInside =
    apiSignals?.quietInside ?? buildQuietInsideFromAttributes(place?.attributeScores)

  if (!apiSignals && !quietInside) {
    return null
  }

  return {
    quietInside,
    areaNoise: apiSignals?.areaNoise ?? null,
    happeningNearby: apiSignals?.happeningNearby ?? null,
    busyness: apiSignals?.busyness ?? null,
  }
}
