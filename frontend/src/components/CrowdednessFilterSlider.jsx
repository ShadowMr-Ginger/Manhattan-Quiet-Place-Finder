import { useLanguage } from '../language/useLanguage'

const THUMB_SIZE = 16

/** Slider stops: max busy allowed. Rightmost "any" clears the filter. */
const FILTER_STOPS = [
  { key: 'low', maxLevel: 'low' },
  { key: 'medium', maxLevel: 'medium' },
  { key: 'any', maxLevel: null },
]

export function CrowdednessFilterSlider({ label, value, onChange }) {
  const { t } = useLanguage()

  const currentIndex = Math.max(
    0,
    FILTER_STOPS.findIndex((stop) => stop.maxLevel === (value ?? null)),
  )
  const stop = FILTER_STOPS[currentIndex]
  const isAny = stop.maxLevel == null
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
              onChange(FILTER_STOPS[Number(e.target.value)].maxLevel)
            }}
            aria-label={label}
            aria-valuetext={t(`crowdednessFilterStop.${stop.key}`)}
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
                onClick={() => onChange(item.maxLevel)}
              >
                {t(`crowdednessFilterStop.${item.key}`)}
              </button>
            )
          })}
        </div>
      </div>

      <p className="crowdedness-filter-summary">
        {isAny
          ? t('crowdednessFilterSummaryAny')
          : t('crowdednessFilterSummaryMax').replace(
              '{level}',
              t(`crowdednessShort.${stop.maxLevel}`),
            )}
      </p>
    </div>
  )
}
