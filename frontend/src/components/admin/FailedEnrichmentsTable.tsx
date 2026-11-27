import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { FailedEnrichmentItem, FailedEnrichmentState } from '../../types/admin'
import {
  formatClockTimestamp,
  formatCountdownSeconds,
  formatRelativeToNow,
} from '../../utils/adminFormat'
import { FOCUS_RING_CLASS } from '../../utils/uiClasses'

const ERROR_TRUNCATE_LENGTH = 120

interface FailedEnrichmentsTableProps {
  failedItems: FailedEnrichmentItem[]
  failedTotal: number
  nowMs: number
}

const ATTEMPT_BADGE_STYLES: Record<FailedEnrichmentState, string> = {
  exhausted: 'bg-alert-coral text-ink-primary',
  due: 'bg-hype-moderate text-ink-primary',
  backoff: 'bg-canvas text-ink-primary',
}

export const FailedEnrichmentsTable: React.FC<FailedEnrichmentsTableProps> = ({
  failedItems,
  failedTotal,
  nowMs,
}) => {
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({})

  const toggleErrorExpanded = (albumId: string) => {
    setExpandedErrors((prev) => ({ ...prev, [albumId]: !prev[albumId] }))
  }
  const countLabel =
    failedTotal > failedItems.length
      ? `SHOWING ${failedItems.length} OF ${failedTotal.toLocaleString()} FAILED`
      : `${failedTotal.toLocaleString()} FAILED`

  return (
    <article
      className="bg-card border-strong rounded-[6px] shadow-brutal-md overflow-hidden"
      data-testid="failed-enrichments-table"
    >
      {/* Header Bar */}
      <div className="px-5 py-4 border-b-[1.5px] border-ink-primary flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-grotesk font-bold text-lg text-ink-primary leading-tight">
            Failed &amp; Exhausted Enrichments
          </h2>
          <p className="font-sans text-xs text-ink-secondary mt-0.5">
            Albums failing external discography reconciliation, ordered with exhausted and due
            retries first
          </p>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-[4px] border-strong font-mono text-[11px] font-bold shrink-0 ${
            failedTotal > 0 ? 'bg-alert-coral text-ink-primary' : 'bg-hype-high text-ink-primary'
          }`}
          data-testid="failed-enrichments-count"
        >
          {countLabel}
        </span>
      </div>

      {/* Empty State vs Data Table */}
      {failedItems.length === 0 ? (
        <div
          className="px-6 py-10 text-center bg-card flex flex-col items-center gap-2"
          data-testid="failed-enrichments-empty"
        >
          <CheckCircle2 className="w-6 h-6 text-ink-primary" aria-hidden="true" />
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-ink-primary">
            0 FAILED ENRICHMENTS
          </p>
          <p className="font-sans text-xs text-ink-secondary max-w-md">
            No catalog albums are currently in a failed or exhausted enrichment state.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-canvas border-b-[1.5px] border-ink-primary font-mono text-[11px] uppercase text-ink-secondary tracking-wider">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Album
                </th>
                <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                  Attempts
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Error Details
                </th>
                <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                  Last Attempt
                </th>
                <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                  Next Retry / Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline font-sans text-xs">
              {failedItems.map((item) => {
                const targetMs = item.next_retry_at ? Date.parse(item.next_retry_at) : NaN
                const remainingSec = !Number.isNaN(targetMs)
                  ? Math.ceil((targetMs - nowMs) / 1000)
                  : null
                const rawError = item.enrichment_error || 'No error details recorded'
                const isTruncatable = rawError.length > ERROR_TRUNCATE_LENGTH
                const isExpanded = Boolean(expandedErrors[item.album_id])
                const displayedError =
                  isTruncatable && !isExpanded
                    ? `${rawError.slice(0, ERROR_TRUNCATE_LENGTH).trimEnd()}…`
                    : rawError

                return (
                  <tr
                    key={item.album_id}
                    className="hover:bg-row-hover transition-colors align-top"
                    data-testid={`failed-enrichment-row-${item.album_id}`}
                  >
                    {/* Album & Combined Artist */}
                    <td className="py-3 px-4 min-w-[200px]">
                      <Link
                        to={`/albums/${item.album_id}`}
                        className={`font-grotesk font-bold text-sm text-ink-primary hover:underline decoration-2 underline-offset-2 rounded-[2px] inline-block ${FOCUS_RING_CLASS}`}
                      >
                        {item.album_title}
                      </Link>
                      <div className="font-sans text-xs text-ink-secondary mt-0.5">
                        {item.combined_artist}
                      </div>
                    </td>

                    {/* N/5 Attempts Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong font-mono text-xs font-bold ${ATTEMPT_BADGE_STYLES[item.state]}`}
                      >
                        {item.enrichment_attempts}/{item.max_attempts}
                      </span>
                    </td>

                    {/* Error Details */}
                    <td className="py-3 px-4 max-w-md">
                      <p
                        className="font-mono text-[11px] text-ink-primary break-words leading-relaxed"
                        title={isTruncatable && !isExpanded ? rawError : undefined}
                        data-testid={`failed-enrichment-error-${item.album_id}`}
                      >
                        {displayedError}
                      </p>
                      {isTruncatable && (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleErrorExpanded(item.album_id)}
                          className={`mt-1 inline-flex items-center font-mono text-[11px] font-bold text-ink-primary underline decoration-1 underline-offset-2 hover:text-ink-secondary cursor-pointer rounded-[2px] ${FOCUS_RING_CLASS}`}
                          data-testid={`failed-enrichment-toggle-${item.album_id}`}
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </td>

                    {/* Last Attempt */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-ink-secondary">
                      {formatRelativeToNow(item.last_enriched_at, nowMs)}
                    </td>

                    {/* Next Retry / Status */}
                    <td
                      className="py-3 px-4 whitespace-nowrap"
                      data-testid={`failed-enrichment-state-${item.album_id}`}
                    >
                      {item.state === 'exhausted' ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-strong bg-alert-coral font-mono text-[11px] font-bold text-ink-primary">
                            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                            EXHAUSTED
                          </span>
                          <span className="font-mono text-[10px] text-ink-secondary">
                            Max retries reached
                          </span>
                        </div>
                      ) : item.state === 'due' ||
                        (remainingSec !== null && remainingSec <= 0) ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-strong bg-hype-moderate font-mono text-[11px] font-bold text-ink-primary">
                            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                            DUE NOW
                          </span>
                          <span className="font-mono text-[10px] text-ink-secondary">
                            Ready for next cycle
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-start gap-0.5"
                          title={item.next_retry_at ?? undefined}
                        >
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-strong bg-canvas font-mono text-[11px] font-bold text-ink-primary">
                            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {remainingSec !== null
                              ? formatCountdownSeconds(remainingSec)
                              : 'Scheduled'}
                          </span>
                          {!Number.isNaN(targetMs) && (
                            <span className="font-mono text-[10px] text-ink-secondary">
                              At {formatClockTimestamp(targetMs)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
