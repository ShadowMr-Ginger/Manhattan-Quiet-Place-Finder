import { Star } from 'lucide-react'
import { getFilledStarCount } from '../utils/venueDisplay'

export function StarRating({ rating = 0, size = 'md', className = '' }) {
  const filled = getFilledStarCount(rating)
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 22 : 16

  return (
    <span className={`star-rating star-rating-${size} ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={iconSize}
          fill={index < filled ? '#f2b705' : 'none'}
          color={index < filled ? '#f2b705' : '#e2ded7'}
        />
      ))}
    </span>
  )
}
