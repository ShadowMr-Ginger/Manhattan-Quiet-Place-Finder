import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'

export function AddReviewModal({ placeName, onClose, onSubmit }) {
  const { t } = useLanguage()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const displayRating = hoverRating || rating

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (rating < 1) {
      setError(t('reviewRatingRequired'))
      return
    }
    if (!text.trim()) {
      setError(t('reviewTextRequired'))
      return
    }

    setLoading(true)
    try {
      await onSubmit({ rating, text: text.trim() })
      onClose()
    } catch (err) {
      setError(err.message || t('reviewSubmitFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{t('addReview')}</h2>
            <p className="review-modal-subtitle">{placeName}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="review-form" onSubmit={handleSubmit}>
          <label className="review-form-label">{t('yourRating')}</label>
          <div className="review-star-input">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1
              const active = value <= displayRating
              return (
                <button
                  key={value}
                  type="button"
                  className={`review-star-btn ${active ? 'active' : ''}`}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(value)}
                >
                  <Star size={22} fill={active ? '#f59e0b' : 'none'} color="#f59e0b" />
                </button>
              )
            })}
          </div>

          <label className="review-form-label" htmlFor="review-text">
            {t('yourReview')}
          </label>
          <textarea
            id="review-text"
            className="review-textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('reviewPlaceholder')}
          />

          {error && <p className="auth-error">{error}</p>}

          <div className="review-form-actions">
            <button type="button" className="action-btn" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="action-btn primary" disabled={loading}>
              {loading ? t('authWaiting') : t('submitReview')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
