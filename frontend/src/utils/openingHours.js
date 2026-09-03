/**
 * Open/closed evaluation from the OSM `opening_hours` tag, in New York time.
 *
 * Source is our own enriched venue data (osm.tags.opening_hours), deliberately
 * not Google Places — the app should not gain a second dependency on an external
 * vendor for a core filter.
 *
 * Coverage is 163 of 326 venues. Everything here returns `null` for "unknown",
 * which callers MUST treat as distinct from `false`: a venue with no published
 * hours is not a closed venue.
 *
 * Supported: day ranges (Mo-Fr), day lists (Sa, Su), multiple rules separated by
 * `;` or `,`, several ranges per day (12:00-14:30,16:30-22:00), overnight spans
 * (Th-Fr 08:00-02:00), 24/7, bare time ranges with no day (= every day), `off`,
 * single-digit hours (8:00), and missing/extra whitespace.
 *
 * Deliberately ignored: public-holiday and seasonal rules (PH off, easter off,
 * Dec 25 off, Nov Th[4] off, May Mo[-1] -2 days off). Honouring them would need a
 * holiday calendar; ignoring them can only ever show a holiday-closed venue as
 * open, which is the same failure mode as stale data and affects 8 venues.
 */

const DAY_INDEX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 }
const WEEK_MINUTES = 7 * 24 * 60

/** Current New York wall-clock as { day (0=Sun), minutes since midnight }. */
export function getNycClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = (parts.find((p) => p.type === 'weekday')?.value ?? 'Sun')
    .slice(0, 2)
    .toLowerCase()
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)

  return { day: DAY_INDEX[weekday] ?? 0, minutes: (hour % 24) * 60 + minute }
}

/** Drop holiday / seasonal rules we can't evaluate without a calendar. */
function stripUnsupportedRules(spec) {
  return spec
    .split(';')
    .filter((chunk) => !/\b(ph|sh|easter)\b|\[|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(chunk))
    .join(';')
}

const DAY_TOKEN = '(?:mo|tu|we|th|fr|sa|su)'
const DAYS_RE = new RegExp(
  `(${DAY_TOKEN}(?:\\s*-\\s*${DAY_TOKEN})?(?:\\s*,\\s*${DAY_TOKEN}(?:\\s*-\\s*${DAY_TOKEN})?)*)`,
  'i',
)
const RULE_RE = new RegExp(
  `(${DAY_TOKEN}(?:\\s*-\\s*${DAY_TOKEN})?(?:\\s*,\\s*${DAY_TOKEN}(?:\\s*-\\s*${DAY_TOKEN})?)*)?\\s*` +
    `((?:\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2})(?:\\s*,\\s*\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2})*|off|closed)`,
  'gi',
)

function expandDays(daySpec) {
  if (!daySpec) return [0, 1, 2, 3, 4, 5, 6] // no day given = every day
  const days = new Set()

  for (const part of daySpec.split(',')) {
    const [fromRaw, toRaw] = part.split('-').map((s) => s.trim().slice(0, 2).toLowerCase())
    const from = DAY_INDEX[fromRaw]
    if (from == null) continue
    if (toRaw == null) {
      days.add(from)
      continue
    }
    const to = DAY_INDEX[toRaw]
    if (to == null) continue
    // Ranges may wrap the week (e.g. Sa-Su, Fr-Mo).
    for (let i = 0; i < 7; i += 1) {
      const d = (from + i) % 7
      days.add(d)
      if (d === to) break
    }
  }

  return [...days]
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map((n) => Number(n))
  return h * 60 + m
}

/**
 * Parse an OSM opening_hours string into absolute week-minute intervals.
 * @returns {Array<[number, number]>|null} null when nothing could be parsed.
 */
export function parseOpeningHours(spec) {
  if (typeof spec !== 'string' || !spec.trim()) return null
  const cleaned = stripUnsupportedRules(spec)
  if (/24\s*\/\s*7/.test(cleaned)) return [[0, WEEK_MINUTES]]

  const intervals = []
  let matched = false

  RULE_RE.lastIndex = 0
  let match
  while ((match = RULE_RE.exec(cleaned)) !== null) {
    matched = true
    const [, daySpec, timeSpec] = match
    if (/^(off|closed)$/i.test(timeSpec.trim())) continue

    // Guard against a stray token being read as a day list.
    const days = expandDays(daySpec && DAYS_RE.test(daySpec) ? daySpec : null)

    for (const range of timeSpec.split(',')) {
      const [startRaw, endRaw] = range.split('-').map((s) => s.trim())
      if (!startRaw || !endRaw) continue
      const start = toMinutes(startRaw)
      let end = toMinutes(endRaw)
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      if (end <= start) end += 24 * 60 // overnight, e.g. 08:00-02:00

      for (const day of days) {
        intervals.push([day * 24 * 60 + start, day * 24 * 60 + end])
      }
    }
  }

  if (!matched || intervals.length === 0) return null
  return intervals
}

function intervalsCoverNow(intervals, now) {
  const { day, minutes } = getNycClock(now)
  const nowMinute = day * 24 * 60 + minutes

  for (const [start, end] of intervals) {
    if (nowMinute >= start && nowMinute < end) return true
    // Re-test a week later so intervals that ran past Saturday midnight still
    // cover early Sunday.
    if (nowMinute + WEEK_MINUTES >= start && nowMinute + WEEK_MINUTES < end) {
      return true
    }
  }
  return false
}

/**
 * @returns {boolean|null} true = open, false = closed, null = unknown
 */
export function isOpenNowNyc(spec, now = new Date()) {
  const intervals = parseOpeningHours(spec)
  if (!intervals) return null
  return intervalsCoverNow(intervals, now)
}

/**
 * Google Places `regularOpeningHours.periods` -> week-minute intervals.
 * Google uses the same day numbering as us (0 = Sunday).
 */
export function periodsToIntervals(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null

  const intervals = []
  for (const period of periods) {
    const open = period?.open
    if (!open || open.day == null) continue

    // An open with no close means open continuously (24/7).
    if (!period.close) return [[0, WEEK_MINUTES]]

    const start = open.day * 24 * 60 + (open.hour ?? 0) * 60 + (open.minute ?? 0)
    let end =
      (period.close.day ?? open.day) * 24 * 60 +
      (period.close.hour ?? 0) * 60 +
      (period.close.minute ?? 0)
    if (end <= start) end += WEEK_MINUTES

    intervals.push([start, end])
  }

  return intervals.length ? intervals : null
}

/** @returns {boolean|null} */
export function isOpenNowFromPeriods(periods, now = new Date()) {
  const intervals = periodsToIntervals(periods)
  if (!intervals) return null
  return intervalsCoverNow(intervals, now)
}

/**
 * Open state for a place, folding in business status.
 *
 * Google Places periods are preferred over the OSM tag: they are available on
 * every list item without a backend change and cover far more than the 163 of
 * 326 venues that carry an OSM `opening_hours` tag. OSM remains the fallback so
 * the feature still works (at reduced coverage) with no Maps key.
 *
 * @returns {boolean|null} true = open, false = closed, null = unknown
 */
export function resolveOpenNow(place, now = new Date()) {
  if (place?.businessStatus === 'CLOSED_PERMANENTLY') return false
  if (place?.businessStatus === 'CLOSED_TEMPORARILY') return false

  const fromGoogle = isOpenNowFromPeriods(place?.openingPeriods, now)
  if (fromGoogle !== null) return fromGoogle

  return isOpenNowNyc(place?.openingHours, now)
}

/**
 * Per-slot closed flags for the busyness chart.
 *
 * `chart[i]` is i hours ahead of now (buildSlot uses the offset as its index),
 * so each slot can be evaluated against the venue's hours.
 *
 * @returns {boolean[]|undefined} undefined when hours are unknown or the venue
 *   is never closed across the window — either way there is nothing to shade.
 */
export function buildClosedFlags(chart, place, now = new Date()) {
  if (!place || !Array.isArray(chart) || chart.length === 0) return undefined

  const base = now.getTime()
  const flags = chart.map(
    (_, index) =>
      resolveOpenNow(place, new Date(base + index * 3600 * 1000)) === false,
  )

  return flags.some(Boolean) ? flags : undefined
}

/**
 * Is the place open continuously from now through the next `hours` hours?
 *
 * Checks each hour in the window rather than just the endpoints, so a venue
 * that shuts for a midday break isn't reported as open across it.
 *
 * Unknown hours stay `null` and are treated as "keep visible" by callers — a
 * venue with no published hours is not a closed venue.
 *
 * @returns {boolean|null}
 */
export function isOpenThroughout(place, hours = 0, now = new Date()) {
  const base = now.getTime()
  let sawKnown = false

  for (let offset = 0; offset <= hours; offset += 1) {
    const state = resolveOpenNow(place, new Date(base + offset * 3600 * 1000))
    if (state === false) return false
    if (state === true) sawKnown = true
  }

  return sawKnown ? true : null
}

/** Where the hours shown for a place came from: 'google' | 'osm' | null. */
export function openingHoursSource(place) {
  if (periodsToIntervals(place?.openingPeriods)) return 'google'
  if (parseOpeningHours(place?.openingHours)) return 'osm'
  return null
}

/**
 * Human-readable hours for today, e.g. "9:00 AM – 5:00 PM".
 *
 * Prefers Google's `weekdayDescriptions`, which is already localised and
 * formatted. Google orders that array Monday-first, unlike its Sunday-first
 * `periods`, so the index has to be shifted.
 *
 * @returns {string|null} null when no hours are known for today
 */
export function formatTodayHours(place, now = new Date()) {
  const descriptions = place?.openingWeekdayText
  if (Array.isArray(descriptions) && descriptions.length === 7) {
    const { day } = getNycClock(now) // 0 = Sunday
    const mondayFirst = (day + 6) % 7
    const line = descriptions[mondayFirst]
    if (typeof line === 'string' && line.includes(':')) {
      // "Monday: 9:00 AM – 5:00 PM" -> "9:00 AM – 5:00 PM"
      return line.slice(line.indexOf(':') + 1).trim() || null
    }
  }

  // OSM fallback: render today's intervals from the parsed tag.
  const intervals = parseOpeningHours(place?.openingHours)
  if (!intervals) return null

  const { day } = getNycClock(now)
  const dayStart = day * 24 * 60
  const dayEnd = dayStart + 24 * 60
  const todays = intervals
    .filter(([start]) => start >= dayStart && start < dayEnd)
    .sort((a, b) => a[0] - b[0])

  if (!todays.length) return null
  if (todays.length === 1 && todays[0][1] - todays[0][0] >= 24 * 60) {
    return '24 hours'
  }

  const fmt = (weekMinute) => {
    const m = weekMinute % (24 * 60)
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  return todays.map(([s, e]) => `${fmt(s)}–${fmt(e)}`).join(', ')
}
