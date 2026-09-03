import { ATTRIBUTE_KEYS } from '../data/constants'
import { useLanguage } from '../language/useLanguage'

/**
 * "What the reviews say" — per-attribute positive/neutral/negative mention counts
 * from the editorial extraction pipeline.
 *
 * Gate is n >= 1, not the n >= 2 in the original mockup. At n >= 2, 209 of 326
 * venues (64%) would render an empty section; at n >= 1 only 25 (8%) do, with a
 * median of 3 rows. The count shown on the right is the confidence cue, so
 * gating on top of it just discards data.
 */
function toRow(key, score) {
  const positive = score?.positive ?? 0
  const neutral = score?.neutral ?? 0
  const negative = score?.negative ?? 0
  const n = score?.n ?? positive + neutral + negative
  if (n < 1) return null
  return { key, positive, neutral, negative, n, note: score?.note ?? null }
}

function buildAttributeRows(attributeScores = {}) {
  return ATTRIBUTE_KEYS.map((key) => toRow(key, attributeScores?.[key])).filter(
    Boolean,
  )
}

export function VenueAttributesSection({ attributeScores }) {
  const { t } = useLanguage()
  const rows = buildAttributeRows(attributeScores)

  if (!rows.length) return null

  // Bar width is proportional to mention volume, so a 9-mention attribute reads
  // as more substantiated than a 1-mention one at a glance.
  const maxN = Math.max(...rows.map((row) => row.n))

  return (
    <section className="venue-attribute-section">
      <div className="venue-detail-section-heading">
        <h3>{t('editorialAmenitiesTitle')}</h3>
      </div>

      <div className="venue-attribute-legend">
        <span className="venue-attribute-legend-source">
          {t('attributeLegendSource')}
        </span>
        <span className="venue-attribute-legend-items">
          <span className="venue-attribute-legend-item">
            <span className="venue-attribute-legend-swatch venue-attribute-segment-positive" />
            {t('attributeLegendPositive')}
          </span>
          <span className="venue-attribute-legend-item">
            <span className="venue-attribute-legend-swatch venue-attribute-segment-neutral" />
            {t('attributeLegendNeutral')}
          </span>
          <span className="venue-attribute-legend-item">
            <span className="venue-attribute-legend-swatch venue-attribute-segment-negative" />
            {t('attributeLegendNegative')}
          </span>
          <span>{t('attributeLegendMentions')}</span>
        </span>
      </div>

      <div className="venue-attribute-rows">
        {rows.map(({ key, positive, neutral, negative, n, note }) => {
          const label = t(`attributes.${key}`)
          const fillPercent = maxN > 0 ? (n / maxN) * 100 : 0
          const segment = (count) => `${(count / n) * 100}%`

          return (
            <div
              key={key}
              className="venue-attribute-row"
              title={note ? `${label}: ${note}` : undefined}
            >
              <span className="venue-attribute-label">{label}</span>
              <div
                className="venue-attribute-bar-track"
                role="img"
                aria-label={`${label}: ${positive} positive, ${neutral} neutral, ${negative} negative`}
              >
                <div
                  className="venue-attribute-bar-fill"
                  style={{ width: `${fillPercent}%` }}
                >
                  {positive > 0 && (
                    <span
                      className="venue-attribute-segment venue-attribute-segment-positive"
                      style={{ width: segment(positive) }}
                    />
                  )}
                  {neutral > 0 && (
                    <span
                      className="venue-attribute-segment venue-attribute-segment-neutral"
                      style={{ width: segment(neutral) }}
                    />
                  )}
                  {negative > 0 && (
                    <span
                      className="venue-attribute-segment venue-attribute-segment-negative"
                      style={{ width: segment(negative) }}
                    />
                  )}
                </div>
              </div>
              <span className="venue-attribute-count">{n}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
