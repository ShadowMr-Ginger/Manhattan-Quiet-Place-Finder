import {
  BookOpen,
  Coffee,
  Navigation,
  Trees,
} from 'lucide-react'
import { CrowdednessBadge } from './CrowdednessBadge'
import { StarRating } from './StarRating'
import { VENUE_TYPES } from '../data/constants'
import { useLanguage } from '../language/useLanguage'
import { getGoogleDirectionsUrl } from '../utils/googleMapsLinks'
import { hasGoogleRating } from '../utils/userRating'

const TYPE_ICONS = {
  cafe: Coffee,
  library: BookOpen,
  public: Trees,
}

export function PlaceCard({
  place,
  selected,
  focused,
  onSelect,
}) {
  const { t, language } = useLanguage()
  const venue = VENUE_TYPES[place.type]
  const Icon = TYPE_ICONS[place.type]
  const directionsUrl = getGoogleDirectionsUrl(place, language)
  const showGoogleRating = hasGoogleRating(place)

  return (
    <article
      data-place-id={place.id}
      aria-selected={selected}
      className={`place-card ${selected ? 'selected' : ''} ${focused ? 'keyboard-focus' : ''}`}
      onClick={() => onSelect(place)}
    >
      <div className="card-header">
        <div
          className="type-icon"
          style={{ background: venue.color }}
        >
          <Icon size={16} />
        </div>
        <div className="card-title-group">
          <h3>{place.name}</h3>
          <p className="card-address">{place.address}</p>
        </div>
        <div className="card-actions">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn directions"
            title={t('openGoogleDirections')}
            onClick={(e) => e.stopPropagation()}
          >
            <Navigation size={16} />
          </a>
        </div>
      </div>

      <div className="card-meta">
        <span className="distance">{place.distance} {t('km')}</span>
        <div className="card-rating">
          {showGoogleRating ? (
            <>
              <span className="card-rating-number">
                {place.googleRating.toFixed(1)}
              </span>
              <StarRating rating={place.googleRating} size="sm" />
            </>
          ) : (
            <span className="card-rating-empty">{t('noUserRatingYet')}</span>
          )}
        </div>
      </div>

      <div className="card-crowd-row">
        <CrowdednessBadge level={place.crowdedness} size="sm" showDot />
      </div>
    </article>
  )
}
