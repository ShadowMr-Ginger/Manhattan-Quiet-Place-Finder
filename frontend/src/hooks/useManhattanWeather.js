import { useEffect, useState } from 'react'
import {
  fetchManhattanWeather,
  getFallbackWeather,
} from '../services/weather'

export function useManhattanWeather(language) {
  const [weather, setWeather] = useState(getFallbackWeather)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await fetchManhattanWeather(language)
        if (!cancelled) {
          setWeather(data)
        }
      } catch {
        if (!cancelled) {
          setWeather(getFallbackWeather())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [language])

  return { weather, loading }
}
