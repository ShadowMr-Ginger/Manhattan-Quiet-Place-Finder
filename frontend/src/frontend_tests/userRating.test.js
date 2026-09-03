import { describe, it, expect } from 'vitest'
import {
  applyUserRatingFields,
  hasGoogleRating,
  mergeUserRatingIntoPlace,
  mergeGoogleRatingIntoPlace,
} from '../utils/userRating'

describe('applyUserRatingFields', () => {
  it('defaults everything when called with no summary', () => {
    expect(applyUserRatingFields()).toEqual({
      userRating: null,
      userReviewCount: 0,
      rating: 0,
    })
  })

  it('passes through a real user rating as the display rating', () => {
    const result = applyUserRatingFields({ userRating: 4.2, userReviewCount: 10 })
    expect(result.rating).toBe(4.2)
    expect(result.userReviewCount).toBe(10)
  })
})

describe('hasGoogleRating', () => {
  it('is true for a positive rating', () => {
    expect(hasGoogleRating({ googleRating: 4.5 })).toBe(true)
  })

  it('is false when the rating is exactly 0', () => {
    // Deliberate boundary: a venue with a Google rating of 0 is treated as
    // "no meaningful rating", same as if it were missing entirely.
    expect(hasGoogleRating({ googleRating: 0 })).toBe(false)
  })

  it('is false when googleRating is missing', () => {
    expect(hasGoogleRating({})).toBe(false)
  })

  it('is false for a null or undefined place', () => {
    expect(hasGoogleRating(null)).toBe(false)
    expect(hasGoogleRating(undefined)).toBe(false)
  })

  it('coerces a string rating (e.g. from raw API JSON) correctly', () => {
    expect(hasGoogleRating({ googleRating: '4.5' })).toBe(true)
    expect(hasGoogleRating({ googleRating: '0' })).toBe(false)
  })
})

describe('mergeUserRatingIntoPlace', () => {
  it('returns null/undefined place unchanged rather than throwing', () => {
    expect(mergeUserRatingIntoPlace(null)).toBeNull()
  })

  it('merges rating data while preserving existing place fields', () => {
    const place = { id: 'venue-1', name: 'Quiet Bean' }
    const result = mergeUserRatingIntoPlace(place, { averageRating: 4.1, count: 7 })
    expect(result).toEqual({
      id: 'venue-1',
      name: 'Quiet Bean',
      userRating: 4.1,
      userReviewCount: 7,
      rating: 4.1,
    })
  })

  it('defaults sensibly when called with no rating data at all', () => {
    const place = { id: 'venue-1' }
    const result = mergeUserRatingIntoPlace(place)
    expect(result.userRating).toBeNull()
    expect(result.userReviewCount).toBe(0)
    expect(result.rating).toBe(0)
  })
})

describe('mergeGoogleRatingIntoPlace', () => {
  it('returns the place unchanged if rating is missing', () => {
    const place = { id: 'venue-1' }
    expect(mergeGoogleRatingIntoPlace(place, {})).toBe(place)
  })

  it('returns null/undefined place unchanged rather than throwing', () => {
    expect(mergeGoogleRatingIntoPlace(null, { rating: 4.5 })).toBeNull()
  })

  it('merges even a rating of exactly 0 — unlike hasGoogleRating, 0 is valid data here', () => {
    // Important distinction from hasGoogleRating: this function's guard is
    // `rating == null`, not `rating > 0` — a real Google rating of 0 should
    // still be recorded, just not treated as "has a meaningful rating" for
    // display purposes elsewhere.
    const place = { id: 'venue-1' }
    const result = mergeGoogleRatingIntoPlace(place, { rating: 0, userRatingCount: 3 })
    expect(result.googleRating).toBe(0)
    expect(result.googleRatingCount).toBe(3)
  })

  it('defaults userRatingCount to 0 when omitted', () => {
    const place = { id: 'venue-1' }
    const result = mergeGoogleRatingIntoPlace(place, { rating: 4.0 })
    expect(result.googleRatingCount).toBe(0)
  })
})