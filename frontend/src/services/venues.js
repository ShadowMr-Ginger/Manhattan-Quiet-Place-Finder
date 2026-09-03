import { apiRequest } from './api'
import { fetchVenueSignals, resolveVenueSignals } from './venueSignals'
import {
  busynessPctToLevel,
  getBusynessCrowdednessLevel,
  quietInsideLevelFromSignals,
} from '../utils/venueSignalsDisplay'
import { getBusyLevelNowFromBusyness } from '../utils/busynessForecast'
import { applyUserRatingFields, mergeGoogleRatingIntoPlace } from '../utils/userRating'
import { fetchPlaceCoreDetails, getCachedPlaceCoreDetails } from './googleMapsData'

const DEFAULT_MIN_MENTIONS = 1

const PHOTO_SETS = {
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
  ],
  library: [
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80',
    'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80',
  ],
  public: [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  ],
}

export function mapBackendType(type, name = '') {
  if (type === 'library') return 'library'
  // Dataset often labels cafés as restaurant/bar.
  if (type === 'cafe' || type === 'restaurant' || type === 'bar') return 'cafe'
  if (type === 'public' || type === 'park') return 'public'

  // Ambiguous labels (other / hotel / …) — infer from name.
  const n = String(name || '').toLowerCase()
  if (/\b(librar|reading room)\b/.test(n)) return 'library'
  if (
    /\b(cafe|café|coffee|bakery|bakeshop|espresso|tea house|tea shop)\b/.test(n)
  ) {
    return 'cafe'
  }

  return 'public'
}

function mapSummaryCrowdedness(summary) {
  // Prefer list-payload crowdedness (already batch-derived from current-hour
  // busyness on the backend). quiet-profile enrichment can refine later.
  const raw = summary.busynessLevel ?? summary.busyness_level ?? summary.crowdedness
  if (raw === 'moderate') return 'medium'
  if (['low', 'medium', 'high'].includes(raw)) return raw
  return null
}

function crowdingFromAttributes(attributeScores) {
  const crowding = attributeScores?.crowding
  if (!crowding || crowding.n < 2) return null
  if (crowding.net >= 1) return 'low'
  if (crowding.net <= -2) return 'high'
  return 'medium'
}

function buildTags({ mentionCount, attributeScores, osm, accessibilityManual }) {
  const tags = new Set()

  if (mentionCount > 0) {
    tags.add(`${mentionCount} write-ups`)
  }

  for (const [key, value] of Object.entries(attributeScores ?? {})) {
    if (!value || value.n < 2 || !value.note || value.net <= 0) continue
    tags.add(`${key}: ${value.note}`)
  }

  const osmTags = osm?.tags
  if (osmTags?.internet_access) tags.add('WiFi available')
  if (osmTags?.wheelchair === 'yes' || accessibilityManual?.wheelchair === 'yes') {
    tags.add('Wheelchair accessible')
  }
  if (osmTags?.outdoor_seating) tags.add('Outdoor seating')

  return Array.from(tags).slice(0, 6)
}

function latLngToMapPercent(lat, lng) {
  const minLat = 40.704
  const maxLat = 40.882
  const minLng = -74.02
  const maxLng = -73.907

  const mapX = ((lng - minLng) / (maxLng - minLng)) * 80 + 10
  const mapY = ((maxLat - lat) / (maxLat - minLat)) * 70 + 10

  return {
    mapX: Math.max(5, Math.min(95, mapX)),
    mapY: Math.max(5, Math.min(95, mapY)),
  }
}

export function apiSummaryToPlace(summary) {
  const type = mapBackendType(summary.type, summary.name)
  const quietScore = summary.quietScore ?? 0
  const displayRating = summary.displayRating ?? 0
  const userRatingFields = applyUserRatingFields(summary)
  const { mapX, mapY } = latLngToMapPercent(summary.lat, summary.lng)
  const zipMatch = (summary.address ?? '').match(/\b(10\d{3})\b/)

  return {
    id: summary.id,
    placeId: summary.placeId,
    name: summary.name,
    canonicalName: summary.name,
    address: summary.address,
    zipCode: zipMatch?.[1] ?? '10001',
    type,
    lat: summary.lat,
    lng: summary.lng,
    mapX,
    mapY,
    quietScore,
    rankingScore: summary.rankingScore ?? 0,
    mentionCount: summary.mentionCount ?? 0,
    uniqueSources: summary.uniqueSources ?? 0,
    displayRating,
    ...userRatingFields,
    occupancy: null,
    capacity: 0,
    currentPct: summary.currentPct ?? summary.current_pct ?? null,
    // List API already batch-computes this from current-hour busyness.
    crowdedness: mapSummaryCrowdedness(summary),
    // 'calm' | 'mixed' | 'lively' | null (null = no reviewer mentioned it).
    // Filled lazily via enrichPlacesFromQuietProfile when the filter is used.
    quietInside: null,
    // Fallback source: raw OSM `opening_hours` string from our own venue data.
    // Only present once the backend exposes `hours` on VenueSummary.
    openingHours: summary.hours ?? null,
    // Primary source: Google Places, filled by enrichPlacesFromGoogleRatings.
    openingPeriods: null,
    openingWeekdayText: null,
    // OSM `wheelchair` tag: 'yes' | 'limited' | 'no' | null. Requires the
    // backend to expose `wheelchair` on VenueSummary; detail payloads carry it
    // in the raw osm blob regardless.
    wheelchairAccess: summary.wheelchair ?? null,
    googleRating: null,
    googleRatingCount: 0,
    distance: 0,
    hours: 'Hours unavailable',
    tags: (summary.mentionCount ?? 0) > 0 ? [`${summary.mentionCount} write-ups`] : [],
    photos: PHOTO_SETS[type] ?? PHOTO_SETS.public,
    editorialQuotes: [],
    businessStatus: summary.businessStatus ?? 'OPERATIONAL',
    attributeScores: {},
    osm: null,
    accessibilityManual: null,
  }
}

function enrichPlaceWithDetail(place, detail, signals, live) {
  const type = mapBackendType(detail.type, detail.name ?? place?.name)
  const attributeScores = detail.attributeScores ?? {}
  const tags = buildTags({
    mentionCount: detail.mentionCount,
    attributeScores,
    osm: detail.osm,
    accessibilityManual: detail.accessibilityManual,
  })

  const resolvedSignals = resolveVenueSignals(signals, { ...place, attributeScores })
  // Match Busy level chart "now" (hourly curve), not raw current_pct alone.
  const busyNow = getBusyLevelNowFromBusyness(resolvedSignals?.busyness)
  const busynessLevel =
    busyNow?.level ?? getBusynessCrowdednessLevel(resolvedSignals?.busyness)
  const mapped = apiSummaryToPlace(detail)

  // Detail payloads often omit user ratings; don't wipe list/review values on click.
  const detailHasUserRating =
    detail.userRating != null && (detail.userReviewCount ?? 0) > 0

  return {
    ...place,
    ...mapped,
    type,
    hours: detail.hours ?? place.hours,
    // Detail always carries the raw OSM string, so a venue opened from the list
    // gets real hours even before the list payload exposes them.
    openingHours: detail.hours ?? place.openingHours ?? null,
    // `mapped` is built from the detail payload and resets these to null, so
    // the already-enriched Google values have to be restored explicitly.
    openingPeriods: place.openingPeriods ?? null,
    openingWeekdayText: place.openingWeekdayText ?? null,
    wheelchairAccess:
      detail.osm?.tags?.wheelchair ?? place.wheelchairAccess ?? null,
    tags: tags.length ? tags : place.tags,
    editorialQuotes: (detail.representativeQuotes ?? []).map((quote, index) => ({
      publication: quote.publication,
      text: quote.quote,
      sourceUrl: quote.source_url,
      order: index + 1,
    })),
    attributeScores,
    osm: detail.osm,
    accessibilityManual: detail.accessibilityManual,
    capacity: Number(detail.osm?.tags?.capacity) || place.capacity,
    currentPct:
      busyNow?.busynessPct ??
      resolvedSignals?.busyness?.currentBusynessPct ??
      mapped.currentPct ??
      place.currentPct ??
      null,
    // Same level as right-panel Busy level "now".
    crowdedness:
      busynessLevel ??
      mapSummaryCrowdedness(detail) ??
      live?.crowdedness ??
      crowdingFromAttributes(attributeScores) ??
      place.crowdedness,
    occupancy: live?.occupancy ?? null,
    quietInside:
      quietInsideLevelFromSignals(resolvedSignals) ?? place.quietInside ?? null,
    signals: resolvedSignals,
    userRating: detailHasUserRating ? mapped.userRating : (place.userRating ?? mapped.userRating),
    userReviewCount: detailHasUserRating
      ? mapped.userReviewCount
      : (place.userReviewCount ?? mapped.userReviewCount),
    rating: detailHasUserRating ? mapped.rating : (place.rating ?? mapped.rating),
    // Google stars come from Places API enrich, not venue detail payload.
    googleRating: place.googleRating ?? mapped.googleRating,
    googleRatingCount: place.googleRatingCount ?? mapped.googleRatingCount ?? 0,
  }
}

export async function fetchVenueDetail(venueId, basePlace, language) {
  const langQuery = language ? `?lang=${encodeURIComponent(language)}` : ''
  const [detail, signals, live] = await Promise.all([
    apiRequest(`/venues/${encodeURIComponent(venueId)}${langQuery}`),
    fetchVenueSignals(venueId),
    apiRequest(`/venues/${encodeURIComponent(venueId)}/live`).catch(() => null),
  ])

  return enrichPlaceWithDetail(basePlace, detail, signals, live)
}

/**
 * Fill list-card crowdedness / indoor-quiet from quiet-profile.
 * Prefer passing a subset via `placeIds` — a full 326-venue fan-out is slow.
 * Calls onPlaceUpdate with a new place object (immutable) as each venue resolves.
 */
export async function enrichPlacesFromQuietProfile(
  places,
  { concurrency = 4, onPlaceUpdate, placeIds = null } = {},
) {
  if (!places?.length) return places

  const allow = placeIds ? new Set(placeIds) : null
  const queue = places
    .map((place, index) => ({ place, index }))
    .filter(({ place }) => !allow || allow.has(place.id))

  if (!queue.length) return places

  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const i = cursor
      cursor += 1
      const { place, index } = queue[i]
      try {
        const signals = await fetchVenueSignals(place.id)
        const busyNow = getBusyLevelNowFromBusyness(signals?.busyness)

        let currentPct = place.currentPct ?? null
        let crowdedness = place.crowdedness ?? null

        if (busyNow?.busynessPct != null) currentPct = busyNow.busynessPct
        if (busyNow?.level) {
          crowdedness = busyNow.level
        } else {
          const pct = signals?.busyness?.currentBusynessPct
          const level = busynessPctToLevel(pct) ?? getBusynessCrowdednessLevel(signals?.busyness)
          if (pct != null) currentPct = pct
          if (level) crowdedness = level
        }

        // Same request already carries calm_bar, so the indoor-quiet level for
        // the list filter costs no extra round trip.
        const quietInside =
          quietInsideLevelFromSignals(signals) ?? place.quietInside ?? null

        if (
          crowdedness === place.crowdedness &&
          currentPct === place.currentPct &&
          quietInside === place.quietInside
        ) {
          continue
        }

        const updated = { ...place, currentPct, crowdedness, quietInside }
        places[index] = updated
        onPlaceUpdate?.(updated)
      } catch {
        // Keep place without badge if quiet-profile fails.
      }
    }
  })

  await Promise.all(workers)
  return places
}

/**
 * Apply cached Google rating/hours onto places synchronously so the list can
 * paint stars on the first frame after /venues returns.
 */
export function hydratePlacesFromGoogleCache(places) {
  if (!places?.length) return places

  for (let i = 0; i < places.length; i += 1) {
    const place = places[i]
    if (!place?.placeId) continue
    if (place.googleRating != null && place.openingPeriods != null) continue

    const cached = getCachedPlaceCoreDetails(place.placeId)
    if (!cached) continue

    const withRating =
      cached.rating != null
        ? mergeGoogleRatingIntoPlace(place, {
            rating: cached.rating,
            userRatingCount: cached.userRatingCount,
          })
        : place

    places[i] = {
      ...withRating,
      openingPeriods: cached.openingPeriods ?? place.openingPeriods,
      openingWeekdayText: cached.openingWeekdayText ?? place.openingWeekdayText,
    }
  }

  return places
}

/**
 * Fill list/detail card stars AND opening hours from Google Places (placeId).
 * Both come from a single Place Details call per venue at no extra SKU cost.
 *
 * Pass `placeIds` to enrich a priority subset first; call again without it for
 * the remainder. Default concurrency is low so the UI stays responsive.
 */
export async function enrichPlacesFromGoogleRatings(
  places,
  { concurrency = 6, onPlaceUpdate, placeIds = null } = {},
) {
  if (!places?.length) return places

  // Places library loads with the map script — wait briefly if needed.
  const readyDeadline = Date.now() + 8000
  while (Date.now() < readyDeadline) {
    if (typeof google !== 'undefined' && google.maps?.importLibrary) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const allow = placeIds ? new Set(placeIds) : null
  const queue = places
    .map((place, index) => ({ place, index }))
    .filter(({ place }) => {
      if (allow && !allow.has(place.id)) return false
      if (!place.placeId) return false
      // Hours are needed even when the rating is already cached, so the guard
      // checks both rather than short-circuiting on rating alone.
      return place.googleRating == null || place.openingPeriods == null
    })

  if (!queue.length) return places

  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const i = cursor
      cursor += 1
      const { place, index } = queue[i]

      try {
        const details = await fetchPlaceCoreDetails(place.placeId)
        if (!details) continue

        const withRating =
          details.rating != null
            ? mergeGoogleRatingIntoPlace(place, {
                rating: details.rating,
                userRatingCount: details.userRatingCount,
              })
            : place

        const updated = {
          ...withRating,
          openingPeriods: details.openingPeriods ?? place.openingPeriods,
          openingWeekdayText:
            details.openingWeekdayText ?? place.openingWeekdayText,
        }

        places[index] = updated
        onPlaceUpdate?.(updated)
      } catch {
        // Keep empty Google rating / hours if the Places request fails.
      }
    }
  })

  await Promise.all(workers)
  return places
}

export async function loadVenues(options = {}) {
  const minMentions = options.minMentions ?? DEFAULT_MIN_MENTIONS
  const language = options.language
  const limit = 200
  let offset = 0
  const all = []

  while (true) {
    const params = new URLSearchParams({
      minMentions: String(minMentions),
      limit: String(limit),
      offset: String(offset),
      sort: 'rankingScore',
    })
    if (language) {
      params.set('lang', language)
    }
    const page = await apiRequest(`/venues?${params.toString()}`)
    all.push(...(page.items ?? []))

    if (all.length >= page.total || (page.items ?? []).length < limit) {
      break
    }
    offset += limit
  }

  const places = all.map(apiSummaryToPlace)
  return places
}
