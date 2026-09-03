const photoCache = new Map()
const labelCache = new Map()
const ratingCache = new Map()

const PLACE_CORE_STORAGE_KEY = 'hushhub.googlePlaceCore.v1'
const PLACE_CORE_TTL_MS = 7 * 24 * 60 * 60 * 1000

let persistentCoreCache = null
let persistTimer = null

function readPersistentCoreCache() {
  if (persistentCoreCache) return persistentCoreCache
  persistentCoreCache = new Map()
  try {
    const raw = localStorage.getItem(PLACE_CORE_STORAGE_KEY)
    if (!raw) return persistentCoreCache
    const parsed = JSON.parse(raw)
    const now = Date.now()
    for (const [placeId, entry] of Object.entries(parsed ?? {})) {
      if (!entry || typeof entry !== 'object') continue
      if (now - (entry.savedAt ?? 0) > PLACE_CORE_TTL_MS) continue
      persistentCoreCache.set(placeId, entry.details ?? null)
    }
  } catch {
    persistentCoreCache = new Map()
  }
  return persistentCoreCache
}

function schedulePersistCoreCache() {
  if (persistTimer != null) return
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    try {
      const out = {}
      const now = Date.now()
      for (const [placeId, details] of readPersistentCoreCache()) {
        out[placeId] = { savedAt: now, details }
      }
      localStorage.setItem(PLACE_CORE_STORAGE_KEY, JSON.stringify(out))
    } catch {
      // Quota / private mode — memory cache still works for this session.
    }
  }, 400)
}

function rememberPlaceCore(placeId, details) {
  ratingCache.set(placeId, details)
  readPersistentCoreCache().set(placeId, details)
  schedulePersistCoreCache()
}

/** Sync lookup used to paint list stars before any network call. */
export function getCachedPlaceCoreDetails(placeId) {
  if (!placeId) return null
  if (ratingCache.has(placeId)) return ratingCache.get(placeId)
  const stored = readPersistentCoreCache().get(placeId)
  if (stored !== undefined) {
    ratingCache.set(placeId, stored)
    return stored
  }
  return undefined
}

async function loadPlacesLibrary() {
  return google.maps.importLibrary('places')
}

function readDisplayName(displayName) {
  if (!displayName) return null
  return typeof displayName === 'string' ? displayName : displayName.text ?? null
}

/**
 * Localized venue name + address via the new Places API (Place Details).
 * @returns {Promise<{ name: string, address: string } | null>}
 */
export async function fetchLocalizedPlaceLabels(placeId, language = 'en') {
  if (!placeId) return null

  const cacheKey = `${placeId}:${language}`
  if (labelCache.has(cacheKey)) return labelCache.get(cacheKey)

  try {
    const { Place } = await loadPlacesLibrary()
    const place = new Place({ id: placeId })
    await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })

    const name = readDisplayName(place.displayName)
    if (!name) return null

    const labels = {
      name,
      address: place.formattedAddress ?? '',
    }
    labelCache.set(cacheKey, labels)
    return labels
  } catch (error) {
    console.warn('fetchLocalizedPlaceLabels failed for', placeId, error?.message)
    return null
  }
}

/**
 * Rating + opening hours for a venue in ONE Place Details call.
 *
 * Cost note: `rating`, `userRatingCount` and `regularOpeningHours` are all
 * Enterprise-tier fields, and Places bills at the highest tier in the request.
 * The rating fields already trigger Enterprise, so adding opening hours changes
 * neither the request count nor the SKU — it is free.
 *
 * @returns {Promise<{ rating: number|null, userRatingCount: number,
 *                     openingPeriods: Array|null,
 *                     openingWeekdayText: string[]|null } | null>}
 */
export async function fetchPlaceCoreDetails(placeId) {
  if (!placeId) return null
  const cached = getCachedPlaceCoreDetails(placeId)
  if (cached !== undefined) return cached

  try {
    const { Place } = await loadPlacesLibrary()
    const place = new Place({ id: placeId })
    await place.fetchFields({
      fields: ['rating', 'userRatingCount', 'regularOpeningHours'],
    })

    const hours = place.regularOpeningHours
    const periods = hours?.periods
    const weekdayText = hours?.weekdayDescriptions

    const result = {
      rating: typeof place.rating === 'number' ? place.rating : null,
      userRatingCount: Number(place.userRatingCount) || 0,
      openingPeriods: Array.isArray(periods) && periods.length ? periods : null,
      openingWeekdayText:
        Array.isArray(weekdayText) && weekdayText.length === 7 ? weekdayText : null,
    }
    rememberPlaceCore(placeId, result)
    return result
  } catch (error) {
    console.warn('fetchPlaceCoreDetails failed for', placeId, error?.message)
    rememberPlaceCore(placeId, null)
    return null
  }
}

/**
 * Google Places star rating for a venue (0–5) + review count.
 * @returns {Promise<{ rating: number, userRatingCount: number } | null>}
 */
export async function fetchPlaceGoogleRating(placeId) {
  const details = await fetchPlaceCoreDetails(placeId)
  if (!details || details.rating == null) return null
  return { rating: details.rating, userRatingCount: details.userRatingCount }
}

/**
 * Up to 6 photo URLs for a Google Place via the new Places API.
 * Returns null when unavailable or the place has no photos.
 */
export async function fetchPlacePhotoUrls(placeId) {
  if (!placeId) return null
  if (photoCache.has(placeId)) return photoCache.get(placeId)

  try {
    const { Place } = await loadPlacesLibrary()
    const place = new Place({ id: placeId })
    await place.fetchFields({ fields: ['photos'] })

    if (!place.photos?.length) {
      photoCache.set(placeId, null)
      return null
    }

    const urls = place.photos
      .slice(0, 6)
      .map((photo) => photo.getURI({ maxWidth: 900 }))

    photoCache.set(placeId, urls)
    return urls
  } catch (error) {
    console.warn('fetchPlacePhotoUrls failed for', placeId, error?.message)
    photoCache.set(placeId, null)
    return null
  }
}
