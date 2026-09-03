export function getFilledStarCount(displayRating = 0) {
  return Math.min(5, Math.max(0, Math.round(displayRating)))
}

function shortenHours(value) {
  if (!value || value === 'Hours unavailable') return null
  const timeRange = value.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (timeRange) return `${timeRange[1]}–${timeRange[2]}`
  const match = value.match(/(\d{1,2}):?\d{0,2}.*?(\d{1,2})/)
  if (match) return `${match[1]}:00–${match[2]}:00`
  return value.length > 16 ? `${value.slice(0, 14)}…` : value
}

export function getOsmAmenities(place) {
  const tags = place.osm?.tags ?? {}
  const items = []

  // Wheelchair access is deliberately NOT a chip here. A chip that only appears
  // for `wheelchair=yes` silently flattens `limited` and `no` into "unknown";
  // the dedicated row on the card shows all three. See utils/accessibility.js.
  if (tags.internet_access) {
    items.push({
      key: 'wifi',
      label: 'Wi-Fi',
      title: String(tags.internet_access),
    })
  }
  if (tags.toilets === 'yes' || tags['toilets:wheelchair']) {
    items.push({
      key: 'toilets',
      label: 'toilets',
      title: 'Restrooms available',
    })
  }
  const hours = tags.opening_hours ?? (place.hours !== 'Hours unavailable' ? place.hours : null)
  if (hours) {
    items.push({
      key: 'hours',
      label: shortenHours(hours) ?? String(hours),
      title: hours,
    })
  }
  if (tags.outdoor_seating) {
    items.push({
      key: 'outdoor',
      label: 'outdoor',
      title: String(tags.outdoor_seating),
    })
  }

  return items
}
