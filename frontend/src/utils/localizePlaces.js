export const MAX_LOCALIZE_PLACES = 50

/** @typedef {{ name?: string, address?: string }} LocalizedLabels */

export function applyLocalizedLabels(place, labels) {
  if (!labels?.name && !labels?.address) return place

  return {
    ...place,
    canonicalName: place.canonicalName ?? place.name,
    name: labels.name || place.name,
    address: labels.address || place.address,
  }
}

export function placeMatchesSearch(place, query) {
  if (!query) return true
  const term = query.toLowerCase()
  const fields = [place.name, place.canonicalName, place.address].filter(Boolean)

  if (fields.some((value) => value.toLowerCase().includes(term))) {
    return true
  }

  return (place.tags ?? []).some((tag) => tag.toLowerCase().includes(term))
}

export function collectPlaceIdsForLocalization({
  filteredPlaces = [],
  selectedPlace = null,
  savedPlaces = [],
  recentPlaces = [],
  max = MAX_LOCALIZE_PLACES,
}) {
  const ids = []
  const seen = new Set()

  const add = (place) => {
    if (!place?.id || !place.placeId || seen.has(place.id)) return
    seen.add(place.id)
    ids.push(place.id)
  }

  if (selectedPlace) add(selectedPlace)
  savedPlaces.forEach(add)
  recentPlaces.forEach(add)
  filteredPlaces.forEach(add)

  return ids.slice(0, max)
}
