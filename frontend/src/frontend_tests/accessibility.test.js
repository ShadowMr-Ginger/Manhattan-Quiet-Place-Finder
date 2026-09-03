import { describe, it, expect, vi } from 'vitest'

vi.mock('../data/wheelchairAccess', () => ({
  WHEELCHAIR_ACCESS: {
    'venue-with-fallback-yes': 'yes',
    'venue-with-fallback-no': 'no',
  },
}))

import { resolveWheelchairAccess, isWheelchairAccessible } from '../utils/accessibility'

describe('resolveWheelchairAccess', () => {
  it('prefers accessibilityManual over everything else', () => {
    const place = {
      id: 'venue-with-fallback-no', 
      accessibilityManual: { wheelchair: 'yes' },
      wheelchairAccess: 'no', 
    }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'yes', source: 'manual' })
  })

  it('falls back to the OSM tag when there is no manual override', () => {
    const place = { id: 'x', wheelchairAccess: 'limited' }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'limited', source: 'osm' })
  })

  it('reads the OSM tag from the raw osm blob on detail payloads', () => {
    const place = { id: 'x', osm: { tags: { wheelchair: 'no' } } }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'no', source: 'osm' })
  })

  it('falls back to the snapshot data when nothing else is present', () => {
    const place = { id: 'venue-with-fallback-yes' }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'yes', source: 'osm' })
  })

  it('returns null for a completely unsurveyed venue — never assumes "no"', () => {
    const place = { id: 'never-surveyed-venue' }
    expect(resolveWheelchairAccess(place)).toBeNull()
  })

  it('ignores an invalid/garbage value on the manual override and falls through', () => {
    const place = {
      id: 'venue-with-fallback-yes',
      accessibilityManual: { wheelchair: 'sort-of' }, // not in the valid set
    }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'yes', source: 'osm' })
  })

  it('ignores an invalid OSM tag value and falls through to the snapshot', () => {
    const place = {
      id: 'venue-with-fallback-yes',
      wheelchairAccess: 'unknown', // not a valid value
    }
    expect(resolveWheelchairAccess(place)).toEqual({ value: 'yes', source: 'osm' })
  })

  it('handles a place with no id gracefully (no fallback lookup possible)', () => {
    const place = {}
    expect(resolveWheelchairAccess(place)).toBeNull()
  })
})

describe('isWheelchairAccessible', () => {
  it('is true only for "yes"', () => {
    expect(isWheelchairAccessible({ id: 'x', wheelchairAccess: 'yes' })).toBe(true)
  })

  it('is false for "limited" — this is the important distinction', () => {
    expect(isWheelchairAccessible({ id: 'x', wheelchairAccess: 'limited' })).toBe(false)
  })

  it('is false for "no"', () => {
    expect(isWheelchairAccessible({ id: 'x', wheelchairAccess: 'no' })).toBe(false)
  })

  it('is false for an unsurveyed venue — unknown is excluded, not assumed accessible', () => {
    expect(isWheelchairAccessible({ id: 'never-surveyed' })).toBe(false)
  })
})