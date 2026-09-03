/* global google */
import { MANHATTAN_BOUNDS } from './mapBounds'

function manhattanBounds() {
  return new google.maps.LatLngBounds(
    { lat: MANHATTAN_BOUNDS.south, lng: MANHATTAN_BOUNDS.west },
    { lat: MANHATTAN_BOUNDS.north, lng: MANHATTAN_BOUNDS.east },
  )
}

function findPlaceFromQuery(query) {
  return new Promise((resolve) => {
    if (typeof google === 'undefined' || !google.maps?.places?.PlacesService) {
      resolve(null)
      return
    }
    const service = new google.maps.places.PlacesService(document.createElement('div'))
    service.findPlaceFromQuery(
      {
        query,
        fields: ['geometry', 'formatted_address', 'name'],
        locationBias: manhattanBounds(),
      },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null)
          return
        }
        const place = results[0]
        const location = place.geometry.location
        resolve({
          lat: location.lat(),
          lng: location.lng(),
          label: place.formatted_address || place.name || query,
        })
      },
    )
  })
}

function geocodeAddress(address) {
  return new Promise((resolve) => {
    if (typeof google === 'undefined' || !google.maps?.Geocoder) {
      resolve(null)
      return
    }
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode(
      {
        address,
        bounds: manhattanBounds(),
        componentRestrictions: { country: 'us' },
      },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          resolve(null)
          return
        }
        const location = results[0].geometry.location
        resolve({
          lat: location.lat(),
          lng: location.lng(),
          label: results[0].formatted_address || address,
        })
      },
    )
  })
}

/** Resolve free-text to a map origin (Places first, Geocoder fallback), biased to Manhattan. */
export async function geocodeSearchToOrigin(address) {
  const trimmed = address?.trim()
  if (!trimmed) return null

  const fromPlaces = await findPlaceFromQuery(trimmed)
  if (fromPlaces) return fromPlaces

  return geocodeAddress(trimmed)
}
