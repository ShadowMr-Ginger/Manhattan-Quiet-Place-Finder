/** Sync list items (saved/recent) with the latest place objects from the main list. */
export function syncPlacesByIds(items, places) {
  const byId = new Map(places.map((place) => [place.id, place]))
  return items.map((item) => byId.get(item.id)).filter(Boolean)
}
