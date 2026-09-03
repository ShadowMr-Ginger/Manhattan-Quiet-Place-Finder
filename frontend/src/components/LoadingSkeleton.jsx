import './LoadingSkeleton.css'

export default function LoadingSkeleton() {
  return (
    <div className="skeleton-loader">
      <div className="skeleton-nav shimmer" />
      <div className="skeleton-body">
        <div className="skeleton-sidebar">
          <div className="skeleton-search shimmer" />
          <div className="skeleton-chips">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-chip shimmer" />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card shimmer" />
          ))}
        </div>
        <div className="skeleton-map shimmer" />
      </div>
    </div>
  )
}
