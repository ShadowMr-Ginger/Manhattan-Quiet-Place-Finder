import { describe, it, expect } from 'vitest'
import { getGoogleDirectionsUrl } from '../utils/googleMapsLinks'

describe('getGoogleDirectionsUrl', () => {
  it('builds a directions URL with coords and destination name', () => {
    const place = { name: 'Quiet Bean', lat: 40.758, lng: -73.985 }
    const url = getGoogleDirectionsUrl(place)
    expect(url).toContain('https://www.google.com/maps/dir/?')
    expect(url).toContain('destination=Quiet+Bean%4040.758%2C-73.985')
  })

  it('falls back to bare coordinates when the place has no name', () => {
    const place = { lat: 40.758, lng: -73.985 }
    const url = getGoogleDirectionsUrl(place)
    expect(url).toContain('destination=40.758%2C-73.985')
  })

  it('never includes an origin param — deliberately lets Maps use device location', () => {
    // Per the source comment: origin is intentionally omitted so Google Maps
    // uses the device/account's real current location, not the in-app search
    // address. A future "helpful" addition of an origin param would be wrong.
    const place = { name: 'Quiet Bean', lat: 40.758, lng: -73.985 }
    const url = getGoogleDirectionsUrl(place)
    expect(url).not.toContain('origin=')
  })

  it('maps the app language to the correct Google Maps locale', () => {
    const place = { lat: 40.758, lng: -73.985 }
    expect(getGoogleDirectionsUrl(place, 'zh')).toContain('hl=zh-CN')
    expect(getGoogleDirectionsUrl(place, 'es')).toContain('hl=es')
  })

  it('defaults to English for an unsupported language code', () => {
    const place = { lat: 40.758, lng: -73.985 }
    expect(getGoogleDirectionsUrl(place, 'fr')).toContain('hl=en')
  })

  it('defaults to English when no language argument is given at all', () => {
    const place = { lat: 40.758, lng: -73.985 }
    expect(getGoogleDirectionsUrl(place)).toContain('hl=en')
  })

  it('always sets api=1, per the Google Maps URL scheme requirement', () => {
    const place = { lat: 40.758, lng: -73.985 }
    expect(getGoogleDirectionsUrl(place)).toContain('api=1')
  })
})