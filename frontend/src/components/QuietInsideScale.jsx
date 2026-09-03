import { QUIET_INSIDE, QUIET_INSIDE_LEVELS } from '../data/constants'
import { useLanguage } from '../language/useLanguage'

export function QuietInsideScale({ level }) {
  const { t } = useLanguage()
  const currentIndex = level ? QUIET_INSIDE_LEVELS.indexOf(level) : -1
  const stopColor =
    currentIndex >= 0 ? QUIET_INSIDE[level].color : QUIET_INSIDE.mixed.color
  const thumbPercent =
    currentIndex <= 0 ? 0 : (currentIndex / (QUIET_INSIDE_LEVELS.length - 1)) * 100
  const fillPercent = thumbPercent

  return (
    <div
      className="quiet-inside-scale"
      role="img"
      aria-label={
        level
          ? t(`calmShort.${level}`)
          : t('venueSignals.unavailable')
      }
    >
      <div className="quiet-inside-track">
        <div className="quiet-inside-rail" aria-hidden="true">
          <div
            className="quiet-inside-rail-fill"
            style={{
              width: `${fillPercent}%`,
              background: stopColor,
            }}
          />
        </div>
        {currentIndex >= 0 && (
          <span
            className="quiet-inside-thumb"
            style={{
              left: `${thumbPercent}%`,
              background: stopColor,
            }}
            aria-hidden
          />
        )}
      </div>

      <div className="quiet-inside-labels">
        <span
          className={`quiet-inside-end-label ${currentIndex === 0 ? 'active' : ''}`}
          style={{ '--stop-color': QUIET_INSIDE.lively.color }}
        >
          {t('calmShort.lively')}
        </span>
        <span
          className={`quiet-inside-end-label ${currentIndex === 2 ? 'active' : ''}`}
          style={{ '--stop-color': QUIET_INSIDE.calm.color }}
        >
          {t('calmShort.calm')}
        </span>
      </div>
    </div>
  )
}
