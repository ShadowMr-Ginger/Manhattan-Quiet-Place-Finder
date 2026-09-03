import { CROWDEDNESS } from '../data/constants'

/** Map crowdedness (from list busyness) to heatmap intensity 0–1. */
export function crowdednessToHeatWeight(crowdedness) {
  if (crowdedness === 'high') return 1
  if (crowdedness === 'medium') return 0.48
  if (crowdedness === 'low') return 0.18
  return null
}

export function buildBusynessHeatPoints(places = []) {
  const points = []
  for (const place of places) {
    if (place?.lat == null || place?.lng == null) continue
    const weight = crowdednessToHeatWeight(place.crowdedness)
    if (weight == null) continue
    points.push({
      lat: place.lat,
      lng: place.lng,
      weight,
      level: place.crowdedness,
      color: CROWDEDNESS[place.crowdedness]?.color ?? CROWDEDNESS.medium.color,
    })
  }
  // Paint quieter blobs first so busy/red sits on top.
  points.sort((a, b) => a.weight - b.weight)
  return points
}
