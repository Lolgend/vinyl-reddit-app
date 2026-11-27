import React from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import type { ExtractionQueueStatus } from '../../types/admin'
import { formatRelativeToNow, formatWaitingDuration } from '../../utils/adminFormat'
import { StackedProgressBar, type StackedProgressSegment } from './StackedProgressBar'

interface ExtractionQueueCardProps {
  queue: ExtractionQueueStatus
  nowMs: number
}

export const ExtractionQueueCard: React.FC<ExtractionQueueCardProps> = ({
  queue,
  nowMs,
}) => {
  const segments: StackedProgressSegment[] = [
    {
      key: 'extracted',
      barTestId: 'extraction-bar-extracted',
      label: 'Extracted Releases',
      count: queue.extracted_releases,
      colorClass: 'bg-hype-high',
    },
    {
      key: 'filtered',
      barTestId: 'extraction-bar-filtered',
      label: 'Filtered Non-Releases',
      count: queue.filtered_non_releases,
      colorClass: 'bg-accent-sand',
    },
    {
      key: 'pending',
      barTestId: 'extraction-bar-pending',
      label: 'Pending',
      count: queue.pending,
      colorClass: 'bg-hype-moderate',
    },
  ]

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

        {/* 3-Segment Stacked Neo-Brutalist Progress Bar & Legend */}
        <StackedProgressBar
          segments={segments}
          total={queue.total}
          ariaLabel="Extraction Queue completion"
          valueNow={queue.completion_pct}
          barTestId="extraction-progress-bar"
          legendTestId="extraction-queue-legend"
          legendGridClassName="grid grid-cols-1 sm:grid-cols-3 gap-2"
          legendLayout="inline"
        />
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
