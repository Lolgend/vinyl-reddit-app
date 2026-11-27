import React from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import type { ExtractionQueueStatus } from '../../types/admin'
import { formatRelativeToNow, formatWaitingDuration } from '../../utils/adminFormat'

interface ExtractionQueueCardProps {
  queue: ExtractionQueueStatus
  nowMs: number
}

function segmentWidthPct(count: number, total: number): string {
  if (total <= 0 || count <= 0) return '0%'
  const pct = (count / total) * 100
  return `${Number(pct.toFixed(4))}%`
}

export const ExtractionQueueCard: React.FC<ExtractionQueueCardProps> = ({
  queue,
  nowMs,
}) => {
  const segments = [
    {
      key: 'extracted',
      testId: 'extraction-bar-extracted',
      label: 'Extracted Releases',
      count: queue.extracted_releases,
      colorClass: 'bg-hype-high',
      width: segmentWidthPct(queue.extracted_releases, queue.total),
    },
    {
      key: 'filtered',
      testId: 'extraction-bar-filtered',
      label: 'Filtered Non-Releases',
      count: queue.filtered_non_releases,
      colorClass: 'bg-accent-sand',
      width: segmentWidthPct(queue.filtered_non_releases, queue.total),
    },
    {
      key: 'pending',
      testId: 'extraction-bar-pending',
      label: 'Pending',
      count: queue.pending,
      colorClass: 'bg-hype-moderate',
      width: segmentWidthPct(queue.pending, queue.total),
    },
  ]

  const visibleSegments = segments.filter((seg) => seg.count > 0)

  return (
    <article
      className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between gap-4"
      data-testid="extraction-queue-card"
    >
      <div className="flex flex-col gap-4">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-grotesk font-bold text-lg text-ink-primary leading-tight">
              Extraction Queue
            </h2>
            <p className="font-sans text-xs text-ink-secondary mt-0.5">
              Release-eligible posts awaiting catalog extraction
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono text-2xl font-bold text-ink-primary leading-none">
              {queue.completion_pct.toFixed(1)}%
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary mt-1">
              {queue.total.toLocaleString()} total
            </div>
          </div>
        </div>

        {/* 3-Segment Stacked Neo-Brutalist Progress Bar */}
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Extraction Queue completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={queue.completion_pct}
            className="h-6 w-full rounded-[4px] border-strong bg-canvas overflow-hidden flex"
            data-testid="extraction-progress-bar"
          >
            {visibleSegments.map((seg, idx) => (
              <div
                key={seg.key}
                data-testid={seg.testId}
                title={`${seg.label}: ${seg.count.toLocaleString()}`}
                style={{ width: seg.width }}
                className={`h-full ${seg.colorClass} transition-all duration-300 ${
                  idx < visibleSegments.length - 1 ? 'border-r-[1.5px] border-ink-primary' : ''
                }`}
              />
            ))}
          </div>

          {/* Exact Counts Legend */}
          <dl
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1"
            data-testid="extraction-queue-legend"
          >
            {segments.map((seg) => (
              <div
                key={seg.key}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[4px] bg-canvas border border-border-hairline"
              >
                <dt className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-3 h-3 rounded-[2px] border-[1.5px] border-ink-primary shrink-0 ${seg.colorClass}`}
                    aria-hidden="true"
                  />
                  <span className="font-sans text-xs text-ink-secondary truncate">
                    {seg.label}
                  </span>
                </dt>
                <dd className="font-mono text-xs font-bold text-ink-primary shrink-0">
                  {seg.count.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Queue Lag or Clear Status Footer */}
      {queue.pending > 0 && queue.oldest_pending_at ? (
        <div
          className="bg-hype-moderate/25 border-strong rounded-[4px] px-3 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-xs"
          data-testid="extraction-queue-lag"
        >
          <span className="inline-flex items-center gap-1.5 font-bold text-ink-primary">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              OLDEST PENDING LAG: {formatWaitingDuration(queue.oldest_pending_at, nowMs)}
            </span>
          </span>
          <span
            className="text-ink-secondary text-[11px]"
            title={queue.oldest_pending_at}
          >
            Posted {formatRelativeToNow(queue.oldest_pending_at, nowMs)}
          </span>
        </div>
      ) : (
        <div
          className="bg-hype-high/20 border-strong rounded-[4px] px-3 py-2 flex items-center gap-2 font-mono text-xs font-semibold text-ink-primary"
          data-testid="extraction-queue-clear"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Queue clear — 0 release-eligible posts waiting</span>
        </div>
      )}
    </article>
  )
}
