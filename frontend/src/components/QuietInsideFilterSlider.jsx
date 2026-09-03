import { useLanguage } from '../language/useLanguage'

const THUMB_SIZE = 16

/**
 * Slider stops: minimum indoor quiet allowed. Rightmost "any" clears the filter.
 *
 * Venue counts from the 326-venue corpus:
 *   calmOnly  -> 103  (only venues reviewers called quiet inside)
 *   notLively -> 290  (hides the 36 called loud; keeps the 166 with no reports)
 *   any       -> 326
 *
 * `notLively` deliberately keeps venues with no indoor signal — half the corpus
 * has none, and dropping them would empty the map the moment the filter moves.
 */
const FILTER_STOPS = [
  { key: 'calmOnly', minLevel: 'calmOnly' },
  { key: 'notLively', minLevel: 'notLively' },
  { key: 'any', minLevel: null },
]

export function QuietInsideFilterSlider({ label, value, onChange }) {
  const { t } = useLanguage()

  const currentIndex = Math.max(
    0,
    FILTER_STOPS.findIndex((stop) => stop.minLevel === (value ?? null)),
  )
  const stop = FILTER_STOPS[currentIndex]
  const isAny = stop.minLevel == null
  const fillPercent = (currentIndex / (FILTER_STOPS.length - 1)) * 100

  return (
    <div className="crowdedness-filter">
      <span className="crowdedness-filter-label">{label}</span>
      <div
        className="crowdedness-control"
        style={{ '--thumb-size': `${THUMB_SIZE}px` }}
      >
        <div className="crowdedness-track">
          <div className="crowdedness-rail" aria-hidden="true">
            <div
              className="crowdedness-rail-fill"
              style={{ width: `${fillPercent}%` }}
            />
          </div>

          <div className="crowdedness-stops" aria-hidden="true">
            {FILTER_STOPS.map((item, i) => {
              const included = i <= currentIndex
              return (
                <div
                  key={item.key}
                  className={`crowdedness-stop-marker ${included ? 'included' : ''} ${i === currentIndex ? 'active' : ''}`}
                >
                  <span className="crowdedness-stop-dot" />
                </div>
              )
            })}
          </div>

          <input
            type="range"
            className="crowdedness-range"
            min={0}
            max={FILTER_STOPS.length - 1}
            step={1}
            value={currentIndex}
            onChange={(e) => {
              onChange(FILTER_STOPS[Number(e.target.value)].minLevel)
            }}
            aria-label={label}
            aria-valuetext={t(`quietFilterShort.${stop.key}`)}
          />
        </div>

        <div className="crowdedness-labels">
          {FILTER_STOPS.map((item, i) => {
            const included = i <= currentIndex
            return (
              <button
                key={item.key}
                type="button"
                className={`crowdedness-label ${included ? 'included' : ''} ${i === currentIndex ? 'active' : ''}`}
                onClick={() => onChange(item.minLevel)}
              >
                {t(`quietFilterShort.${item.key}`)}
              </button>
            )
          })}
        </div>
      </div>

      <p className="crowdedness-filter-summary">
        {isAny ? t('quietFilterHint.any') : t(`quietFilterHint.${stop.key}`)}
      </p>
    </div>
  )
}
