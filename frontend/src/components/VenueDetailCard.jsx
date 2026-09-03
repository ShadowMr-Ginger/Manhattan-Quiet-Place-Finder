import {
  Accessibility,
  Bath,
  BookOpen,
  Coffee,
  Leaf,
  Star,
  Trees,
  Wifi,
} from 'lucide-react'
import { VENUE_TYPES } from '../data/constants'
import { useLanguage } from '../language/useLanguage'
import { getOsmAmenities } from '../utils/venueDisplay'
import { hasGoogleRating } from '../utils/userRating'
import { VenueSignalsSection } from './VenueSignalsSection'
import { VenueAttributesSection } from './VenueAttributesSection'
import { formatTodayHours, resolveOpenNow } from '../utils/openingHours'
import { resolveWheelchairAccess } from '../utils/accessibility'

const TYPE_ICONS = {
  cafe: Coffee,
  library: BookOpen,
  public: Trees,
}

const AMENITY_ICONS = {
  access: Accessibility,
  wifi: Wifi,
  toilets: Bath,
  outdoor: Leaf,
}

export function VenueDetailCard({ place }) {
  const { t } = useLanguage()
  const venue = VENUE_TYPES[place.type] ?? VENUE_TYPES.cafe
  const Icon = TYPE_ICONS[place.type] ?? Coffee
  const showGoogleRating = hasGoogleRating(place)
  const featuredQuote = place.editorialQuotes?.[0]
  const amenities = getOsmAmenities(place)
  // Hours now come from the resolver (Google first, OSM fallback) rather than
  // the OSM amenity chip, so the strip only renders the other amenities.
  const featureItems = amenities.filter((item) => item.key !== 'hours')
  const todayHours = formatTodayHours(place)
  const openNow = resolveOpenNow(place)
  // Shows `limited` and `no` as well as `yes` — knowing a venue is NOT accessible
  // is as useful as knowing it is, and omitting them would hide survey results.
  const access = resolveWheelchairAccess(place)
  const amenityItems = access
    ? [
        ...featureItems,
        {
          key: 'access',
          label:
            access.value === 'yes'
              ? 'access'
              : access.value === 'limited'
                ? 'limited'
                : 'no access',
          title: `${
            access.value === 'yes'
              ? t('accessYes')
              : access.value === 'limited'
                ? t('accessLimited')
                : t('accessNo')
          } · ${
            access.source === 'manual' ? t('accessSourceManual') : t('accessSourceOsm')
          }`,
          accessValue: access.value,
        },
      ]
    : featureItems

  return (
    <div className="venue-detail-card">
      <div className="venue-detail-card-header">
        <div
          className="venue-detail-card-icon"
          style={{ background: venue.color }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div className="venue-detail-card-heading">
          <h3 className="venue-detail-card-name" title={place.name}>
            {place.name}
          </h3>
          <div className="venue-detail-card-meta">
            <div className="venue-detail-card-rating">
              {showGoogleRating ? (
                <>
                  <span className="venue-detail-card-score">
                    {place.googleRating.toFixed(1)} / 5
                  </span>
                  <Star size={14} fill="#f59e0b" color="#f59e0b" />
                </>
              ) : (
                <span className="venue-detail-card-rating-empty">
                  {t('noUserRatingYet')}
                </span>
              )}
            </div>

            {todayHours && (
              <span className="venue-detail-card-hours">
                {openNow !== null && (
                  <span
                    className={`venue-open-badge ${openNow ? 'is-open' : 'is-closed'}`}
                  >
                    {openNow ? t('openNowBadge') : t('closedNowBadge')}
                  </span>
                )}
                {todayHours}
              </span>
            )}
          </div>
          <p className="venue-detail-card-subtitle" title={place.address}>
            {t(`venueTypes.${place.type}`)}
            <span className="dot">·</span>
            {place.address}
          </p>
        </div>
      </div>

      {featuredQuote && (
        <blockquote className="venue-featured-quote venue-detail-card-quote">
          <p>“{featuredQuote.text}”</p>
          {featuredQuote.publication && (
            <footer>— {featuredQuote.publication}</footer>
          )}
        </blockquote>
      )}

      <VenueSignalsSection signals={place.signals} embedded openingInfo={place} />

      <VenueAttributesSection attributeScores={place.attributeScores} />

      {amenityItems.length > 0 && (
        <div className="venue-osm-footer">
          <div className="venue-osm-footer-amenities">
            {amenityItems.map((item) => {
              const AmenityIcon = AMENITY_ICONS[item.key] ?? Coffee
              return (
                <div
                  key={item.key}
                  className={`venue-amenity-item${
                    item.accessValue ? ` is-access is-${item.accessValue}` : ''
                  }`}
                  title={item.title}
                >
                  <AmenityIcon size={16} />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
