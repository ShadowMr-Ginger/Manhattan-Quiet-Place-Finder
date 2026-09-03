import { useEffect, useState } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { DEFAULT_ZOOM, latLngBoundsToPlain } from '../utils/mapBounds'

export function useMapViewport() {
  const map = useMap()
  const [viewport, setViewport] = useState({ zoom: DEFAULT_ZOOM, bounds: null })

  useEffect(() => {
    if (!map) return

    const update = () => {
      const bounds = map.getBounds()
      setViewport({
        zoom: map.getZoom() ?? DEFAULT_ZOOM,
        bounds: bounds ? latLngBoundsToPlain(bounds) : null,
      })
    }

    update()

    const idleListener = map.addListener('idle', update)
    return () => idleListener.remove()
  }, [map])

  return viewport
}
