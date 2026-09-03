import { APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'
import { FallbackMap } from './map/FallbackMap'
import { GoogleManhattanMap } from './map/GoogleManhattanMap'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapLoading({ label }) {
  return (
    <div className="map-area google-map-area map-reloading">
      <div className="map-reload-placeholder glass">
        <span className="map-reload-spinner" />
        {label}
      </div>
    </div>
  )
}

function GoogleMapContent({ reloadLabel, ...props }) {
  const status = useApiLoadingStatus()

  if (status !== APILoadingStatus.LOADED) {
    return <MapLoading label={reloadLabel} />
  }

  return <GoogleManhattanMap {...props} />
}

export function ManhattanMap(props) {
  const { t } = useLanguage()

  if (!API_KEY) {
    return (
      <div className="map-area map-fallback-wrap">
        <div className="map-api-notice glass">
          <MapPin size={20} />
          <div>
            <strong>{t('mapApiRequired')}</strong>
            <p>{t('mapApiHint')}</p>
          </div>
        </div>
        <FallbackMap {...props} onRecenter={props.onLocateMe} />
      </div>
    )
  }

  return <GoogleMapContent reloadLabel={t('mapReloading')} {...props} />
}
