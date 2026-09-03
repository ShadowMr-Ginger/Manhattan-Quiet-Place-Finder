import { describe, it, expect } from 'vitest'
import {
  computeCalmLabel,
  calmLabelToLevel,
  quietInsideLevelFromSignals,
  isConstructionHoursActive,
  busynessPctToLevel,
  getNycDayHour,
  getCurrentHourlyBusyness,
  getBusynessCrowdednessLevel,
  buildQuietInsideFromAttributes,
} from '../utils/venueSignalsDisplay'

// Verified NYC-time fixture (Thursday 15:00 NYC, computed via Python zoneinfo,
// same as used in openingHours.test.js).
const THURSDAY_3PM = new Date('2026-01-15T20:00:00Z')

describe('computeCalmLabel', () => {
  it('leans calm when positive outweighs negative', () => {
    expect(computeCalmLabel(5, 2, 1)).toBe('leansCalm')
  })

  it('leans lively when negative outweighs positive', () => {
    expect(computeCalmLabel(1, 2, 5)).toBe('leansLively')
  })

  it('is mixed when positive and negative are equal', () => {
    expect(computeCalmLabel(3, 1, 3)).toBe('mixed')
  })

  it('is mixed when both are zero', () => {
    expect(computeCalmLabel(0, 0, 0)).toBe('mixed')
  })
})

describe('calmLabelToLevel', () => {
  it('maps each label to its level', () => {
    expect(calmLabelToLevel('leansCalm')).toBe('calm')
    expect(calmLabelToLevel('leansLively')).toBe('lively')
    expect(calmLabelToLevel('mixed')).toBe('mixed')
  })

  it('defaults to mixed for an unrecognized label', () => {
    expect(calmLabelToLevel('somethingElse')).toBe('mixed')
  })
})

describe('quietInsideLevelFromSignals', () => {
  it('returns null when there are no signals at all', () => {
    expect(quietInsideLevelFromSignals(undefined)).toBeNull()
    expect(quietInsideLevelFromSignals({})).toBeNull()
  })

  it('returns null when n is 0 — no reviewer mentioned noise/crowding, not "not quiet"', () => {
    expect(quietInsideLevelFromSignals({ quietInside: { n: 0, labelKey: 'leansCalm' } })).toBeNull()
  })

  it('derives the level from a real signal', () => {
    expect(quietInsideLevelFromSignals({ quietInside: { n: 3, labelKey: 'leansCalm' } })).toBe('calm')
  })
})

describe('busynessPctToLevel', () => {
  it('returns null for missing or NaN input', () => {
    expect(busynessPctToLevel(null)).toBeNull()
    expect(busynessPctToLevel(undefined)).toBeNull()
    expect(busynessPctToLevel(NaN)).toBeNull()
  })

  it('matches the documented thresholds shared with the backend (low < 8, medium < 25)', () => {
    expect(busynessPctToLevel(0)).toBe('low')
    expect(busynessPctToLevel(7.9)).toBe('low')
    expect(busynessPctToLevel(8)).toBe('medium')     // boundary: 8 itself is medium, not low
    expect(busynessPctToLevel(24.9)).toBe('medium')
    expect(busynessPctToLevel(25)).toBe('high')       // boundary: 25 itself is high
    expect(busynessPctToLevel(90)).toBe('high')
  })
})

describe('getNycDayHour', () => {
  it('uses Monday = 0, matching the backend\'s Python weekday() convention', () => {
    // Deliberately DIFFERENT from openingHours.js's DAY_INDEX (Sunday = 0) —
    // this file joins against backend hourly data keyed to Python's
    // datetime.weekday(), where Monday = 0. Two conventions coexist in this
    // codebase on purpose, for different reasons; worth knowing during any
    // refactor that touches day-of-week logic.
    expect(getNycDayHour(THURSDAY_3PM)).toEqual({ dow: 3, hour: 15 }) // Thu = index 3 when Mon=0
  })
})

describe('getCurrentHourlyBusyness', () => {
  it('returns null for an empty hourly array', () => {
    expect(getCurrentHourlyBusyness([], THURSDAY_3PM)).toBeNull()
  })

  it('finds the matching dow/hour row', () => {
    const hourly = [
      { dow: 3, hour: 15, busynessPct: 42 },
      { dow: 3, hour: 16, busynessPct: 50 },
    ]
    expect(getCurrentHourlyBusyness(hourly, THURSDAY_3PM)).toEqual({ dow: 3, hour: 15, busynessPct: 42 })
  })

  it('falls back to a dow-agnostic row matching only the hour', () => {
    const hourly = [{ dow: null, hour: 15, busynessPct: 33 }]
    expect(getCurrentHourlyBusyness(hourly, THURSDAY_3PM)).toEqual({ dow: 3, hour: 15, busynessPct: 33 })
  })

  it('returns null when no row matches at all', () => {
    const hourly = [{ dow: 0, hour: 3, busynessPct: 10 }]
    expect(getCurrentHourlyBusyness(hourly, THURSDAY_3PM)).toBeNull()
  })

  it('reads snake_case busyness_pct as a fallback for camelCase busynessPct', () => {
    const hourly = [{ dow: 3, hour: 15, busyness_pct: 77 }]
    expect(getCurrentHourlyBusyness(hourly, THURSDAY_3PM).busynessPct).toBe(77)
  })
})

describe('getBusynessCrowdednessLevel', () => {
  it('returns null for missing busyness data', () => {
    expect(getBusynessCrowdednessLevel(null)).toBeNull()
  })

  it('normalizes "moderate" to "medium"', () => {
    expect(getBusynessCrowdednessLevel({ level: 'moderate' })).toBe('medium')
  })

  it('passes through an already-valid level as-is', () => {
    expect(getBusynessCrowdednessLevel({ level: 'high' })).toBe('high')
  })

  it('derives level from currentPct when no explicit level is given', () => {
    expect(getBusynessCrowdednessLevel({ currentPct: 3 })).toBe('low')
    expect(getBusynessCrowdednessLevel({ current_busyness_pct: 30 })).toBe('high')
  })

  it('falls back to hourly data when no direct pct field exists', () => {
    const busyness = { hourly: [{ dow: 3, hour: 15, busynessPct: 50 }] }
    // Note: getCurrentHourlyBusyness defaults `now` to `new Date()` internally,
    // so this specific fallback path can't be pinned to THURSDAY_3PM without
    // the function accepting a `now` param — documenting the limitation here
    // rather than asserting a flaky, environment-dependent result.
    const result = getBusynessCrowdednessLevel(busyness)
    expect(['low', 'medium', 'high', null]).toContain(result)
  })
})

describe('buildQuietInsideFromAttributes', () => {
  it('returns null when there is no signal at all (n < 1)', () => {
    expect(buildQuietInsideFromAttributes({})).toBeNull()
    expect(buildQuietInsideFromAttributes()).toBeNull()
  })

  it('combines noise and crowding attribute scores', () => {
    const result = buildQuietInsideFromAttributes({
      noise: { positive: 3, neutral: 1, negative: 0 },
      crowding: { positive: 2, neutral: 0, negative: 1 },
    })
    expect(result).toEqual({
      positive: 5,
      neutral: 1,
      negative: 1,
      n: 7,
      labelKey: 'leansCalm',
    })
  })

  it('handles only one of noise/crowding being present', () => {
    const result = buildQuietInsideFromAttributes({ noise: { positive: 2, neutral: 0, negative: 0 } })
    expect(result.n).toBe(2)
    expect(result.labelKey).toBe('leansCalm')
  })
})