/** Grid cell size in degrees; null = show every marker individually */
export function getClusterCellSize(zoom) {
  if (zoom >= 16) return null
  if (zoom >= 15) return 0.0035
  if (zoom >= 14) return 0.006
  if (zoom >= 13) return 0.011
  return 0.02
}

export function filterPlacesInViewport(places, bounds, padding = 0.012) {
  if (!bounds) return places

  return places.filter(
    (place) =>
      place.lat <= bounds.north + padding &&
      place.lat >= bounds.south - padding &&
      place.lng <= bounds.east + padding &&
      place.lng >= bounds.west - padding,
  )
}

/**
 * @returns {Array<
 *   | { type: 'point', id: string, place: object }
 *   | { type: 'cluster', id: string, count: number, lat: number, lng: number, places: object[] }
 * >}
 */
export function buildMapMarkers(places, zoom, selectedId = null) {
  const cellSize = getClusterCellSize(zoom)
  const selected = selectedId ? places.find((place) => place.id === selectedId) : null
  const pool = selected
    ? places.filter((place) => place.id !== selectedId)
    : places

  if (!cellSize) {
    const points = pool.map((place) => ({ type: 'point', id: place.id, place }))
    if (selected) points.push({ type: 'point', id: selected.id, place: selected })
    return points
  }

  const grid = new Map()

  for (const place of pool) {
    const key = `${Math.floor(place.lat / cellSize)}:${Math.floor(place.lng / cellSize)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(place)
  }

  const markers = []

  for (const [key, group] of grid) {
    if (group.length === 1) {
      markers.push({ type: 'point', id: group[0].id, place: group[0] })
      continue
    }

    const lat = group.reduce((sum, place) => sum + place.lat, 0) / group.length
    const lng = group.reduce((sum, place) => sum + place.lng, 0) / group.length
    markers.push({
      type: 'cluster',
      id: `cluster-${key}`,
      count: group.length,
      lat,
      lng,
      places: group,
    })
  }

  if (selected) {
    markers.push({ type: 'point', id: selected.id, place: selected })
  }

  return markers
}
