import { useCallback, useEffect, useState } from 'react'
import {
  ControlPosition,
  Map,
  MapControl,
  useMap,
  AdvancedMarker,
} from '@vis.gl/react-google-maps'
import { Flame, Navigation } from 'lucide-react'
import { useLanguage } from '../../language/useLanguage'
import { ClusteredPlaceMarkers } from './ClusteredPlaceMarkers'
import { BusynessHeatmapLayer } from './BusynessHeatmapLayer'
import {
  DARK_MAP_STYLES,
  DEFAULT_ZOOM,
  LIGHT_MAP_STYLES,
  MANHATTAN_CENTER,
} from '../../utils/mapBounds'

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

function SelectedPlaceHandler({ selectedPlace, focusNonce, zoomIn = true }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedPlace || !map || !focusNonce) return

    const focusPlace = () => {
      map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng })
      // Only zoom for map-marker clicks — list clicks just pan.
      if (!zoomIn) return
      const currentZoom = map.getZoom() ?? 13
      if (currentZoom < 16) {
        map.setZoom(16)
      }
    }

    // Re-center after the right panel grid transition finishes (0.35s).
    const layoutTimer = window.setTimeout(focusPlace, 400)

    const mapDiv = map.getDiv()
    let resizeTimer
    const resizeObserver = mapDiv
      ? new ResizeObserver(() => {
          clearTimeout(resizeTimer)
          resizeTimer = window.setTimeout(focusPlace, 50)
        })
      : null
    resizeObserver?.observe(mapDiv)

    focusPlace()

    return () => {
      clearTimeout(layoutTimer)
      clearTimeout(resizeTimer)
      resizeObserver?.disconnect()
    }
  }, [selectedPlace?.id, selectedPlace?.lat, selectedPlace?.lng, focusNonce, map])

  return null
}

function SearchOriginHandler({ searchOrigin }) {
  const map = useMap()

  useEffect(() => {
    if (!searchOrigin || !map) return
    map.panTo(searchOrigin)
    map.setZoom(16)
  }, [searchOrigin, map])

  return null
}

function UserLocationPinHandler({ active, userLocation, locateNonce }) {
  const map = useMap()

  useEffect(() => {
    if (!active || !userLocation || !map || !locateNonce) return
    map.panTo(userLocation)
    map.setZoom(16)
  }, [active, userLocation, locateNonce, map])

  return null
}

function MapToolbar({ usingGps, onLocateMe, heatmapOn, onToggleHeatmap }) {
  const { t } = useLanguage()

  return (
    <MapControl position={ControlPosition.TOP_CENTER}>
      <div className="map-toolbar glass">
        <button
          type="button"
          className={`map-tool-btn ${usingGps ? 'active' : ''}`}
          title={usingGps ? t('myLocation') : t('locationApproximate')}
          onClick={onLocateMe}
        >
          <Navigation size={16} />
          {t('myLocation')}
        </button>
        <button
          type="button"
          className={`map-tool-btn ${heatmapOn ? 'active' : ''}`}
          title={t('busynessHeatmapHint')}
          aria-pressed={heatmapOn}
          onClick={onToggleHeatmap}
        >
          <Flame size={16} />
          {t('busynessHeatmap')}
        </button>
      </div>
    </MapControl>
  )
}

export function GoogleManhattanMap({
  places,
  selectedPlace,
  placeFocusNonce = 0,
  onHover,
  onSelect,
  onClearSelection,
  darkMode,
  userLocation,
  usingGps,
  onLocateMe,
  searchOrigin,
  placeFocusZoom = true,
}) {
  const { t } = useLanguage()
  const [locationPinActive, setLocationPinActive] = useState(false)
  const [locateNonce, setLocateNonce] = useState(0)
  const [heatmapOn, setHeatmapOn] = useState(false)

  const handleLocateMe = useCallback(() => {
    onLocateMe?.()
    setLocationPinActive(true)
    setLocateNonce((n) => n + 1)
  }, [onLocateMe])

  const handleSelect = useCallback(
    (place) => {
      setLocationPinActive(false)
      onSelect?.(place)
    },
    [onSelect],
  )

  // Sidebar / list selection also bumps placeFocusNonce — drop the locate pin so
  // place focus wins and a later "My location" click can re-activate cleanly.
  useEffect(() => {
    if (placeFocusNonce > 0) setLocationPinActive(false)
  }, [placeFocusNonce])

  return (
    <div className={`map-area google-map-area ${heatmapOn ? 'heatmap-on' : ''}`}>
      <Map
        mapId={MAP_ID}
        colorScheme={darkMode ? 'DARK' : 'LIGHT'}
        defaultCenter={MANHATTAN_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        styles={darkMode ? DARK_MAP_STYLES : LIGHT_MAP_STYLES}
        className="google-map-container"
        onClick={() => onClearSelection?.()}
      >
        <BusynessHeatmapLayer places={places} visible={heatmapOn} />

        <ClusteredPlaceMarkers
          places={places}
          selectedPlace={selectedPlace}
          onSelect={handleSelect}
          onHover={onHover}
          compact={heatmapOn}
        />

        {locationPinActive && userLocation && (
          <AdvancedMarker position={userLocation} zIndex={2000}>
            <div className="search-origin-marker" title={t('myLocation')}>
              <span className="search-origin-pulse" aria-hidden="true" />
            </div>
          </AdvancedMarker>
        )}

        {searchOrigin && (
          <AdvancedMarker position={searchOrigin} zIndex={2000}>
            <div className="search-origin-marker" title={searchOrigin.label}>
              <span className="search-origin-pulse" aria-hidden="true" />
            </div>
          </AdvancedMarker>
        )}

        <SearchOriginHandler searchOrigin={searchOrigin} />
        <SelectedPlaceHandler
          selectedPlace={selectedPlace}
          focusNonce={placeFocusNonce}
          zoomIn={placeFocusZoom}
        />
        <UserLocationPinHandler
          active={locationPinActive}
          userLocation={userLocation}
          locateNonce={locateNonce}
        />

        <MapToolbar
          usingGps={usingGps}
          onLocateMe={handleLocateMe}
          heatmapOn={heatmapOn}
          onToggleHeatmap={() => setHeatmapOn((prev) => !prev)}
        />
      </Map>
    </div>
  )
}
