import {
  BookOpen,
  Coffee,
  Navigation,
  Trees,
} from 'lucide-react'
import { SELECTED_MARKER_COLOR, VENUE_TYPES } from '../../data/constants'

const TYPE_ICONS = {
  cafe: Coffee,
  library: BookOpen,
  public: Trees,
}

export function FallbackMap({
  places,
  selectedPlace,
  onHover,
  onSelect,
  onClearSelection,
  onRecenter,
  usingGps,
  onLocateMe,
}) {
  return (
    <div className="map-area">
      <div className="map-container" onClick={onClearSelection}>
        <div className="map-grid" />
        <div className="map-water map-water-east" />
        <div className="map-water map-water-west" />
        <div className="map-central-park">
          <span>Central Park</span>
        </div>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="map-block"
            style={{
              left: `${10 + (i % 6) * 14}%`,
              top: `${15 + Math.floor(i / 6) * 18}%`,
              width: `${8 + (i % 3) * 2}%`,
              height: `${6 + (i % 4) * 2}%`,
              opacity: 0.3 + (i % 5) * 0.08,
            }}
          />
        ))}
        <div className="map-heatmap" />

        {places.map((place) => {
          const venue = VENUE_TYPES[place.type]
          const Icon = TYPE_ICONS[place.type]
          const isSelected = selectedPlace?.id === place.id

          const markerColor = isSelected ? SELECTED_MARKER_COLOR : venue.color

          return (
            <button
              key={place.id}
              type="button"
              className={`map-marker map-marker-compact ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${place.mapX}%`,
                top: `${place.mapY}%`,
                background: markerColor,
                '--marker-color': markerColor,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(place)
              }}
              onMouseEnter={() => onHover?.(place.id)}
              onMouseLeave={() => onHover?.(null)}
            >
              <Icon size={isSelected ? 17 : 12} strokeWidth={isSelected ? 2.75 : 2.5} />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="map-recenter glass"
        title={usingGps ? 'My location' : 'Approximate location'}
        onClick={() => {
          onLocateMe?.()
          onRecenter?.()
        }}
      >
        <Navigation size={18} />
      </button>
    </div>
  )
}
