import React from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import type { ExtractionQueueStatus } from '../../types/admin'
import { formatRelativeToNow, formatWaitingDuration } from '../../utils/adminFormat'
import { FOCUS_RING_CLASS } from '../../utils/uiClasses'

interface PendingExtractionsTableProps {
  queue: ExtractionQueueStatus
  nowMs: number
}

function formatUtcTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return isoTimestamp
  return parsed.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export const PendingExtractionsTable: React.FC<PendingExtractionsTableProps> = ({
  queue,
  nowMs,
}) => {
  const items = queue.pending_items
  const hasPending = queue.pending > 0

  return (
    <article
      className="bg-card border-strong rounded-[6px] shadow-brutal-md overflow-hidden"
      data-testid="pending-extractions-table"
    >
      {/* Header Bar */}
      <div className="px-5 py-4 border-b-[1.5px] border-ink-primary flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-grotesk font-bold text-lg text-ink-primary leading-tight">
            Pending Extractions
          </h2>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong font-mono text-xs font-bold shrink-0 ${
              hasPending
                ? 'bg-hype-moderate text-ink-primary'
                : 'bg-hype-high text-ink-primary'
            }`}
          >
            {queue.pending.toLocaleString()} PENDING
          </span>
        </div>

        <div className="font-mono text-[11px] text-ink-secondary">
          {queue.pending > items.length
            ? `Showing oldest ${items.length} of ${queue.pending.toLocaleString()} pending`
            : 'Oldest release-eligible posts first'}
        </div>
      </div>

      {/* Empty State or Compact Table */}
      {items.length === 0 ? (
        <div
          className="px-6 py-10 flex flex-col items-center justify-center text-center gap-2 bg-card"
          data-testid="pending-extractions-empty"
        >
          <CheckCircle2 className="w-6 h-6 text-ink-primary" aria-hidden="true" />
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-ink-primary">
            0 PENDING EXTRACTIONS
          </p>
          <p className="font-sans text-xs text-ink-secondary max-w-md">
            All release-eligible posts in the Extraction Queue have been processed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-canvas border-b-[1.5px] border-ink-primary font-mono text-[11px] uppercase text-ink-secondary tracking-wider">
              <tr>
                <th scope="col" className="py-2.5 px-4 font-semibold">
                  Post Title
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold whitespace-nowrap">
                  Flair
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold whitespace-nowrap">
                  Posted
                </th>
                <th
                  scope="col"
                  className="py-2.5 px-4 font-semibold text-right whitespace-nowrap"
                >
                  Waiting
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline font-sans text-xs">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-row-hover transition-colors"
                  data-testid="pending-extraction-row"
                >
                  <td className="py-3 px-4 max-w-xl">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-start gap-1.5 font-medium text-ink-primary hover:underline rounded-[2px] ${FOCUS_RING_CLASS}`}
                    >
                      <span className="break-words">{item.title}</span>
                      <ExternalLink
                        className="w-3.5 h-3.5 text-ink-secondary shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    </a>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.flair ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-canvas border-strong font-mono text-[11px] font-semibold text-ink-primary">
                        {item.flair}
                      </span>
                    ) : (
                      <span className="font-mono text-ink-secondary">—</span>
                    )}
                  </td>
                  <td
                    className="py-3 px-4 whitespace-nowrap font-mono text-xs text-ink-secondary"
                    title={formatUtcTimestamp(item.created_utc)}
                  >
                    <div className="text-ink-primary font-semibold">
                      {formatRelativeToNow(item.created_utc, nowMs)}
                    </div>
                    <div className="text-[10px] text-ink-secondary">
                      {formatUtcTimestamp(item.created_utc)}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-xs font-bold text-ink-primary">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-hype-moderate/35 border-strong">
                      {formatWaitingDuration(item.created_utc, nowMs)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
