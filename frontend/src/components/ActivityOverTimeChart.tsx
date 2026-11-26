import React, { useState } from 'react'
import { formatRelativeTime } from '../utils/formatTime'
import type { HypeWindow } from './EntityEditorialHeader'

export interface TimeSeriesBucket {
  bucket_start: string
  bucket_end: string
  cumulative_points: number
  velocity_pts_per_hr: number
  timestamp: string
  points: number
  velocity: number
}

export interface SubmissionMarker {
  timestamp: string
  submission_id: string
  title: string
}

export interface ActivityOverTimeChartProps {
  window: HypeWindow
  timeSeries: TimeSeriesBucket[]
  submissionMarkers: SubmissionMarker[]
  hasActivity: boolean
  lastSeenDisplay: string
  subtitle: string
  className?: string
}

function formatAxisTick(iso: string, window: HypeWindow): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (window === '24H') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: true,
    }).format(date)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatTooltipTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function computeTickIndices(numBuckets: number): number[] {
  if (numBuckets <= 1) return []
  if (numBuckets === 2) return [0]

  const candidates = [
    0,
    Math.round((numBuckets - 1) * 0.25),
    Math.round((numBuckets - 1) * 0.5),
    Math.round((numBuckets - 1) * 0.75),
  ]

  const seen = new Set<number>()
  const result: number[] = []
  for (const idx of candidates) {
    if (idx < numBuckets - 1 && !seen.has(idx)) {
      if (result.length === 0 || idx - result[result.length - 1] >= 2) {
        if (numBuckets - 1 - idx >= 2) {
          seen.add(idx)
          result.push(idx)
        }
      }
    }
  }
  return result
}

/**
 * Simplified single-curve cumulative Engagement time-series chart with readable
 * time/date ticks, interactive interval tooltip, non-overlapping Mention markers,
 * and plain-English zero-activity state.
 */
export const ActivityOverTimeChart: React.FC<ActivityOverTimeChartProps> = ({
  window,
  timeSeries,
  submissionMarkers,
  hasActivity,
  lastSeenDisplay,
  subtitle,
  className = '',
}) => {
  const [activeBucketIndex, setActiveBucketIndex] = useState<number | null>(null)
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)

  const chartWidth = 720
  const chartHeight = 180
  const padLeft = 62
  const padTop = 26
  const padRight = 20
  const padBottom = 36
  const totalWidth = padLeft + chartWidth + padRight
  const totalHeight = padTop + chartHeight + padBottom

  const numBuckets = timeSeries.length
  const maxPts = Math.max(...timeSeries.map((b) => b.cumulative_points), 10)

  const points = timeSeries.map((bucket, i) => {
    const x =
      numBuckets <= 1
        ? padLeft + chartWidth
        : padLeft + (i / (numBuckets - 1)) * chartWidth
    const y = hasActivity
      ? padTop + chartHeight - (bucket.cumulative_points / maxPts) * chartHeight
      : padTop + chartHeight
    return { x, y, bucket }
  })

  let linePathD = ''
  let areaPathD = ''

  if (!hasActivity) {
    linePathD = `M ${padLeft} ${padTop + chartHeight} L ${padLeft + chartWidth} ${padTop + chartHeight}`
  } else if (numBuckets === 1) {
    const y = points[0].y
    linePathD = `M ${padLeft} ${y} L ${padLeft + chartWidth} ${y}`
    areaPathD = `M ${padLeft} ${padTop + chartHeight} L ${padLeft} ${y} L ${padLeft + chartWidth} ${y} L ${padLeft + chartWidth} ${padTop + chartHeight} Z`
  } else if (numBuckets > 1) {
    linePathD = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
    areaPathD = `M ${padLeft} ${padTop + chartHeight} ${points
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${padLeft + chartWidth} ${padTop + chartHeight} Z`
  }

  const tickIndices = computeTickIndices(numBuckets)

  const t0 = numBuckets > 0 ? new Date(timeSeries[0].bucket_start).getTime() : 0
  const tN = numBuckets > 0 ? new Date(timeSeries[numBuckets - 1].bucket_end).getTime() : 1
  const positionedMarkers =
    hasActivity && numBuckets > 0
      ? submissionMarkers.map((marker, idx) => {
          const tm = new Date(marker.timestamp).getTime()
          const ratio = Math.max(0, Math.min(1, (tm - t0) / Math.max(1, tN - t0)))
          const x = padLeft + ratio * chartWidth
          return { marker, idx, x }
        })
      : []

  const markerPositionsWithY = positionedMarkers.map((item, i) => {
    let overlapCount = 0
    for (let j = 0; j < i; j++) {
      if (Math.abs(positionedMarkers[j].x - item.x) < 16) {
        overlapCount += 1
      }
    }
    const y = padTop + 6 + (overlapCount % 3) * 11
    return { ...item, y }
  })

  const activePoint =
    activeBucketIndex !== null && points[activeBucketIndex] ? points[activeBucketIndex] : null
  const activeMarker =
    activeMarkerIndex !== null && markerPositionsWithY[activeMarkerIndex]
      ? markerPositionsWithY[activeMarkerIndex]
      : null

  return (
    <div
      className={`bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between ${className}`.trim()}
      data-testid="activity-over-time-chart"
    >
      <div>
        <div className="font-grotesk font-bold text-lg text-[#121212] mb-1">
          Activity Over Time
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">{subtitle}</p>

        {!hasActivity && (
          <div
            className="mb-4 bg-[#FAF7F5] border-[1.5px] border-dashed border-[#121212] p-3 text-center rounded-[4px] font-mono text-xs text-[#646464]"
            data-testid="zero-activity-callout"
          >
            NO NEW ACTIVITY IN {window} — LAST SEEN {lastSeenDisplay}
          </div>
        )}

        <div className="relative w-full overflow-x-auto">
          {activePoint && (
            <div
              role="status"
              data-testid="chart-tooltip"
              className="pointer-events-none absolute top-1 z-20 -translate-x-1/2 rounded-[4px] border-[1.5px] border-[#121212] bg-[#121212] px-2.5 py-1.5 font-mono text-[11px] text-white shadow-brutal-sm whitespace-nowrap"
              style={{
                left: `${Math.min(84, Math.max(16, (activePoint.x / totalWidth) * 100))}%`,
              }}
            >
              <div className="text-[#E5E0DA]">
                {formatTooltipTimestamp(activePoint.bucket.bucket_end || activePoint.bucket.timestamp)}
              </div>
              <div className="font-bold">
                {(hasActivity ? activePoint.bucket.cumulative_points : 0).toLocaleString()} engagement
              </div>
            </div>
          )}

          {activeMarker && (
            <div
              role="status"
              data-testid="mention-marker-tooltip"
              className="pointer-events-none absolute top-1 z-20 -translate-x-1/2 max-w-[280px] rounded-[4px] border-[1.5px] border-[#121212] bg-white px-2.5 py-1.5 font-mono text-[11px] text-[#121212] shadow-brutal-sm"
              style={{
                left: `${Math.min(82, Math.max(18, (activeMarker.x / totalWidth) * 100))}%`,
              }}
            >
              <div className="font-bold truncate">{activeMarker.marker.title}</div>
              <div className="text-[#646464]">
                Mention · {formatRelativeTime(activeMarker.marker.timestamp)}
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
            className="w-full h-auto min-w-[500px]"
            onMouseLeave={() => {
              setActiveBucketIndex(null)
              setActiveMarkerIndex(null)
            }}
          >
            {/* Y-Axis Label */}
            <text
              x={14}
              y={padTop + chartHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${padTop + chartHeight / 2})`}
              className="font-mono text-[10px] font-semibold fill-[#646464] uppercase tracking-wider"
            >
              Engagement
            </text>

            {/* Background Grid Lines & Y-Axis Ticks */}
            {[0, 0.5, 1].map((pct) => {
              const y = padTop + chartHeight - pct * chartHeight
              const ptsVal = hasActivity ? Math.round(pct * maxPts) : 0
              return (
                <g key={pct}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + chartWidth}
                    y2={y}
                    stroke="#E5E0DA"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="font-mono text-[10px] fill-[#646464]"
                  >
                    {ptsVal}
                  </text>
                </g>
              )
            })}

            {/* Subtle Area Fill under Cumulative Engagement Curve */}
            {hasActivity && areaPathD && (
              <path d={areaPathD} fill="#9B6DFF" fillOpacity="0.1" />
            )}

            {/* Single Cumulative Engagement Line */}
            {linePathD && (
              <path
                d={linePathD}
                fill="none"
                stroke="#121212"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Active Interval Guide & Point */}
            {activePoint && (
              <g pointerEvents="none">
                <line
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={padTop + chartHeight}
                  stroke="#9B6DFF"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4.5"
                  fill="#9B6DFF"
                  stroke="#121212"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Interactive Interval Hit Targets (Hover & Keyboard Focus) */}
            {points.map((p, i) => {
              const prevX = i === 0 ? padLeft : (points[i - 1].x + p.x) / 2
              const nextX =
                i === points.length - 1 ? padLeft + chartWidth : (p.x + points[i + 1].x) / 2
              const bandX = Math.max(padLeft, prevX)
              const bandW = Math.max(4, nextX - bandX)
              const engagementCount = hasActivity ? p.bucket.cumulative_points : 0
              const tsLabel = formatTooltipTimestamp(p.bucket.bucket_end || p.bucket.timestamp)

              return (
                <rect
                  key={`interval-${i}`}
                  x={bandX}
                  y={padTop}
                  width={bandW}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-crosshair focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${tsLabel}: ${engagementCount} engagement`}
                  data-testid={`chart-interval-${i}`}
                  onMouseEnter={() => {
                    setActiveMarkerIndex(null)
                    setActiveBucketIndex(i)
                  }}
                  onMouseLeave={() => {
                    setActiveBucketIndex((curr) => (curr === i ? null : curr))
                  }}
                  onFocus={() => {
                    setActiveMarkerIndex(null)
                    setActiveBucketIndex(i)
                  }}
                  onBlur={() => {
                    setActiveBucketIndex((curr) => (curr === i ? null : curr))
                  }}
                />
              )
            })}

            {/* Tidy, Non-Overlapping Mention Markers */}
            {markerPositionsWithY.map(({ marker, idx, x, y }) => (
              <g key={`marker-${marker.submission_id || idx}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartHeight}
                  stroke="#F56565"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill="#F56565"
                  stroke="#121212"
                  strokeWidth="1.5"
                  className="cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`Mention: ${marker.title} (${formatRelativeTime(marker.timestamp)})`}
                  data-testid={`mention-marker-${idx}`}
                  onMouseEnter={() => {
                    setActiveBucketIndex(null)
                    setActiveMarkerIndex(idx)
                  }}
                  onMouseLeave={() => {
                    setActiveMarkerIndex((curr) => (curr === idx ? null : curr))
                  }}
                  onFocus={() => {
                    setActiveBucketIndex(null)
                    setActiveMarkerIndex(idx)
                  }}
                  onBlur={() => {
                    setActiveMarkerIndex((curr) => (curr === idx ? null : curr))
                  }}
                >
                  <title>{`${marker.title} (${formatRelativeTime(marker.timestamp)})`}</title>
                </circle>
              </g>
            ))}

            {/* X-Axis Baseline */}
            <line
              x1={padLeft}
              y1={padTop + chartHeight}
              x2={padLeft + chartWidth}
              y2={padTop + chartHeight}
              stroke="#121212"
              strokeWidth="1.5"
            />

            {/* Readable X-Axis Timestamp Ticks */}
            {numBuckets > 0 && (
              <>
                {tickIndices.map((idx) => {
                  const p = points[idx]
                  const label = formatAxisTick(p.bucket.bucket_end || p.bucket.timestamp, window)
                  if (!label) return null
                  return (
                    <text
                      key={`tick-${idx}`}
                      x={p.x}
                      y={padTop + chartHeight + 18}
                      textAnchor={idx === 0 ? 'start' : 'middle'}
                      className="font-mono text-[10px] fill-[#646464]"
                      data-testid={`x-axis-tick-${idx}`}
                    >
                      {label}
                    </text>
                  )
                })}
                <text
                  x={padLeft + chartWidth}
                  y={padTop + chartHeight + 18}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-[#121212] font-bold"
                >
                  NOW
                </text>
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Plain-English Chart Legend */}
      <div className="flex flex-wrap items-center gap-5 mt-4 pt-3 border-t border-[#E5E0DA] font-mono text-[11px] text-[#646464]">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 bg-[#121212]" />
          <span>Cumulative Engagement</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F56565] border border-[#121212]" />
          <span>Mention</span>
        </div>
      </div>
    </div>
  )
}
