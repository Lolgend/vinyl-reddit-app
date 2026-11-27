import React from 'react'
import { AlertTriangle, History, Info } from 'lucide-react'
import type { LoopName, PipelineRunItem, RunOutcome } from '../../types/admin'
import {
  formatClockTimestamp,
  formatDurationMs,
  formatRelativeToNow,
  formatThroughputStats,
} from '../../utils/adminFormat'
import {
  FOCUS_RING_CLASS,
  PILL_BUTTON_ACTIVE_CLASS,
  PILL_BUTTON_BASE_CLASS,
  PILL_BUTTON_INACTIVE_CLASS,
} from '../../utils/uiClasses'

interface PipelineRunsTableProps {
  runs: PipelineRunItem[]
  telemetryAvailable: boolean
  selectedStage: LoopName | null
  selectedOutcome: RunOutcome | null
  onStageChange: (stage: LoopName | null) => void
  onOutcomeChange: (outcome: RunOutcome | null) => void
  onResetFilters: () => void
  nowMs: number
  isFetching?: boolean
}

const STAGE_OPTIONS: ReadonlyArray<{ value: LoopName | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'discovery_poll', label: 'Discovery Poll' },
  { value: 'tracking_poll', label: 'Tracking Poll' },
  { value: 'extraction_worker', label: 'Extraction' },
  { value: 'enrichment_worker', label: 'Enrichment' },
]

const OUTCOME_OPTIONS: ReadonlyArray<{ value: RunOutcome | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
]

const STAGE_BADGE_LABELS: Record<LoopName, string> = {
  discovery_poll: 'Discovery Poll',
  tracking_poll: 'Tracking Poll',
  extraction_worker: 'Extraction',
  enrichment_worker: 'Enrichment',
}

const OUTCOME_BADGE_STYLES: Record<RunOutcome, { label: string; className: string }> = {
  success: {
    label: 'SUCCESS',
    className: 'bg-hype-high text-ink-primary',
  },
  error: {
    label: 'ERROR',
    className: 'bg-alert-coral text-ink-primary',
  },
}

function formatRunThroughput(stats: Record<string, number> | null): string {
  if (!stats || Object.keys(stats).length === 0) return '—'
  return formatThroughputStats(stats)
}

export const PipelineRunsTable: React.FC<PipelineRunsTableProps> = ({
  runs,
  telemetryAvailable,
  selectedStage,
  selectedOutcome,
  onStageChange,
  onOutcomeChange,
  onResetFilters,
  nowMs,
  isFetching = false,
}) => {
  const hasActiveFilters = selectedStage !== null || selectedOutcome !== null

  const activeFilterSummaryParts: string[] = []
  if (selectedStage !== null) {
    activeFilterSummaryParts.push(`Stage: ${STAGE_BADGE_LABELS[selectedStage]}`)
  }
  if (selectedOutcome !== null) {
    activeFilterSummaryParts.push(
      `Outcome: ${selectedOutcome === 'success' ? 'Success' : 'Error'}`
    )
  }

  return (
    <div
      className="bg-card border-strong rounded-[6px] shadow-brutal-md overflow-hidden"
      data-testid="pipeline-runs-table"
    >
      {/* Header & Inline Pill Filter Bar */}
      <div className="p-5 border-b-[1.5px] border-ink-primary flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-grotesk font-bold text-lg text-ink-primary leading-tight">
              Recent Pipeline Runs
            </h2>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong bg-canvas font-mono text-[11px] font-bold text-ink-primary"
              data-testid="pipeline-runs-count"
            >
              {runs.length} {runs.length === 1 ? 'RUN' : 'RUNS'}
            </span>
            {isFetching && (
              <span className="font-mono text-[11px] text-ink-secondary">Updating...</span>
            )}
          </div>
          <span className="font-mono text-[11px] text-ink-secondary uppercase">
            Latest 50 executions · Newest first
          </span>
        </div>

        {/* Inline Pill Filters */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div
            role="group"
            aria-label="Filter runs by stage"
            className="flex flex-wrap items-center gap-1.5"
            data-testid="runs-stage-filter-group"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary font-semibold mr-1">
              Stage:
            </span>
            {STAGE_OPTIONS.map((option) => {
              const isActive = selectedStage === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isActive}
                  disabled={!telemetryAvailable}
                  onClick={() => onStageChange(option.value)}
                  className={`${PILL_BUTTON_BASE_CLASS} disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive ? PILL_BUTTON_ACTIVE_CLASS : PILL_BUTTON_INACTIVE_CLASS
                  }`}
                  data-testid={`runs-stage-pill-${option.value ?? 'all'}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div
            role="group"
            aria-label="Filter runs by outcome"
            className="flex flex-wrap items-center gap-1.5"
            data-testid="runs-outcome-filter-group"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary font-semibold mr-1">
              Outcome:
            </span>
            {OUTCOME_OPTIONS.map((option) => {
              const isActive = selectedOutcome === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isActive}
                  disabled={!telemetryAvailable}
                  onClick={() => onOutcomeChange(option.value)}
                  className={`${PILL_BUTTON_BASE_CLASS} disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive ? PILL_BUTTON_ACTIVE_CLASS : PILL_BUTTON_INACTIVE_CLASS
                  }`}
                  data-testid={`runs-outcome-pill-${option.value ?? 'all'}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Body: Empty States or Ledger Table */}
      {!telemetryAvailable ? (
        <div
          className="p-8 flex flex-col items-center justify-center text-center gap-2 bg-canvas/40"
          data-testid="pipeline-runs-empty-unavailable"
        >
          <Info className="w-5 h-5 text-ink-secondary" aria-hidden="true" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-primary">
            Pipeline Run History Unavailable
          </p>
          <p className="font-sans text-xs text-ink-secondary max-w-md">
            Pipeline run history requires the shared telemetry tables to be initialized and
            populated by the background Pipeline process.
          </p>
        </div>
      ) : runs.length === 0 && hasActiveFilters ? (
        <div
          className="p-8 flex flex-col items-center justify-center text-center gap-3 bg-canvas/40"
          data-testid="pipeline-runs-empty-filtered"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-primary">
            0 Matching Runs
          </p>
          <p className="font-sans text-xs text-ink-secondary max-w-md">
            No Pipeline Run records matched the active filters ({activeFilterSummaryParts.join(' · ')}
            ).
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className={`px-4 py-2 bg-accent-primary border-strong rounded-[4px] font-mono text-xs font-bold text-ink-primary shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-md active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform cursor-pointer ${FOCUS_RING_CLASS}`}
            data-testid="pipeline-runs-reset-filters-btn"
          >
            Reset Filters
          </button>
        </div>
      ) : runs.length === 0 ? (
        <div
          className="p-8 flex flex-col items-center justify-center text-center gap-2 bg-canvas/40"
          data-testid="pipeline-runs-empty-none"
        >
          <History className="w-5 h-5 text-ink-secondary" aria-hidden="true" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-primary">
            No Pipeline Runs Recorded Yet
          </p>
          <p className="font-sans text-xs text-ink-secondary max-w-md">
            Completed Discovery Poll, Tracking Poll, Extraction, and Enrichment executions will
            appear here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-canvas border-b-[1.5px] border-ink-primary font-mono text-[11px] uppercase text-ink-secondary tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Stage
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Outcome
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Started
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Duration
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Throughput
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline font-sans text-xs">
              {runs.map((run) => {
                const outcomeStyle = OUTCOME_BADGE_STYLES[run.outcome]
                const startedMs = Date.parse(run.started_at)
                return (
                  <tr
                    key={run.id}
                    className="hover:bg-row-hover transition-colors align-top"
                    data-testid={`pipeline-run-row-${run.id}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong bg-canvas font-mono text-[11px] font-bold text-ink-primary">
                        {STAGE_BADGE_LABELS[run.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong font-mono text-[11px] font-bold ${outcomeStyle.className}`}
                        data-testid="run-outcome-badge"
                      >
                        {outcomeStyle.label}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-primary"
                      title={run.started_at}
                    >
                      <div className="font-semibold">
                        {formatRelativeToNow(run.started_at, nowMs)}
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        {formatClockTimestamp(Number.isNaN(startedMs) ? null : startedMs)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-ink-primary">
                      {formatDurationMs(run.duration_ms)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-ink-primary">
                      {formatRunThroughput(run.stats)}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      {run.error_message ? (
                        <div
                          className="inline-flex items-start gap-1.5 px-2 py-1 rounded-[4px] bg-alert-coral/25 border border-ink-primary font-mono text-[11px] font-semibold text-ink-primary break-words"
                          title={run.error_message}
                        >
                          <AlertTriangle
                            className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-primary"
                            aria-hidden="true"
                          />
                          <span>{run.error_message}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-ink-secondary">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
