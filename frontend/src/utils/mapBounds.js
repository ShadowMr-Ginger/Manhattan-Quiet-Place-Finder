/** @typedef {{ north: number, south: number, east: number, west: number }} MapBounds */

export const MANHATTAN_CENTER = { lat: 40.758, lng: -73.985 }
export const DEFAULT_ZOOM = 13

export const MANHATTAN_BOUNDS = {
  north: 40.882,
  south: 40.704,
  east: -73.907,
  west: -74.02,
}

/** @param {google.maps.LatLngBounds} latLngBounds */
export function latLngBoundsToPlain(latLngBounds) {
  const ne = latLngBounds.getNorthEast()
  const sw = latLngBounds.getSouthWest()
  return {
    north: ne.lat(),
    south: sw.lat(),
    east: ne.lng(),
    west: sw.lng(),
  }
}

export const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3a2f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
]

export const LIGHT_MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
]
