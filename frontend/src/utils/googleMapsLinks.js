import { getGoogleMapLocale } from './googleMapsLocale'

/**
 * Open Google Maps directions to a venue.
 * Origin is omitted so Maps uses the device / Google account current location —
 * never the in-app search address (that is only for list distance sorting).
 */
export function getGoogleDirectionsUrl(place, appLanguage = 'en') {
  const { language } = getGoogleMapLocale(appLanguage)
  const coords = `${place.lat},${place.lng}`
  const destination = place.name ? `${place.name}@${coords}` : coords
  const params = new URLSearchParams({
    api: '1',
    destination,
    hl: language,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
