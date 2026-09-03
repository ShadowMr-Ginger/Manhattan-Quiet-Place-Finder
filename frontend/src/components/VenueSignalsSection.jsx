import { Car, HardHat, TrainFront, Volume2 } from 'lucide-react'
import { QuietInsideScale } from './QuietInsideScale'
import { BusynessRow } from './BusynessRow'
import { useLanguage } from '../language/useLanguage'
import {
  calmLabelToLevel,
  isConstructionHoursActive,
} from '../utils/venueSignalsDisplay'

const SIGNAL_ROWS = [
  { key: 'quietInside', icon: Volume2, tone: 'teal' },
  { key: 'areaNoise', icon: Car, tone: 'orange' },
  { key: 'happeningNearby', icon: HardHat, tone: 'amber' },
  { key: 'busyness', icon: TrainFront, tone: 'blue' },
]

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return null
  return Math.round(value).toLocaleString()
}

function QuietInsideRow({ calm }) {
  if (!calm?.show) return null

  const labelKey = calm.labelKey ?? 'mixed'
  const level = calmLabelToLevel(labelKey)

  return <QuietInsideScale level={level} />
}

function AreaNoiseRow({ areaNoise, t, formatMessage }) {
  if (!areaNoise) {
    return <p className="venue-signals-detail venue-signals-unavailable">{t('venueSignals.unavailable')}</p>
  }

  const parts = []
  if (areaNoise.roadDb != null) {
    parts.push(formatMessage(t('venueSignals.trafficDb'), { db: areaNoise.roadDb.toFixed(0) }))
  }
  if (areaNoise.complaintsPerYear != null) {
    parts.push(
      formatMessage(t('venueSignals.complaintsPerYear'), {
        count: formatNumber(areaNoise.complaintsPerYear),
        radius: areaNoise.radiusM ?? 100,
      }),
    )
  }

  if (!parts.length) {
    return <p className="venue-signals-detail venue-signals-unavailable">{t('venueSignals.unavailable')}</p>
  }

  return <p className="venue-signals-detail">{parts.join(' · ')}</p>
}

function HappeningNearbyRow({ happening, t, formatMessage }) {
  if (!happening) {
    return <p className="venue-signals-detail venue-signals-unavailable">{t('venueSignals.unavailable')}</p>
  }

  const parts = []
  const constructionActive = isConstructionHoursActive()
  const sites = happening.constructionSites150m

  if (sites != null && constructionActive) {
    parts.push(formatMessage(t('venueSignals.constructionSites'), { count: sites }))
  } else if (sites != null && sites > 0) {
    parts.push(t('venueSignals.constructionOffHours'))
  }

  const events = happening.events ?? []
  if (events.length > 0) {
    const first = events[0]
    parts.push(first.name ?? formatMessage(t('venueSignals.eventsNearby'), { count: happening.eventsCount ?? events.length }))
  } else if ((happening.eventsCount ?? 0) > 0) {
    parts.push(formatMessage(t('venueSignals.eventsNearby'), { count: happening.eventsCount }))
  } else {
    parts.push(t('venueSignals.noEventsThisWeek'))
  }

  return <p className="venue-signals-detail">{parts.join(' · ')}</p>
}

export function VenueSignalsSection({ signals, embedded = false, openingInfo }) {
  const { t, formatMessage } = useLanguage()

  if (!signals) return null

  const rowContent = {
    quietInside: <QuietInsideRow calm={signals.quietInside} />,
    areaNoise: <AreaNoiseRow areaNoise={signals.areaNoise} t={t} formatMessage={formatMessage} />,
    happeningNearby: <HappeningNearbyRow happening={signals.happeningNearby} t={t} formatMessage={formatMessage} />,
    busyness: (
      <BusynessRow
        busyness={signals.busyness}
        t={t}
        embedded={embedded}
        openingInfo={openingInfo}
      />
    ),
  }

  const visibleRows = SIGNAL_ROWS.filter((row) => {
    if (row.key === 'quietInside') return signals.quietInside?.show
    return true
  })

  if (!visibleRows.length) return null

  return (
    <section
      className={`venue-signals-section ${embedded ? 'venue-signals-section-embedded' : ''}`}
      aria-label={t('venueSignals.sectionTitle')}
    >
      {!embedded && (
        <div className="venue-detail-section-heading venue-signals-section-heading">
          <h3>{t('venueSignals.sectionTitle')}</h3>
        </div>
      )}
      {visibleRows.map(({ key, icon: Icon, tone }) => (
        <div key={key} className="venue-signals-row">
          <div className={`venue-signals-icon venue-signals-icon-${tone}`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
          <div className="venue-signals-body">
            <h3 className="venue-signals-title">{t(`venueSignals.${key}`)}</h3>
            {rowContent[key]}
          </div>
        </div>
      ))}
    </section>
  )
}
