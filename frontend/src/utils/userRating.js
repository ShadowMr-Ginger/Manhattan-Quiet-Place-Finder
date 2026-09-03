export function applyUserRatingFields(summary = {}) {
  const userReviewCount = summary.userReviewCount ?? 0
  const userRating = summary.userRating ?? null

  return {
    userRating,
    userReviewCount,
    rating: userRating ?? 0,
  }
}

/** Google Places star rating shown on list/detail cards. */
export function hasGoogleRating(place) {
  return place?.googleRating != null && Number(place.googleRating) > 0
}

export function mergeUserRatingIntoPlace(place, { averageRating, count } = {}) {
  if (!place) return place

  return {
    ...place,
    userRating: averageRating ?? null,
    userReviewCount: count ?? 0,
    rating: averageRating ?? 0,
  }
}

export function mergeGoogleRatingIntoPlace(place, { rating, userRatingCount } = {}) {
  if (!place || rating == null) return place

  return {
    ...place,
    googleRating: rating,
    googleRatingCount: userRatingCount ?? 0,
  }
}
