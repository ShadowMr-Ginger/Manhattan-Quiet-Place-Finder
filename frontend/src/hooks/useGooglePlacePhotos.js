import { useEffect, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { fetchPlacePhotoUrls } from '../services/googleMapsData'

const HAS_GOOGLE_MAPS = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)

function shouldUseGooglePhotos(placeId) {
  return HAS_GOOGLE_MAPS && Boolean(placeId)
}

/**
 * Loads Google Place photos via the new Places API once the library is ready.
 * When Google is available, shows a loading state first (not placeholder images)
 * to avoid a visible swap from Unsplash → API photos.
 */
export function useGooglePlacePhotos(placeId, fallbackPhotos = []) {
  const placesLib = useMapsLibrary('places')
  const fallbackRef = useRef(fallbackPhotos)
  fallbackRef.current = fallbackPhotos

  const useGoogle = shouldUseGooglePhotos(placeId)

  const [photos, setPhotos] = useState(() => (useGoogle ? [] : fallbackPhotos))
  const [loading, setLoading] = useState(useGoogle)

  useEffect(() => {
    if (!shouldUseGooglePhotos(placeId)) {
      setPhotos(fallbackRef.current)
      setLoading(false)
      return
    }

    setPhotos([])
    setLoading(true)
  }, [placeId])

  useEffect(() => {
    if (!shouldUseGooglePhotos(placeId)) return undefined
    if (!placesLib) return undefined

    let cancelled = false

    fetchPlacePhotoUrls(placeId)
      .then((urls) => {
        if (cancelled) return
        if (urls?.length) {
          setPhotos(urls)
          return
        }
        setPhotos(fallbackRef.current)
      })
      .catch(() => {
        if (!cancelled) setPhotos(fallbackRef.current)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [placeId, placesLib])

  return {
    photos,
    loadingGooglePhotos: shouldUseGooglePhotos(placeId) && loading,
  }
}
