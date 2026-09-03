import { useMemo, useState } from 'react'
import { BusynessForecastChart } from './BusynessForecastChart'
import { useLanguage } from '../language/useLanguage'
import { buildBusynessForecastFromHourly } from '../utils/busynessForecast'
import { buildClosedFlags } from '../utils/openingHours'

export function BusynessRow({ busyness, t, embedded, openingInfo }) {
  const { formatMessage } = useLanguage()
  const [selectedKey, setSelectedKey] = useState('now')

  const forecast = useMemo(
    () => buildBusynessForecastFromHourly(busyness),
    [busyness],
  )

  // Undefined when hours are unknown, leaving the chart unshaded rather than
  // guessing that a venue with no published hours is closed.
  const closedFlags = useMemo(
    () => buildClosedFlags(forecast?.chart, openingInfo),
    [openingInfo, forecast],
  )

  if (!forecast?.chart?.length) {
    return (
      <p className="venue-signals-detail venue-signals-unavailable">
        {t('venueSignals.unavailable')}
      </p>
    )
  }

  const peakLabel =
    forecast.peakHour != null
      ? formatMessage(t('venueSignals.busynessPeakAt'), {
          time: forecast.chart.find((bar) => bar.hour === forecast.peakHour)?.label
            ?? `${String(forecast.peakHour).padStart(2, '0')}:00`,
        })
      : null

  return (
    <div className="busyness-forecast">
      <BusynessForecastChart
        chart={forecast.chart}
        variant={forecast.variant}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        ariaLabel={t('venueSignals.busynessForecast')}
        nowLabel={t('timeNow')}
        closedFlags={closedFlags}
      />

      <p className="venue-signals-detail venue-signals-note">
        {t('venueSignals.busynessSource')}
        {peakLabel ? ` · ${peakLabel}` : ''}
      </p>

      {!embedded && forecast.lowConfidence && (
        <p className="venue-signals-detail venue-signals-note">
          {t('venueSignals.lowConfidence')}
        </p>
      )}
    </div>
  )
}
