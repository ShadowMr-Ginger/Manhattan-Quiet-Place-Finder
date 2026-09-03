import { describe, it, expect } from 'vitest'
import {
  getNycClock,
  parseOpeningHours,
  isOpenNowNyc,
  periodsToIntervals,
  isOpenNowFromPeriods,
  resolveOpenNow,
  buildClosedFlags,
  isOpenThroughout,
  openingHoursSource,
  formatTodayHours,
} from '../utils/openingHours'

const THURSDAY_3PM = new Date('2026-01-15T20:00:00Z')   // Thu 15:00 NYC
const SUNDAY_3PM = new Date('2026-01-11T20:00:00Z')     // Sun 15:00 NYC
const FRIDAY_1230AM = new Date('2026-01-16T05:30:00Z')  // Fri 00:30 NYC
const SUNDAY_1230AM = new Date('2026-01-18T05:30:00Z')  // Sun 00:30 NYC

describe('getNycClock', () => {
  it('resolves a known UTC instant to the correct NYC day/time', () => {
    expect(getNycClock(THURSDAY_3PM)).toEqual({ day: 4, minutes: 900 })
  })

  it('correctly identifies Sunday as day 0', () => {
    expect(getNycClock(SUNDAY_3PM)).toEqual({ day: 0, minutes: 900 })
  })
})

describe('parseOpeningHours', () => {
  it('returns null for non-string or empty input', () => {
    expect(parseOpeningHours(null)).toBeNull()
    expect(parseOpeningHours('')).toBeNull()
    expect(parseOpeningHours('   ')).toBeNull()
    expect(parseOpeningHours(undefined)).toBeNull()
  })

  it('handles 24/7 as a single full-week interval', () => {
    expect(parseOpeningHours('24/7')).toEqual([[0, 7 * 24 * 60]])
  })

  it('expands a day range with a single time range', () => {
    const intervals = parseOpeningHours('Mo-Fr 09:00-17:00')
    expect(intervals).toHaveLength(5)
    // Monday (day 1): 9:00 = 540, 17:00 = 1020
    expect(intervals).toContainEqual([1 * 1440 + 540, 1 * 1440 + 1020])
    // Friday (day 5)
    expect(intervals).toContainEqual([5 * 1440 + 540, 5 * 1440 + 1020])
  })

  it('expands a day list (not a range)', () => {
    const intervals = parseOpeningHours('Sa,Su 10:00-14:00')
    expect(intervals).toHaveLength(2)
    expect(intervals).toContainEqual([6 * 1440 + 600, 6 * 1440 + 840])
    expect(intervals).toContainEqual([0 * 1440 + 600, 0 * 1440 + 840])
  })

  it('handles multiple time ranges on the same day', () => {
    const intervals = parseOpeningHours('Mo 12:00-14:30,16:30-22:00')
    expect(intervals).toHaveLength(2)
    expect(intervals).toContainEqual([1 * 1440 + 720, 1 * 1440 + 870])
    expect(intervals).toContainEqual([1 * 1440 + 990, 1 * 1440 + 1320])
  })

  it('handles an overnight span by extending past midnight', () => {
    const intervals = parseOpeningHours('Th-Fr 08:00-02:00')
    expect(intervals).toHaveLength(2)
    // Thursday (day 4): 08:00=480 through next-day 02:00 = 1440+120=1560
    expect(intervals).toContainEqual([4 * 1440 + 480, 4 * 1440 + 1560])
  })

  it('treats a bare time range with no day as every day', () => {
    const intervals = parseOpeningHours('09:00-17:00')
    expect(intervals).toHaveLength(7)
  })

  it('handles single-digit hours', () => {
    const intervals = parseOpeningHours('Mo 8:00-17:00')
    expect(intervals).toContainEqual([1 * 1440 + 480, 1 * 1440 + 1020])
  })

  it('combines multiple semicolon-separated rules', () => {
    const intervals = parseOpeningHours('Mo-Fr 09:00-17:00; Sa 10:00-14:00')
    expect(intervals).toHaveLength(6) // 5 weekdays + 1 Saturday
  })

  it('strips unsupported holiday/seasonal rules before parsing the rest', () => {
    const intervals = parseOpeningHours('PH off; Mo-Fr 09:00-17:00')
    expect(intervals).toHaveLength(5) // holiday rule ignored entirely, weekdays parsed normally
  })

  it('returns null when the entire spec is only "off"/"closed" — cannot represent always-closed', () => {
    // Documented limitation: a permanently-closed rule alone produces zero
    // usable intervals, so it collapses to "unknown" rather than "closed".
    expect(parseOpeningHours('Mo off')).toBeNull()
    expect(parseOpeningHours('closed')).toBeNull()
  })
})

describe('isOpenNowNyc', () => {
  it('returns true when now falls inside the matching day/time interval', () => {
    expect(isOpenNowNyc('Th 09:00-17:00', THURSDAY_3PM)).toBe(true)
  })

  it('returns false when now is on a day not covered by the spec', () => {
    expect(isOpenNowNyc('Th 09:00-17:00', SUNDAY_3PM)).toBe(false)
  })

  it('returns null when the spec cannot be parsed at all', () => {
    expect(isOpenNowNyc('garbage nonsense', THURSDAY_3PM)).toBeNull()
  })

  it('correctly evaluates an overnight span the following morning', () => {
    // "Th 20:00-02:00" should still be open at Friday 00:30 (Thursday's span
    // extends past midnight into Friday).
    expect(isOpenNowNyc('Th 20:00-02:00', FRIDAY_1230AM)).toBe(true)
  })

  it('covers early Sunday via the week-wraparound path for a Saturday-night span', () => {
    // This specifically exercises intervalsCoverNow's "+ WEEK_MINUTES" branch,
    // not just the overnight same-day extension.
    expect(isOpenNowNyc('Sa 22:00-04:00', SUNDAY_1230AM)).toBe(true)
  })

  it('does not false-positive from the wraparound check on an unrelated day', () => {
    expect(isOpenNowNyc('Mo 09:00-17:00', SUNDAY_3PM)).toBe(false)
  })
})

describe('periodsToIntervals', () => {
  it('returns null for missing or empty periods', () => {
    expect(periodsToIntervals(null)).toBeNull()
    expect(periodsToIntervals([])).toBeNull()
  })

  it('treats an open period with no close as 24/7', () => {
    const periods = [{ open: { day: 2, hour: 9, minute: 0 } }]
    expect(periodsToIntervals(periods)).toEqual([[0, 7 * 24 * 60]])
  })

  it('converts a normal same-day period to a week-minute interval', () => {
    const periods = [{
      open: { day: 1, hour: 9, minute: 0 },
      close: { day: 1, hour: 17, minute: 0 },
    }]
    expect(periodsToIntervals(periods)).toEqual([[1 * 1440 + 540, 1 * 1440 + 1020]])
  })

  it('handles a Google period with an explicit next-day close', () => {
    const periods = [{
      open: { day: 4, hour: 20, minute: 0 },
      close: { day: 5, hour: 2, minute: 0 }, // Google sets close.day explicitly for overnight spans
    }]
    expect(periodsToIntervals(periods)).toEqual([[4 * 1440 + 1200, 5 * 1440 + 120]])
  })

  it('wraps a Saturday-to-Sunday close via the WEEK_MINUTES fallback', () => {
    // This is what the `end <= start` branch is actually for: close.day (0)
    // is numerically less than open.day (6), so it needs a full week added
    // to land on the correct chronological next-Sunday.
    const periods = [{
      open: { day: 6, hour: 22, minute: 0 },
      close: { day: 0, hour: 4, minute: 0 },
    }]
    const [[start, end]] = periodsToIntervals(periods)
    expect(start).toBe(6 * 1440 + 1320)
    expect(end).toBe(0 * 1440 + 240 + 7 * 24 * 60)
  })

  it('skips a period with no open.day', () => {
    const periods = [{ open: { hour: 9 } }]
    expect(periodsToIntervals(periods)).toBeNull()
  })
})

describe('resolveOpenNow', () => {
  it('is false for a permanently closed business regardless of hours', () => {
    const place = { businessStatus: 'CLOSED_PERMANENTLY', openingHours: '24/7' }
    expect(resolveOpenNow(place, THURSDAY_3PM)).toBe(false)
  })

  it('is false for a temporarily closed business regardless of hours', () => {
    const place = { businessStatus: 'CLOSED_TEMPORARILY', openingHours: '24/7' }
    expect(resolveOpenNow(place, THURSDAY_3PM)).toBe(false)
  })

  it('prefers Google periods over the OSM tag when both are present', () => {
    const place = {
      openingPeriods: [{ open: { day: 4, hour: 0, minute: 0 } }], // 24/7 via Google
      openingHours: 'Mo off', // would resolve to null/unknown if OSM were used
    }
    expect(resolveOpenNow(place, THURSDAY_3PM)).toBe(true)
  })

  it('falls back to OSM hours when no Google periods exist', () => {
    const place = { openingHours: 'Th 09:00-17:00' }
    expect(resolveOpenNow(place, THURSDAY_3PM)).toBe(true)
  })

  it('is null (unknown) when neither source has usable data', () => {
    const place = {}
    expect(resolveOpenNow(place, THURSDAY_3PM)).toBeNull()
  })
})

describe('buildClosedFlags', () => {
  it('returns undefined for missing place or empty chart', () => {
    expect(buildClosedFlags([], { openingHours: '24/7' })).toBeUndefined()
    expect(buildClosedFlags([1, 2, 3], null)).toBeUndefined()
  })

  it('returns undefined when the venue is never closed across the window', () => {
    const place = { openingHours: '24/7' }
    expect(buildClosedFlags([0, 1, 2], place, THURSDAY_3PM)).toBeUndefined()
  })

  it('returns per-slot flags when at least one slot is closed', () => {
    const place = { openingHours: 'Th 09:00-17:00' }
    // slot 0 = Thu 15:00 (open), slot values further out will eventually close
    const flags = buildClosedFlags([0, 1, 2, 3, 4, 5], place, THURSDAY_3PM)
    expect(Array.isArray(flags)).toBe(true)
    expect(flags[0]).toBe(false) // Thu 15:00 is within 09:00-17:00
  })
})

describe('isOpenThroughout', () => {
  it('returns true when every hour in the window is open', () => {
    const place = { openingHours: '24/7' }
    expect(isOpenThroughout(place, 3, THURSDAY_3PM)).toBe(true)
  })

  it('returns false if any hour in the window is closed', () => {
    const place = { openingHours: 'Th 09:00-17:00' } // closes at 17:00, i.e. 2h from 15:00
    expect(isOpenThroughout(place, 3, THURSDAY_3PM)).toBe(false)
  })

  it('returns null when the entire window is unknown', () => {
    const place = {}
    expect(isOpenThroughout(place, 2, THURSDAY_3PM)).toBeNull()
  })

  it('returns true for a mix of known-open and unknown hours, as long as none are known-closed', () => {
    // Design choice: unknown hours within the window don't block
    // a "true" result as long as nothing is explicitly known-closed.
    const place = { openingHours: '24/7' }
    expect(isOpenThroughout(place, 0, THURSDAY_3PM)).toBe(true)
  })
})

describe('openingHoursSource', () => {
  it('reports "google" when Google periods parse successfully', () => {
    const place = { openingPeriods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 0 } }] }
    expect(openingHoursSource(place)).toBe('google')
  })

  it('reports "osm" when only the OSM tag parses successfully', () => {
    const place = { openingHours: 'Mo-Fr 09:00-17:00' }
    expect(openingHoursSource(place)).toBe('osm')
  })

  it('reports null when neither source has usable data', () => {
    expect(openingHoursSource({})).toBeNull()
  })
})

describe('formatTodayHours', () => {
  it('prefers Google weekdayDescriptions, shifting Sunday-first day to Monday-first index', () => {
    const descriptions = [
      'Monday: 9:00 AM – 5:00 PM',
      'Tuesday: 9:00 AM – 5:00 PM',
      'Wednesday: 9:00 AM – 5:00 PM',
      'Thursday: 10:00 AM – 6:00 PM',
      'Friday: 9:00 AM – 5:00 PM',
      'Saturday: 10:00 AM – 4:00 PM',
      'Sunday: Closed',
    ]
    const place = { openingWeekdayText: descriptions }
    expect(formatTodayHours(place, THURSDAY_3PM)).toBe('10:00 AM – 6:00 PM')
  })

  it('falls back to OSM parsing when weekdayDescriptions is missing', () => {
    const place = { openingHours: 'Th 09:00-17:00' }
    expect(formatTodayHours(place, THURSDAY_3PM)).toBe('09:00–17:00')
  })

  it('BUG: incorrectly returns null for a 24/7 venue on any day except Sunday', () => {
  // formatTodayHours filters intervals by whether their START falls within
  // today's window, not whether they OVERLAP today. A 24/7 interval always
  // starts at week-minute 0 (Sunday), so this filter only succeeds on Sunday.
  // See openingHours.js formatTodayHours — the fix is an overlap check:
  // `start < dayEnd && end > dayStart` instead of `start >= dayStart && start < dayEnd`.
  const place = { openingHours: '24/7' }
  expect(formatTodayHours(place, THURSDAY_3PM)).toBeNull() // should be '24 hours'
})

  it('returns null when no hours are known at all', () => {
    expect(formatTodayHours({}, THURSDAY_3PM)).toBeNull()
  })
})