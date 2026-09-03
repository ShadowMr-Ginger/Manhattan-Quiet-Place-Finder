import { useEffect, useRef } from 'react'
import { APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps'
import {
  applyLocalizedLabels,
  collectPlaceIdsForLocalization,
} from '../utils/localizePlaces'
import { fetchLocalizedPlaceLabels } from '../services/googleMapsData'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const DEBOUNCE_MS = 400
const BATCH_SIZE = 5

async function fetchLabelsForPlaceIds(placesById, placeIds, language) {
  const labelsById = new Map()

  for (let index = 0; index < placeIds.length; index += BATCH_SIZE) {
    const chunk = placeIds.slice(index, index + BATCH_SIZE)
    const settled = await Promise.all(
      chunk.map(async (venueId) => {
        const place = placesById.get(venueId)
        if (!place?.placeId) return null

        const labels = await fetchLocalizedPlaceLabels(place.placeId, language)
        if (!labels) return null
        return [venueId, labels]
      }),
    )

    settled.forEach((entry) => {
      if (entry) labelsById.set(entry[0], entry[1])
    })
  }

  return labelsById
}

export function useLocalizedPlaces({
  venues,
  setVenues,
  language,
  filteredPlaces,
  selectedPlace,
  savedPlaces,
  recentPlaces,
  enabled = true,
}) {
  const apiStatus = useApiLoadingStatus()
  const requestRef = useRef(0)
  const venuesRef = useRef(venues)

  venuesRef.current = venues

  useEffect(() => {
    if (!enabled || !API_KEY || language === 'en') return
    if (apiStatus !== APILoadingStatus.LOADED) return

    const placeIds = collectPlaceIdsForLocalization({
      filteredPlaces,
      selectedPlace,
      savedPlaces,
      recentPlaces,
    })
    if (!placeIds.length) return

    const requestId = ++requestRef.current
    const timer = window.setTimeout(async () => {
      const currentVenues = venuesRef.current
      if (!currentVenues.length) return

      const placesById = new Map(currentVenues.map((place) => [place.id, place]))
      const labelsById = await fetchLabelsForPlaceIds(placesById, placeIds, language)

      if (requestId !== requestRef.current || !labelsById.size) return

      setVenues((prev) => {
        let changed = false
        const next = prev.map((place) => {
          const labels = labelsById.get(place.id)
          if (!labels) return place

          const updated = applyLocalizedLabels(place, labels)
          if (
            updated.name !== place.name ||
            updated.address !== place.address
          ) {
            changed = true
          }
          return updated
        })

        return changed ? next : prev
      })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    apiStatus,
    enabled,
    filteredPlaces,
    language,
    recentPlaces,
    savedPlaces,
    selectedPlace,
    setVenues,
  ])
}
