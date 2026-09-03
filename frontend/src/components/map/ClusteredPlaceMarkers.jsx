import { memo, useCallback, useMemo } from 'react'
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import {
  BookOpen,
  Coffee,
  Trees,
} from 'lucide-react'
import { SELECTED_MARKER_COLOR, VENUE_TYPES } from '../../data/constants'
import { useMapViewport } from '../../hooks/useMapViewport'
import { buildMapMarkers, filterPlacesInViewport } from '../../utils/markerClusters'

const TYPE_ICONS = {
  cafe: Coffee,
  library: BookOpen,
  public: Trees,
}

const PlaceMarker = memo(function PlaceMarker({
  place,
  selected,
  onSelect,
  onHover,
  compact,
}) {
  const venue = VENUE_TYPES[place.type]
  const Icon = TYPE_ICONS[place.type]

  const markerColor = selected ? SELECTED_MARKER_COLOR : venue.color
  const iconSize = selected ? (compact ? 14 : 16) : (compact ? 11 : 11)

  return (
    <AdvancedMarker
      position={{ lat: place.lat, lng: place.lng }}
      onClick={() => onSelect(place)}
      zIndex={selected ? 1000 : 1}
    >
      <div
        onMouseEnter={() => onHover(place.id)}
        onMouseLeave={() => onHover(null)}
      >
        <div
          className={`gmap-marker gmap-marker-compact ${selected ? 'selected' : ''} ${compact ? 'heatmap-compact' : ''}`}
          style={{ background: markerColor, '--marker-color': markerColor }}
        >
          <Icon size={iconSize} strokeWidth={selected ? 2.75 : 2.5} />
        </div>
      </div>
    </AdvancedMarker>
  )
})

const ClusterMarker = memo(function ClusterMarker({ cluster, onClusterClick, compact }) {
  const size = compact
    ? (cluster.count > 25 ? 40 : cluster.count > 12 ? 34 : 30)
    : (cluster.count > 25 ? 44 : cluster.count > 12 ? 38 : 32)

  return (
    <AdvancedMarker
      position={{ lat: cluster.lat, lng: cluster.lng }}
      onClick={() => onClusterClick(cluster)}
      zIndex={500}
    >
      <div
        className={`gmap-cluster ${compact ? 'heatmap-compact' : ''}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <span>{cluster.count}</span>
      </div>
    </AdvancedMarker>
  )
})

export function PlaceMarkers({
  places,
  selectedPlace,
  onSelect,
  onHover,
  compact = false,
}) {
  const map = useMap()
  const { zoom, bounds } = useMapViewport()

  const visiblePlaces = useMemo(
    () => filterPlacesInViewport(places, bounds),
    [places, bounds],
  )

  const markers = useMemo(
    () => buildMapMarkers(visiblePlaces, zoom, selectedPlace?.id),
    [visiblePlaces, zoom, selectedPlace?.id],
  )

  const handleClusterClick = useCallback((cluster) => {
    if (!map) return
    const nextZoom = Math.min((map.getZoom() ?? zoom) + 2, 17)
    map.panTo({ lat: cluster.lat, lng: cluster.lng })
    map.setZoom(nextZoom)
  }, [map, zoom])

  return markers.map((marker) => {
    if (marker.type === 'cluster') {
      return (
        <ClusterMarker
          key={marker.id}
          cluster={marker}
          onClusterClick={handleClusterClick}
          compact={compact}
        />
      )
    }

    return (
      <PlaceMarker
        key={marker.id}
        place={marker.place}
        selected={selectedPlace?.id === marker.place.id}
        onSelect={onSelect}
        onHover={onHover}
        compact={compact}
      />
    )
  })
}

export { PlaceMarkers as ClusteredPlaceMarkers }
