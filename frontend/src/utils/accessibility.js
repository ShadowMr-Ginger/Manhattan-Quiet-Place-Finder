import { WHEELCHAIR_ACCESS as WHEELCHAIR_FALLBACK } from '../data/wheelchairAccess'

/**
 * Wheelchair accessibility, from OpenStreetMap's `wheelchair` tag.
 *
 * Deliberately NOT sourced from Google Places. Its `accessibilityOptions
 * .hasWheelchairAccessibleEntrance` has far better coverage (~90% of our venues
 * vs OSM's 25%), but testing it against the 20 venues OSM surveyed as `no` or
 * `limited` found it disagreed on 9 of the 16 it had an opinion on — always in
 * the permissive direction, and it returned no negatives at all across a
 * separate 30-venue sample. For an attribute where a false positive sends a
 * wheelchair user on a wasted journey, the conservative, deliberately-surveyed
 * source wins over the higher-coverage one.
 *
 * `accessibility_manual` (hand-verified) overrides OSM where present.
 */

const VALID = new Set(['yes', 'limited', 'no'])

/**
 * @returns {{ value: 'yes'|'limited'|'no', source: 'manual'|'osm' }|null}
 *   null when nobody has surveyed this venue — which must NOT be read as "no".
 */
export function resolveWheelchairAccess(place) {
  const manual = place?.accessibilityManual?.wheelchair
  if (VALID.has(manual)) return { value: manual, source: 'manual' }

  // Available on list items via VenueSummary.wheelchair, and on detail payloads
  // via the raw OSM blob.
  const tag = place?.wheelchairAccess ?? place?.osm?.tags?.wheelchair
  if (VALID.has(tag)) return { value: tag, source: 'osm' }

  // Stopgap: the same 80 tagged venues, snapshotted from
  // editorial/enrichment/outputs/canonical_venues_osm.jsonl, so the filter works
  // before the backend exposes `wheelchair` on VenueSummary. The API value above
  // always wins, so this becomes dead weight (and can be deleted) once deployed.
  // Regenerate it if the OSM enrichment is ever re-run.
  const fallback = place?.id ? WHEELCHAIR_FALLBACK[place.id] : null
  if (VALID.has(fallback)) return { value: fallback, source: 'osm' }

  return null
}

/**
 * True only for venues surveyed as wheelchair accessible.
 * `limited`, `no` and unsurveyed all fail — unknown is excluded, not assumed.
 */
export function isWheelchairAccessible(place) {
  return resolveWheelchairAccess(place)?.value === 'yes'
}
