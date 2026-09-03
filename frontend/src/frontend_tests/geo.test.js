import { describe, it, expect } from 'vitest'
import { haversineDistanceKm, roundDistanceKm } from '../utils/geo'

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm(40.758, -73.985, 40.758, -73.985)).toBe(0)
  })

  it('matches a known real-world distance (verified independently via Python)', () => {
    const km = haversineDistanceKm(40.758, -73.985, 40.7829, -73.9654)
    expect(km).toBeCloseTo(3.2234, 3)
  })

  it('matches the known ~111.2km-per-degree-longitude at the equator', () => {
    const km = haversineDistanceKm(0, 0, 0, 1)
    expect(km).toBeCloseTo(111.195, 2)
  })

  it('handles antipodal points as roughly half the Earth\'s circumference', () => {
    const km = haversineDistanceKm(0, 0, 0, 180)
    expect(km).toBeCloseTo(20015.09, 1)
  })

  it('is symmetric — distance A to B equals B to A', () => {
    const ab = haversineDistanceKm(40.758, -73.985, 40.7829, -73.9654)
    const ba = haversineDistanceKm(40.7829, -73.9654, 40.758, -73.985)
    expect(ab).toBeCloseTo(ba, 10)
  })
})

describe('roundDistanceKm', () => {
  it('rounds to one decimal place', () => {
    expect(roundDistanceKm(2.34)).toBe(2.3)
    expect(roundDistanceKm(2.36)).toBe(2.4)
  })

  it('handles whole numbers cleanly', () => {
    expect(roundDistanceKm(5)).toBe(5)
    expect(roundDistanceKm(0)).toBe(0)
  })
})