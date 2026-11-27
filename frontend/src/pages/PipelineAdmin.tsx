import React, { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Info, RefreshCw, Server } from 'lucide-react'
import { fetchAdminPipeline } from '../api/admin'
import { EnrichmentQueueCard } from '../components/admin/EnrichmentQueueCard'
import { FailedEnrichmentsTable } from '../components/admin/FailedEnrichmentsTable'
import { PipelineLoopGrid } from '../components/admin/PipelineLoopGrid'
import { PipelineRunsTable } from '../components/admin/PipelineRunsTable'
import type {
  AdminPipelineResponse,
  EffectiveProcessStatus,
  LoopName,
  RunOutcome,
} from '../types/admin'
import { formatClockTimestamp, formatRelativeToNow } from '../utils/adminFormat'
import { FOCUS_RING_CLASS } from '../utils/uiClasses'

const LIVENESS_BADGE_MAP: Record<
  EffectiveProcessStatus,
  { label: string; className: string }
> = {
  online: {
    label: 'ONLINE',
    className: 'bg-hype-high text-ink-primary',
  },
  stopped: {
    label: 'STOPPED',
    className: 'bg-accent-sand text-ink-primary',
  },
  offline: {
    label: 'OFFLINE / STALE',
    className: 'bg-alert-coral text-ink-primary',
  },
  unavailable: {
    label: 'TELEMETRY UNAVAILABLE',
    className: 'bg-hype-moderate text-ink-primary',
  },
}

const POLL_INTERVAL_MS = 15_000

export const PipelineAdmin: React.FC = () => {
  const [runStage, setRunStage] = useState<LoopName | null>(null)
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null)
  const [runLimit] = useState<number>(50)
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery<AdminPipelineResponse>({
    queryKey: ['admin-pipeline', runStage, runOutcome, runLimit],
    queryFn: () => fetchAdminPipeline({ runStage, runOutcome, runLimit }),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  // Compute server/client clock skew offset so countdowns stay truthful under skew
  // while remaining deterministic under fake timers (where server_time === Date.now()).
  const serverTimeMs = data ? Date.parse(data.server_time) : NaN
  const serverOffsetMs =
    !Number.isNaN(serverTimeMs) && dataUpdatedAt > 0
      ? serverTimeMs - dataUpdatedAt
      : 0
  const effectiveNowMs = nowMs + serverOffsetMs

  const livenessStyle = data
    ? LIVENESS_BADGE_MAP[data.process.effective_status]
    : null

  const errorMessage =
    error instanceof Error ? error.message : 'Unable to reach Pipeline Admin API.'

  return (
    <div className="flex flex-col gap-6" data-testid="screen-pipeline-admin">
      {/* Monochrome Editorial Super-Header */}
      <header
        className="border-b-[3px] border-[#121212] pb-3 flex flex-wrap items-end justify-between gap-4"
        data-testid="admin-super-header"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-grotesk font-bold text-4xl sm:text-5xl uppercase tracking-tighter text-[#121212] leading-none">
            PIPELINE ADMIN
          </h1>
          {livenessStyle && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border-strong font-mono text-xs font-bold shadow-brutal-sm shrink-0 ${livenessStyle.className}`}
              data-testid="process-liveness-badge"
            >
              {livenessStyle.label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data?.telemetry_available && (data.process.host || data.process.pid !== null) && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-card border-strong font-mono text-[11px] font-semibold text-ink-primary"
              data-testid="process-host-pid"
            >
              <Server className="w-3.5 h-3.5 text-ink-secondary shrink-0" aria-hidden="true" />
              <span>{data.process.host || 'unknown-host'}</span>
              {data.process.pid !== null && (
                <span className="text-ink-secondary">· PID {data.process.pid}</span>
              )}
              {data.process.run_mode && (
                <span className="text-ink-secondary uppercase">· {data.process.run_mode}</span>
              )}
            </div>
          )}

          <div
            className="font-mono text-[11px] text-ink-secondary px-2 py-1"
            data-testid="admin-last-fetched"
          >
            LAST FETCHED: {formatClockTimestamp(dataUpdatedAt || null)}
          </div>

          <button
            type="button"
            onClick={() => {
              void refetch()
            }}
            disabled={isFetching}
            className={`inline-flex items-center gap-1.5 px-4 py-2 bg-accent-primary border-strong rounded-[4px] font-mono text-xs font-bold text-ink-primary shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-md active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform cursor-pointer disabled:opacity-70 ${FOCUS_RING_CLASS}`}
            data-testid="admin-refresh-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* Coral Error Alert Banner */}
      {isError && (
        <div
          role="alert"
          className="bg-alert-coral border-strong rounded-[6px] shadow-brutal-md p-6 text-ink-primary flex flex-col gap-4"
          data-testid="admin-error-banner"
        >
          <div className="flex items-center gap-2 font-grotesk font-bold text-lg">
            <AlertTriangle className="w-5 h-5 text-ink-primary shrink-0" aria-hidden="true" />
            Failed to load Pipeline Admin telemetry
          </div>
          <p className="font-sans text-sm">{errorMessage}</p>
          <div>
            <button
              type="button"
              onClick={() => {
                void refetch()
              }}
              className={`px-4 py-2 bg-ink-primary text-white font-mono text-xs font-bold rounded-[4px] shadow-brutal-sm hover:bg-accent-primary hover:text-ink-primary transition-colors cursor-pointer ${FOCUS_RING_CLASS}`}
              data-testid="admin-retry-btn"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Structural Neo-Brutalist Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-5" data-testid="admin-loading-skeleton">
          <div className="h-14 bg-accent-sand border-strong rounded-[6px] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col gap-4"
              >
                <div className="h-5 w-2/3 bg-accent-sand border-strong rounded-[4px] animate-pulse" />
                <div className="h-16 w-full bg-accent-sand border-strong rounded-[4px] animate-pulse" />
                <div className="h-4 w-full bg-accent-sand border-strong rounded-[4px] animate-pulse" />
                <div className="h-4 w-4/5 bg-accent-sand border-strong rounded-[4px] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loaded Operational Content */}
      {data && (
        <>
          {/* Process Heartbeat / Lifecycle Strip */}
          {data.telemetry_available ? (
            <section
              aria-label="Pipeline Process Lifecycle"
              className="bg-card border-strong rounded-[6px] shadow-brutal-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs"
              data-testid="process-lifecycle-strip"
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <span className="text-ink-secondary uppercase mr-2">Run Mode:</span>
                  <span className="font-bold text-ink-primary uppercase">
                    {data.process.run_mode ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-secondary uppercase mr-2">Started:</span>
                  <span className="font-bold text-ink-primary">
                    {formatRelativeToNow(data.process.started_at, effectiveNowMs)}
                  </span>
                </div>
                <div>
                  <span className="text-ink-secondary uppercase mr-2">Pipeline Heartbeat:</span>
                  <span className="font-bold text-ink-primary">
                    {formatRelativeToNow(data.process.last_heartbeat_at, effectiveNowMs)}
                  </span>
                </div>
                {data.process.effective_status === 'stopped' && data.process.stopped_at && (
                  <div data-testid="process-stopped-at">
                    <span className="text-ink-secondary uppercase mr-2">Stopped At:</span>
                    <span className="font-bold text-ink-primary">
                      {formatRelativeToNow(data.process.stopped_at, effectiveNowMs)}
                    </span>
                  </div>
                )}
              </div>

              {data.process.effective_status === 'offline' && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-alert-coral border-strong text-ink-primary font-bold"
                  data-testid="process-stale-warning"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Stale heartbeat (&gt; {data.process.stale_threshold_seconds}s) — timers paused
                  </span>
                </div>
              )}
            </section>
          ) : (
            <section
              role="status"
              className="bg-hype-moderate/25 border-strong rounded-[6px] shadow-brutal-md p-5 flex items-start gap-3"
              data-testid="telemetry-unavailable-banner"
            >
              <Info className="w-5 h-5 text-ink-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h2 className="font-grotesk font-bold text-base text-ink-primary">
                  Telemetry Unavailable
                </h2>
                <p className="font-sans text-sm text-ink-primary">
                  Pipeline heartbeat and loop telemetry tables are missing or have no recorded
                  process status yet. Catalog queue progress and backlog tables below remain active.
                </p>
              </div>
            </section>
          )}

          {/* Row 1 — 4-Card Loop Status & Live Countdown Grid */}
          {data.telemetry_available && data.loops.length > 0 && (
            <PipelineLoopGrid
              loops={data.loops}
              processStatus={data.process.effective_status}
              nowMs={effectiveNowMs}
            />
          )}

          {/* Row 2 — Queue Progress Cards Slot (#43 Extraction Queue, #44 Enrichment Queue) */}
          {(data.extraction_queue || data.enrichment_queue) && (
            <section
              aria-label="Queue Progress Summary"
              className="grid grid-cols-1 xl:grid-cols-2 gap-5"
              data-testid="admin-queue-progress-slot"
            >
              {/* #43 mounts <ExtractionQueueCard /> here */}
              {data.enrichment_queue && <EnrichmentQueueCard queue={data.enrichment_queue} />}
            </section>
          )}

          {/* Row 3 — Inspectable Queue Tables Slot (#43 Pending Extractions, #44 Failed Enrichments) */}
          {(data.extraction_queue || data.enrichment_queue) && (
            <section
              aria-label="Queue Inspector Tables"
              className="flex flex-col gap-5"
              data-testid="admin-queue-tables-slot"
            >
              {/* #43 mounts <PendingExtractionsTable /> here */}
              {data.enrichment_queue && (
                <FailedEnrichmentsTable
                  failedItems={data.enrichment_queue.failed_items}
                  failedTotal={data.enrichment_queue.failed_total}
                  nowMs={effectiveNowMs}
                />
              )}
            </section>
          )}

          {/* Row 4 — Pipeline Run History Table Slot (#45) */}
          <section aria-label="Pipeline Run History" data-testid="admin-runs-slot">
            <PipelineRunsTable
              runs={data.runs}
              telemetryAvailable={data.telemetry_available}
              selectedStage={runStage}
              selectedOutcome={runOutcome}
              onStageChange={setRunStage}
              onOutcomeChange={setRunOutcome}
              onResetFilters={() => {
                setRunStage(null)
                setRunOutcome(null)
              }}
              nowMs={effectiveNowMs}
              isFetching={isFetching}
            />
          </section>
        </>
      )}
    </div>
  )
}
