import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coffee,
  MapPin,
  Navigation,
  Star,
  Trash2,
  Trees,
  X,
} from 'lucide-react'
import { AddReviewModal } from './AddReviewModal'
import { VenueDetailCard } from './VenueDetailCard'
import { useGooglePlacePhotos } from '../hooks/useGooglePlacePhotos'
import { CrowdednessBadge } from './CrowdednessBadge'
import { getGoogleDirectionsUrl } from '../utils/googleMapsLinks'
import { VENUE_TYPES } from '../data/constants'
import { useLanguage } from '../language/useLanguage'

function formatReviewDate(iso, language) {
  try {
    const locale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-US' : 'en-US'
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

const TYPE_ICONS = {
  cafe: Coffee,
  library: BookOpen,
  public: Trees,
}

export function PlaceDetailPanel({
  place,
  userReviews = [],
  currentUser,
  isSaved,
  onBack,
  onClose,
  onToggleSave,
  onRequireAuth,
  onAddReview,
  onDeleteReview,
}) {
  const { t, language } = useLanguage()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showAddReview, setShowAddReview] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState(null)
  const { photos, loadingGooglePhotos } = useGooglePlacePhotos(place.placeId, place.photos)

  useEffect(() => {
    setPhotoIndex(0)
  }, [place.id])

  useEffect(() => {
    setPhotoIndex((index) => {
      if (!photos.length) return 0
      return index >= photos.length ? 0 : index
    })
  }, [photos.length])

  const handleAddReviewClick = () => {
    onRequireAuth?.(() => setShowAddReview(true))
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm(t('deleteReviewConfirm'))) return

    setDeletingReviewId(reviewId)
    try {
      await onDeleteReview?.(reviewId)
    } catch {
      window.alert(t('deleteReviewFailed'))
    } finally {
      setDeletingReviewId(null)
    }
  }

  const venue = VENUE_TYPES[place.type]
  const Icon = TYPE_ICONS[place.type]

  const directionsUrl = getGoogleDirectionsUrl(place, language)

  return (
    <div className="place-detail">
      <div className="detail-header">
        <button type="button" className="icon-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="detail-title">
          <h2>{place.name}</h2>
          <div className="detail-subtitle">
            <Icon size={14} style={{ color: venue.color }} />
            <span>{t(`venueTypes.${place.type}`)}</span>
            <span className="dot">·</span>
            <MapPin size={12} />
            <span>{place.address}</span>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className={`action-btn ${isSaved ? 'active' : ''}`}
          onClick={() => onToggleSave(place)}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          {t('save')}
        </button>
      </div>

      <div className={`photo-carousel ${loadingGooglePhotos ? 'photo-carousel-loading' : ''}`}>
        {loadingGooglePhotos && photos.length === 0 ? (
          <div className="photo-carousel-skeleton" aria-busy="true" aria-label={t('loadingPhotos')} />
        ) : photos.length > 0 ? (
          <>
            <button
              type="button"
              className="carousel-btn"
              onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
              disabled={photos.length <= 1}
            >
              <ChevronLeft size={20} />
            </button>
            <img
              src={photos[photoIndex]}
              alt={place.name}
            />
            <button
              type="button"
              className="carousel-btn"
              onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
              disabled={photos.length <= 1}
            >
              <ChevronRight size={20} />
            </button>
            {photos.length > 1 && (
              <div className="carousel-dots">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === photoIndex ? 'active' : ''}
                    onClick={() => setPhotoIndex(i)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="photo-carousel-empty">{t('noPhotosAvailable')}</div>
        )}
      </div>

      <VenueDetailCard place={place} />

      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="google-directions-btn"
      >
        <Navigation size={16} />
        {t('openGoogleDirections')}
      </a>

      <div className="reviews-section">
        <div className="reviews-header">
          <h3>{t('reviews')}</h3>
          <div className="reviews-header-actions">
            <button type="button" className="action-btn add-review-btn" onClick={handleAddReviewClick}>
              {t('addReview')}
            </button>
          </div>
        </div>

        {userReviews.length === 0 ? (
          <p className="reviews-empty">{t('noReviewsYet')}</p>
        ) : (
          userReviews.map((review) => {
            const canDelete =
              currentUser?.id && review.userId && review.userId === currentUser.id

            return (
            <div key={review.id} className="review-card">
              <div className="review-avatar">{review.avatar}</div>
              <div className="review-body">
                <div className="review-meta-row">
                  <div className="review-meta">
                    <strong>{review.userName}</strong>
                    <span className="review-stars">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
                      ))}
                    </span>
                    <span className="review-date">{formatReviewDate(review.createdAt, language)}</span>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      className="review-delete-btn"
                      onClick={() => handleDeleteReview(review.id)}
                      disabled={deletingReviewId === review.id}
                      title={t('deleteReview')}
                      aria-label={t('deleteReview')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p>{review.text}</p>
              </div>
            </div>
            )
          })
        )}
      </div>

      {showAddReview && (
        <AddReviewModal
          placeName={place.name}
          onClose={() => setShowAddReview(false)}
          onSubmit={(review) => onAddReview?.(place.id, review)}
        />
      )}
    </div>
  )
}
