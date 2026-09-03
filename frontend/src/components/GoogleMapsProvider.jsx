import { APIProvider } from '@vis.gl/react-google-maps'
import { useLanguage } from '../language/useLanguage'
import { getGoogleMapLocale } from '../utils/googleMapsLocale'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export function GoogleMapsProvider({ children }) {
  const { language } = useLanguage()
  const { language: mapLanguage, region: mapRegion } = getGoogleMapLocale(language)

  if (!API_KEY) {
    return children
  }

  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={['marker', 'places']}
      language={mapLanguage}
      region={mapRegion}
    >
      {children}
    </APIProvider>
  )
}
