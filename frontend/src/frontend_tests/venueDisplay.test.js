import { describe, it, expect } from 'vitest'
import { getFilledStarCount, getOsmAmenities } from '../utils/venueDisplay'

describe('getFilledStarCount', () => {
  it('defaults to 0 when no rating is given', () => {
    expect(getFilledStarCount()).toBe(0)
  })

  it('rounds to the nearest whole star', () => {
    expect(getFilledStarCount(3.4)).toBe(3)
    expect(getFilledStarCount(3.5)).toBe(4)
  })

  it('clamps at 5 even if the rating exceeds it', () => {
    expect(getFilledStarCount(5.9)).toBe(5)
    expect(getFilledStarCount(100)).toBe(5)
  })

  it('clamps at 0 for negative ratings', () => {
    expect(getFilledStarCount(-2)).toBe(0)
  })
})

describe('getOsmAmenities', () => {
  it('returns an empty array when no osm tags and no hours exist', () => {
    expect(getOsmAmenities({})).toEqual([])
  })

  it('never includes a wheelchair chip, even if wheelchair tags are present', () => {
    // Deliberate per the source comment — wheelchair status lives in its own
    // dedicated row (see accessibility.js) because a chip would flatten
    // "limited"/"no" into invisible-if-absent, same failure mode discussed there.
    const place = { osm: { tags: { wheelchair: 'yes' } } }
    const items = getOsmAmenities(place)
    expect(items.some((i) => i.key === 'wheelchair')).toBe(false)
  })

  it('adds a wifi chip when internet_access is set', () => {
    const place = { osm: { tags: { internet_access: 'wlan' } } }
    const items = getOsmAmenities(place)
    expect(items).toContainEqual({ key: 'wifi', label: 'Wi-Fi', title: 'wlan' })
  })

  it('adds a toilets chip when toilets is "yes"', () => {
    const place = { osm: { tags: { toilets: 'yes' } } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'toilets')).toBeTruthy()
  })

  it('adds a toilets chip based on toilets:wheelchair even without toilets=yes', () => {
    const place = { osm: { tags: { 'toilets:wheelchair': 'yes' } } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'toilets')).toBeTruthy()
  })

  it('adds an outdoor chip when outdoor_seating is set', () => {
    const place = { osm: { tags: { outdoor_seating: 'yes' } } }
    const items = getOsmAmenities(place)
    expect(items).toContainEqual({ key: 'outdoor', label: 'outdoor', title: 'yes' })
  })

  it('prefers the osm opening_hours tag over place.hours', () => {
    const place = {
      hours: '9am-5pm',
      osm: { tags: { opening_hours: '09:00-17:00' } },
    }
    const items = getOsmAmenities(place)
    const hoursChip = items.find((i) => i.key === 'hours')
    expect(hoursChip.title).toBe('09:00-17:00')
  })

  it('falls back to place.hours when no osm opening_hours tag exists', () => {
    const place = { hours: '09:00-17:00', osm: { tags: {} } }
    const items = getOsmAmenities(place)
    const hoursChip = items.find((i) => i.key === 'hours')
    expect(hoursChip.title).toBe('09:00-17:00')
  })

  it('omits the hours chip when place.hours is "Hours unavailable"', () => {
    const place = { hours: 'Hours unavailable', osm: { tags: {} } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'hours')).toBeUndefined()
  })

  it('shortens a clean HH:MM-HH:MM range to an en-dash format', () => {
    const place = { osm: { tags: { opening_hours: '09:00-17:00' } } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'hours').label).toBe('09:00–17:00')
  })

  it('truncates a long, unparseable hours string with an ellipsis', () => {
    const place = { osm: { tags: { opening_hours: 'By appointment only, please call ahead' } } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'hours').label).toBe('By appointment…')
  })

  it('leaves a short, unparseable hours string unchanged', () => {
    const place = { osm: { tags: { opening_hours: 'Call for hours' } } }
    const items = getOsmAmenities(place)
    expect(items.find((i) => i.key === 'hours').label).toBe('Call for hours')
  })

  it('returns all applicable chips together, in source order', () => {
    const place = {
      osm: {
        tags: {
          internet_access: 'wlan',
          toilets: 'yes',
          opening_hours: '09:00-17:00',
          outdoor_seating: 'yes',
        },
      },
    }
    const items = getOsmAmenities(place)
    expect(items.map((i) => i.key)).toEqual(['wifi', 'toilets', 'hours', 'outdoor'])
  })
})