import { useId, useMemo, useState } from 'react'
import { CROWDEDNESS } from '../data/constants'
import { useLanguage } from '../language/useLanguage'

const LINE_WIDTH = 320
const LINE_HEIGHT = 118
const PAD = { top: 24, right: 12, bottom: 28, left: 12 }

function BarsChart({ chart, selectedKey, onSelect }) {
  const maxPct = Math.max(...chart.map((bar) => bar.busynessPct ?? 0), 1)

  return (
    <div className="busyness-forecast-bars">
      {chart.map((bar) => {
        const level = bar.level ?? 'medium'
        const color = CROWDEDNESS[level]?.color ?? CROWDEDNESS.medium.color
        const heightPct = Math.max(8, ((bar.busynessPct ?? 0) / maxPct) * 100)
        const selected = bar.key === selectedKey

        return (
          <button
            key={bar.key}
            type="button"
            className={`busyness-forecast-bar ${selected ? 'selected' : ''}`}
            onClick={() => onSelect?.(bar.key)}
            aria-pressed={selected}
            title={bar.label}
          >
            <span className="busyness-forecast-bar-value" style={{ color }}>
              {bar.busynessPct != null ? Math.round(bar.busynessPct) : '—'}
            </span>
            <span
              className="busyness-forecast-bar-fill"
              style={{
                height: `${heightPct}%`,
                background: color,
              }}
            />
            <span className={`busyness-forecast-bar-label ${selected ? 'active' : ''}`}>
              {bar.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function levelColor(level) {
  return CROWDEDNESS[level ?? 'medium']?.color ?? CROWDEDNESS.medium.color
}

/**
 * Contiguous runs of closed hours, as x-ranges for background shading.
 *
 * Neutral grey rather than red on purpose: the curve is *area* foot traffic,
 * which stays valid when the venue is shut — the street is still busy. Red
 * would both collide with red = very busy on the same chart and imply the data
 * is wrong. Grey reads as "still true, just not useful to you".
 */
function buildClosedBands(points, closedFlags) {
  if (!Array.isArray(closedFlags) || closedFlags.length !== points.length) {
    return []
  }

  const bands = []
  let runStart = null

  for (let i = 0; i <= points.length; i += 1) {
    const closed = i < points.length && closedFlags[i] === true
    if (closed && runStart === null) runStart = i
    if (!closed && runStart !== null) {
      // Extend half a step either side so the band meets its neighbours.
      const prev = points[runStart - 1]
      const next = points[i]
      const first = points[runStart]
      const last = points[i - 1]
      const x1 = prev ? (prev.x + first.x) / 2 : first.x
      const x2 = next ? (last.x + next.x) / 2 : last.x
      bands.push({ key: `closed-${runStart}`, x: x1, width: Math.max(x2 - x1, 0) })
      runStart = null
    }
  }

  return bands
}

function LineChart({ chart, selectedKey, onSelect, nowLabel, closedFlags }) {
  const { t } = useLanguage()
  const strokeGradientId = useId().replace(/:/g, '')
  const areaGradientId = `${strokeGradientId}-area`
  const [hoverKey, setHoverKey] = useState(null)

  const { points, linePath, areaPath, labelStep } = useMemo(() => {
    const maxPct = Math.max(...chart.map((bar) => bar.busynessPct ?? 0), 1)
    const innerW = LINE_WIDTH - PAD.left - PAD.right
    const innerH = LINE_HEIGHT - PAD.top - PAD.bottom
    const n = Math.max(chart.length - 1, 1)

    const nextPoints = chart.map((bar, index) => {
      const x = PAD.left + (index / n) * innerW
      const y = PAD.top + innerH - ((bar.busynessPct ?? 0) / maxPct) * innerH
      return { ...bar, x, y, color: levelColor(bar.level) }
    })

    const nextLine = nextPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ')

    const nextArea = nextPoints.length
      ? `${nextLine} L${nextPoints[nextPoints.length - 1].x.toFixed(1)} ${LINE_HEIGHT - PAD.bottom} L${nextPoints[0].x.toFixed(1)} ${LINE_HEIGHT - PAD.bottom} Z`
      : ''

    return {
      points: nextPoints,
      linePath: nextLine,
      areaPath: nextArea,
      labelStep: nextPoints.length > 16 ? 4 : nextPoints.length > 10 ? 3 : 2,
    }
  }, [chart])

  const activeKey = hoverKey ?? selectedKey
  const activePoint = points.find((point) => point.key === activeKey) ?? points[0]
  const activeColor = activePoint?.color ?? levelColor('medium')
  const closedBands = useMemo(
    () => buildClosedBands(points, closedFlags),
    [points, closedFlags],
  )

  return (
    <div
      className="busyness-forecast-line-wrap"
      onMouseLeave={() => setHoverKey(null)}
    >
      <svg
        className="busyness-forecast-line-svg"
        viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={strokeGradientId}
            gradientUnits="userSpaceOnUse"
            x1={PAD.left}
            y1="0"
            x2={LINE_WIDTH - PAD.right}
            y2="0"
          >
            {points.map((point, index) => (
              <stop
                key={`stroke-${point.key}`}
                offset={`${points.length <= 1 ? 0 : (index / (points.length - 1)) * 100}%`}
                stopColor={point.color}
              />
            ))}
          </linearGradient>
          <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {closedBands.map((band) => (
          <rect
            key={band.key}
            className="busyness-forecast-closed-band"
            x={band.x}
            y={PAD.top - 6}
            width={band.width}
            height={LINE_HEIGHT - PAD.top - PAD.bottom + 6}
          />
        ))}

        <path d={areaPath} fill={`url(#${areaGradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${strokeGradientId})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => {
          const isActive = point.key === activeKey
          const showLabel =
            index === 0 ||
            index === points.length - 1 ||
            index % labelStep === 0

          return (
            <g key={point.key}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 5 : 3}
                fill={point.color}
                stroke={isActive ? 'var(--bg-card, #fff)' : 'rgba(255,255,255,0.85)'}
                strokeWidth={isActive ? 2 : 1}
              />
              {showLabel && (
                <text
                  x={point.x}
                  y={LINE_HEIGHT - 8}
                  // The series starts at the current NYC hour, so the leftmost
                  // tick is "now" — labelling it as such is clearer than a
                  // marker line on an axis that is already anchored to now.
                  textAnchor={index === 0 ? 'start' : 'middle'}
                  className={`busyness-forecast-line-axis ${isActive ? 'active' : ''} ${index === 0 ? 'is-now' : ''}`}
                  style={isActive && index !== 0 ? { fill: point.color } : undefined}
                >
                  {index === 0 ? nowLabel : point.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="busyness-forecast-line-hitboxes">
        {points.map((point) => {
          const isHovered = hoverKey === point.key
          const isActive = point.key === activeKey

          return (
            <button
              key={point.key}
              type="button"
              className={`busyness-forecast-line-hit ${isActive ? 'active' : ''}`}
              style={
                isActive
                  ? {
                      background: `linear-gradient(180deg, ${point.color}22 0%, ${point.color}05 100%)`,
                    }
                  : undefined
              }
              onMouseEnter={() => setHoverKey(point.key)}
              onFocus={() => setHoverKey(point.key)}
              onClick={() => onSelect?.(point.key)}
              aria-label={`${point.label}: ${point.busynessPct != null ? Math.round(point.busynessPct) : 'unavailable'}`}
              aria-pressed={point.key === selectedKey}
            >
              {isHovered && (
                <span
                  className="busyness-forecast-tooltip"
                  style={{
                    '--tooltip-accent': point.color,
                    '--tooltip-accent-soft': `${point.color}22`,
                  }}
                  role="tooltip"
                >
                  <span className="busyness-forecast-tooltip-accent" />
                  <span className="busyness-forecast-tooltip-body">
                    <span className="busyness-forecast-tooltip-time">
                      {point.key === 'now' && nowLabel ? nowLabel : point.label}
                      {point.key === 'now' && nowLabel ? (
                        <span className="busyness-forecast-tooltip-sub">{point.label}</span>
                      ) : null}
                    </span>
                    <span className="busyness-forecast-tooltip-metric">
                      <span className="busyness-forecast-tooltip-value">
                        {point.busynessPct != null ? Math.round(point.busynessPct) : '—'}
                      </span>
                    </span>
                    <span
                      className="busyness-forecast-tooltip-level"
                      style={{
                        color: point.color,
                        background: 'var(--tooltip-accent-soft)',
                      }}
                    >
                      {t(`crowdednessShort.${point.level ?? 'medium'}`)}
                    </span>
                  </span>
                  <span className="busyness-forecast-tooltip-caret" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BusynessForecastChart({
  chart = [],
  selectedKey,
  onSelect,
  ariaLabel,
  variant = 'bars',
  nowLabel,
  closedFlags,
}) {
  if (!chart.length) return null

  const useLine = variant === 'line' || chart.length >= 12

  return (
    <div className="busyness-forecast-chart" role="group" aria-label={ariaLabel}>
      {useLine ? (
        <LineChart
          chart={chart}
          selectedKey={selectedKey}
          onSelect={onSelect}
          nowLabel={nowLabel}
          closedFlags={closedFlags}
        />
      ) : (
        <BarsChart chart={chart} selectedKey={selectedKey} onSelect={onSelect} />
      )}
    </div>
  )
}
