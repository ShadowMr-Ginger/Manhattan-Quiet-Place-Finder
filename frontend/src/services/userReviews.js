import { apiRequest } from './api'

export async function getReviewsForVenue(venueId) {
  const data = await apiRequest(`/venues/${encodeURIComponent(venueId)}/reviews`)
  return {
    items: data?.items ?? [],
    averageRating: data?.averageRating ?? null,
    count: data?.count ?? 0,
  }
}

export async function fetchMyReviews() {
  const data = await apiRequest('/reviews/me')
  return data?.items ?? []
}

export async function addReview(venueId, { rating, text }) {
  const trimmed = text.trim()
  if (!venueId || !trimmed) {
    throw new Error('Review is incomplete')
  }
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5')
  }

  return apiRequest(`/venues/${encodeURIComponent(venueId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating: Math.round(rating), text: trimmed }),
  })
}

export async function deleteReview(reviewId) {
  if (!reviewId) {
    throw new Error('Review id is required')
  }

  await apiRequest(`/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
  })
}
