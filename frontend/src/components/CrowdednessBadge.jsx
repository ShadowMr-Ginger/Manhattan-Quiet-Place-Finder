import { CROWDEDNESS } from '../data/constants'
import { useLanguage } from '../language/useLanguage'

export function CrowdednessBadge({ level, size = 'md', showDot = false }) {
  const { t } = useLanguage()
  const config = CROWDEDNESS[level]
  if (!config) return null

  return (
    <span
      className={`crowd-badge ${size === 'sm' ? 'crowd-badge-sm' : ''}`}
      style={{
        color: config.color,
        borderColor: config.color,
        background: `${config.color}18`,
      }}
    >
      {showDot && (
        <span className="crowd-dot" style={{ background: config.color }} />
      )}
      {t(`crowdednessShort.${level}`)}
    </span>
  )
}
