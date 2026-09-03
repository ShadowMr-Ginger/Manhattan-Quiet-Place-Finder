import { useState } from 'react'
import { ArrowLeft, LogOut, Star, X } from 'lucide-react'
import { PROFILE_LIST_PREVIEW_LIMIT, VENUE_TYPES } from '../data/constants'
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

const STAT_SECTIONS = [
  { key: 'reviews', labelKey: 'myReviews' },
  { key: 'saved', labelKey: 'saved' },
  { key: 'recent', labelKey: 'recent' },
]

function ReviewList({ reviews, language, onSelectReviewVenue, onClose }) {
  if (reviews.length === 0) {
    return <p className="empty-text">—</p>
  }

  return (
    <ul className="profile-review-list">
      {reviews.map((review) => (
        <li key={review.id}>
          <button
            type="button"
            className="profile-review-item"
            onClick={() => {
              onSelectReviewVenue(review.venueId)
              onClose()
            }}
          >
            <div className="profile-review-header">
              <span className="profile-review-venue">{review.venueName}</span>
              <div className="profile-review-meta">
                <span className="profile-review-stars">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </span>
                <span className="profile-review-date">
                  {formatReviewDate(review.createdAt, language)}
                </span>
              </div>
            </div>
            <p className="profile-review-text">{review.text}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

function PlaceList({ places, onSelectPlace, onClose }) {
  if (places.length === 0) {
    return <p className="empty-text">—</p>
  }

  return (
    <ul>
      {places.map((place) => (
        <li key={place.id}>
          <button
            type="button"
            onClick={() => {
              onSelectPlace(place)
              onClose()
            }}
          >
            <span
              className="type-dot"
              style={{ background: VENUE_TYPES[place.type]?.color ?? '#94a3b8' }}
            />
            <span>{place.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ProfileModal({
  user,
  myReviews,
  saved,
  recentlyViewed,
  onSelectReviewVenue,
  onSelectPlace,
  onClose,
  onLogout,
}) {
  const { t, language } = useLanguage()
  const [expandedSection, setExpandedSection] = useState(null)

  const sectionData = {
    reviews: {
      title: t('myReviews'),
      items: myReviews,
      emptyText: t('noMyReviewsYet'),
    },
    saved: {
      title: t('savedPlaces'),
      items: saved,
      emptyText: t('noPlacesYet'),
    },
    recent: {
      title: t('recentlyViewed'),
      items: recentlyViewed,
      emptyText: t('noPlacesYet'),
    },
  }

  const counts = {
    reviews: myReviews.length,
    saved: saved.length,
    recent: recentlyViewed.length,
  }

  const renderSectionContent = (key, items, limit) => {
    const visibleItems = limit != null ? items.slice(0, limit) : items

    if (key === 'reviews') {
      if (visibleItems.length === 0) {
        return <p className="empty-text">{sectionData.reviews.emptyText}</p>
      }
      return (
        <ReviewList
          reviews={visibleItems}
          language={language}
          onSelectReviewVenue={onSelectReviewVenue}
          onClose={onClose}
        />
      )
    }

    if (visibleItems.length === 0) {
      return <p className="empty-text">{sectionData[key].emptyText}</p>
    }

    return (
      <PlaceList
        places={visibleItems}
        onSelectPlace={onSelectPlace}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="modal-overlay profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <div className="profile-avatar">{user.avatar}</div>
          <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="profile-stats">
          {STAT_SECTIONS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              className={`stat ${expandedSection === key ? 'active' : ''}`}
              onClick={() => setExpandedSection(key)}
              aria-pressed={expandedSection === key}
            >
              <span className="stat-num">{counts[key]}</span>
              <span className="stat-label">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        {expandedSection ? (
          <div className="profile-section profile-section-expanded">
            <button
              type="button"
              className="profile-back-btn"
              onClick={() => setExpandedSection(null)}
            >
              <ArrowLeft size={14} />
              {t('profileBackToOverview')}
            </button>
            <h3>{sectionData[expandedSection].title}</h3>
            {renderSectionContent(expandedSection, sectionData[expandedSection].items)}
          </div>
        ) : (
          <>
            <div className="profile-section">
              <h3>{t('myReviews')}</h3>
              {renderSectionContent('reviews', myReviews, PROFILE_LIST_PREVIEW_LIMIT)}
            </div>

            <div className="profile-section">
              <h3>{t('savedPlaces')}</h3>
              {renderSectionContent('saved', saved, PROFILE_LIST_PREVIEW_LIMIT)}
            </div>

            <div className="profile-section">
              <h3>{t('recentlyViewed')}</h3>
              {renderSectionContent('recent', recentlyViewed, PROFILE_LIST_PREVIEW_LIMIT)}
            </div>
          </>
        )}

        <button type="button" className="logout-btn" onClick={onLogout}>
          <LogOut size={16} />
          {t('logOut')}
        </button>
      </div>
    </div>
  )
}
