import { useCallback, useEffect, useRef, useState } from 'react'
import { MANHATTAN_CENTER } from '../utils/mapBounds'

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
}

/**
 * @typedef {'pending' | 'granted' | 'denied' | 'unsupported'} LocationStatus
 */

export function useUserLocation() {
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState(/** @type {LocationStatus} */ ('pending'))
  const hasGpsRef = useRef(false)

  const applyPosition = useCallback((position) => {
    hasGpsRef.current = true
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    })
    setStatus('granted')
  }, [])

  const applyFallback = useCallback(() => {
    if (hasGpsRef.current) return
    setLocation(MANHATTAN_CENTER)
    setStatus((current) => (current === 'granted' ? 'granted' : 'denied'))
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(MANHATTAN_CENTER)
      setStatus('unsupported')
      return
    }

    navigator.geolocation.getCurrentPosition(applyPosition, applyFallback, GEO_OPTIONS)
  }, [applyPosition, applyFallback])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(MANHATTAN_CENTER)
      setStatus('unsupported')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      applyPosition,
      applyFallback,
      GEO_OPTIONS,
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [applyPosition, applyFallback])

  const origin = location ?? MANHATTAN_CENTER

  return {
    userLocation: origin,
    locationStatus: status,
    usingGps: status === 'granted',
    requestLocation,
  }
}
