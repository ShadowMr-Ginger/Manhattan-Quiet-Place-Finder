export const VENUE_TYPES = {
  cafe: { label: 'Cafe', color: '#f59e0b', icon: 'coffee' },
  library: { label: 'Library', color: '#3b82f6', icon: 'book-open' },
  public: { label: 'Public Study Area', color: '#10b981', icon: 'trees' },
}

export const SELECTED_MARKER_COLOR = '#ef4444'

export const FILTER_TYPES = ['cafe', 'library', 'public']

export const MAX_RECENT_SEARCHES = 5

export const PROFILE_LIST_PREVIEW_LIMIT = 3

export const CROWDEDNESS_LEVELS = ['low', 'medium', 'high']

export const CROWDEDNESS = {
  low: { label: 'Not Crowded', color: '#10b981' },
  medium: { label: 'Moderately Busy', color: '#f59e0b' },
  high: { label: 'Very Crowded', color: '#ef4444' },
}

export const QUIET_INSIDE_LEVELS = ['lively', 'mixed', 'calm']

/**
 * Filter stops, least to most restrictive. Venue counts from the 326-venue corpus:
 *   any        -> 326 (no filtering)
 *   notLively  -> 290 (hides the 36 venues reviewers called loud; keeps unknowns)
 *   calmOnly   -> 103 (only venues reviewers called quiet)
 * `notLively` deliberately keeps the 166 venues with no indoor data — dropping
 * them would remove half the map the moment the filter is touched.
 */
/** "Open now" look-ahead, in hours. 0 = open right now. */
export const OPEN_HORIZON_OPTIONS = [0, 1, 2, 3]

/**
 * Minimum Google rating stops. `null` = no minimum.
 * Venues whose rating hasn't loaded yet stay visible — Places enrichment is
 * async, so hiding them would make the list shrink and regrow on load.
 */
export const RATING_STOPS = [null, 3.5, 4, 4.5]

export const ATTRIBUTE_KEYS = [
  'noise',
  'wifi',
  'seating',
  'outlets',
  'laptop_friendly',
  'hours',
  'crowding',
  'price',
  'restroom',
  'accessibility',
]

export const QUIET_INSIDE = {
  lively: { label: 'Not quiet', color: '#e0685a' },
  mixed: { label: 'Mixed', color: '#b8b4ad' },
  calm: { label: 'Quiet', color: '#14b8a6' },
}

export const TIME_OPTIONS = [
  { key: 'now', label: 'Now' },
  { key: 'plus1', label: '+1 Hour' },
  { key: 'plus2', label: '+2 Hours' },
  { key: 'plus3', label: '+3 Hours' },
]

export const WEATHER = {
  condition: 'Sunny',
  temp: 72,
  feelsLike: 74,
  humidity: 45,
  wind: 8,
  tip: 'Perfect weather for a café with outdoor seating or a park study spot!',
}
