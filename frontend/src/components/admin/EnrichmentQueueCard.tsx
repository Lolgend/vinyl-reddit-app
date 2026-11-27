import React from 'react'
import type { EnrichmentQueueStatus } from '../../types/admin'
import { StackedProgressBar, type StackedProgressSegment } from './StackedProgressBar'

interface EnrichmentQueueCardProps {
  queue: EnrichmentQueueStatus
}

export const EnrichmentQueueCard: React.FC<EnrichmentQueueCardProps> = ({ queue }) => {
  const segments: StackedProgressSegment[] = [
    {
      key: 'matched',
      label: 'Matched',
      count: queue.matched,
      barTestId: 'enrichment-bar-matched',
      countTestId: 'enrichment-count-matched',
      colorClass: 'bg-hype-high',
    },
    {
      key: 'partial_matched',
      label: 'Partial Matched',
      count: queue.partial_matched,
      barTestId: 'enrichment-bar-partial',
      countTestId: 'enrichment-count-partial',
      colorClass: 'bg-accent-primary',
    },
    {
      key: 'not_found',
      label: 'Not Found',
      count: queue.not_found,
      barTestId: 'enrichment-bar-not-found',
      countTestId: 'enrichment-count-not-found',
      colorClass: 'bg-accent-sand',
    },
    {
      key: 'pending',
      label: 'Pending',
      count: queue.pending,
      barTestId: 'enrichment-bar-pending',
      countTestId: 'enrichment-count-pending',
      colorClass: 'bg-hype-moderate',
    },
    {
      key: 'failed',
      label: 'Failed',
      count: queue.failed_total,
      barTestId: 'enrichment-bar-failed',
      countTestId: 'enrichment-count-failed',
      colorClass: 'bg-alert-coral',
    },
  ]

  const progressSummary = `Enrichment Queue ${queue.resolved_pct.toFixed(1)}% resolved: ${queue.matched} matched, ${queue.partial_matched} partial matched, ${queue.not_found} not found, ${queue.pending} pending, ${queue.failed_total} failed out of ${queue.total} albums`

  return (
    <article
      className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col gap-4"
      data-testid="enrichment-queue-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-grotesk font-bold text-lg text-ink-primary leading-tight">
            Enrichment Queue
          </h2>
          <p className="font-sans text-xs text-ink-secondary mt-0.5">
            External discography matching &amp; retry status across catalog albums
          </p>
        </div>

        <div className="text-right shrink-0">
          <div
            className="font-mono text-2xl font-bold text-ink-primary leading-none"
            data-testid="enrichment-resolved-pct"
          >
            {queue.resolved_pct.toFixed(1)}%
          </div>
          <div className="font-mono text-[11px] uppercase text-ink-secondary mt-1">
            Resolved · {queue.total.toLocaleString()} Albums
          </div>
        </div>
      </div>

      {/* 5-Segment Neo-Brutalist Stacked Progress Bar & Legend */}
      <StackedProgressBar
        segments={segments}
        total={queue.total}
        ariaLabel={progressSummary}
        valueNow={queue.resolved_pct}
        barTestId="enrichment-progress-bar"
        legendGridClassName="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
        legendLayout="stacked"
      />

      {/* Actionable Retry & Re-check Breakdown Callouts */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-border-hairline"
        data-testid="enrichment-breakdown-callouts"
      >
        <div
          className={`rounded-[4px] border-strong px-3 py-2 flex flex-col gap-0.5 ${
            queue.failed_due > 0 ? 'bg-hype-moderate/35' : 'bg-canvas'
          }`}
          data-testid="enrichment-callout-due"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
            Due Now
          </span>
          <span className="font-mono text-lg font-bold text-ink-primary leading-tight">
            {queue.failed_due.toLocaleString()}
          </span>
        </div>

        <div
          className="rounded-[4px] border-strong px-3 py-2 bg-canvas flex flex-col gap-0.5"
          data-testid="enrichment-callout-backoff"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
            In Backoff
          </span>
          <span className="font-mono text-lg font-bold text-ink-primary leading-tight">
            {queue.failed_backoff.toLocaleString()}
          </span>
        </div>

        <div
          className={`rounded-[4px] border-strong px-3 py-2 flex flex-col gap-0.5 ${
            queue.failed_exhausted > 0 ? 'bg-alert-coral/35' : 'bg-canvas'
          }`}
          data-testid="enrichment-callout-exhausted"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
            Exhausted
          </span>
          <span className="font-mono text-lg font-bold text-ink-primary leading-tight">
            {queue.failed_exhausted.toLocaleString()}
          </span>
        </div>

        <div
          className={`rounded-[4px] border-strong px-3 py-2 flex flex-col gap-0.5 ${
            queue.partial_matched_due > 0 ? 'bg-accent-primary/20' : 'bg-canvas'
          }`}
          data-testid="enrichment-callout-partial-due"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
            Partial Matched Due
          </span>
          <span className="font-mono text-lg font-bold text-ink-primary leading-tight">
            {queue.partial_matched_due.toLocaleString()}
          </span>
        </div>
      </div>
    </article>
  )
}
