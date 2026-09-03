import { describe, it, expect } from 'vitest'
import { latLngBoundsToPlain, MANHATTAN_CENTER, MANHATTAN_BOUNDS } from '../utils/mapBounds'

function fakeLatLngBounds({ north, south, east, west }) {
  return {
    getNorthEast: () => ({ lat: () => north, lng: () => east }),
    getSouthWest: () => ({ lat: () => south, lng: () => west }),
  }
}

describe('latLngBoundsToPlain', () => {
  it('converts a google.maps.LatLngBounds-shaped object into a plain bounds object', () => {
    const bounds = fakeLatLngBounds({ north: 40.9, south: 40.7, east: -73.9, west: -74.0 })
    expect(latLngBoundsToPlain(bounds)).toEqual({
      north: 40.9,
      south: 40.7,
      east: -73.9,
      west: -74.0,
    })
  })
})

describe('MANHATTAN_BOUNDS / MANHATTAN_CENTER consistency', () => {
  it('MANHATTAN_CENTER actually falls within MANHATTAN_BOUNDS', () => {
    // Check that thesetwo constants are maintained independently
    // in the source, so nothing enforces they stay consistent with each other
    // except this test. If someone updates one without the other, this catches it.
    expect(MANHATTAN_CENTER.lat).toBeGreaterThanOrEqual(MANHATTAN_BOUNDS.south)
    expect(MANHATTAN_CENTER.lat).toBeLessThanOrEqual(MANHATTAN_BOUNDS.north)
    expect(MANHATTAN_CENTER.lng).toBeGreaterThanOrEqual(MANHATTAN_BOUNDS.west)
    expect(MANHATTAN_CENTER.lng).toBeLessThanOrEqual(MANHATTAN_BOUNDS.east)
  })

  it('MANHATTAN_BOUNDS has north > south and east > west (not accidentally swapped)', () => {
    expect(MANHATTAN_BOUNDS.north).toBeGreaterThan(MANHATTAN_BOUNDS.south)
    expect(MANHATTAN_BOUNDS.east).toBeGreaterThan(MANHATTAN_BOUNDS.west)
  })
})