import React from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import type {
  EffectiveProcessStatus,
  LoopStatus,
  PipelineLoopInfo,
} from '../../types/admin'
import {
  LOOP_DISPLAY_META,
  formatCountdownSeconds,
  formatDurationMs,
  formatIntervalSeconds,
  formatRelativeToNow,
  formatThroughputStats,
} from '../../utils/adminFormat'

interface PipelineLoopGridProps {
  loops: PipelineLoopInfo[]
  processStatus: EffectiveProcessStatus
  nowMs: number
}

const LOOP_STATUS_STYLES: Record<LoopStatus, { label: string; className: string }> = {
  running: {
    label: 'RUNNING',
    className: 'bg-hype-high text-ink-primary',
  },
  sleeping: {
    label: 'SLEEPING',
    className: 'bg-canvas text-ink-primary',
  },
  error: {
    label: 'ERROR',
    className: 'bg-alert-coral text-ink-primary',
  },
  stopped: {
    label: 'STOPPED',
    className: 'bg-accent-sand text-ink-primary',
  },
  disabled: {
    label: 'DISABLED',
    className: 'bg-accent-sand text-ink-secondary',
  },
}

interface CountdownDisplay {
  value: string
  subtitle: string
  isDueNow?: boolean
}

function getCountdownDisplay(
  loop: PipelineLoopInfo,
  processStatus: EffectiveProcessStatus,
  nowMs: number
): CountdownDisplay {
  if (loop.status === 'disabled') {
    return { value: '—', subtitle: 'Not configured' }
  }
  if (processStatus === 'stopped' || loop.status === 'stopped') {
    return { value: '—', subtitle: 'Process stopped' }
  }
  if (processStatus !== 'online') {
    return { value: '—', subtitle: 'Process offline' }
  }
  if (loop.status === 'running') {
    return { value: 'Running...', subtitle: 'Cycle in progress' }
  }
  if (loop.loop_name === 'extraction_worker' && !loop.next_run_at) {
    return {
      value: 'Event-driven',
      subtitle: `${formatIntervalSeconds(loop.interval_seconds)} fallback`,
    }
  }
  if (loop.next_run_at) {
    const targetMs = Date.parse(loop.next_run_at)
    if (!Number.isNaN(targetMs)) {
      const remainingSec = Math.ceil((targetMs - nowMs) / 1000)
      if (remainingSec <= 0) {
        return { value: 'Due now', subtitle: 'Awaiting next tick', isDueNow: true }
      }
      return {
        value: formatCountdownSeconds(remainingSec),
        subtitle: 'Until next cycle',
      }
    }
  }
  return { value: '—', subtitle: 'No schedule' }
}

export const PipelineLoopGrid: React.FC<PipelineLoopGridProps> = ({
  loops,
  processStatus,
  nowMs,
}) => {
  return (
    <section aria-label="Pipeline Loop Status" data-testid="pipeline-loop-grid">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {loops.map((loop) => {
          const meta = LOOP_DISPLAY_META[loop.loop_name]
          const statusStyle = LOOP_STATUS_STYLES[loop.status]
          const countdown = getCountdownDisplay(loop, processStatus, nowMs)
          const intervalLabel =
            loop.loop_name === 'extraction_worker'
              ? `${formatIntervalSeconds(loop.interval_seconds)} fallback`
              : `Every ${formatIntervalSeconds(loop.interval_seconds)}`

          return (
            <article
              key={loop.loop_name}
              className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between gap-4"
              data-testid={`loop-card-${loop.loop_name}`}
            >
              <div className="flex flex-col gap-3">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-grotesk font-bold text-base text-ink-primary leading-tight">
                        {meta.title}
                      </h2>
                      <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-canvas border-strong text-ink-secondary">
                        {meta.tag}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-ink-secondary mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border-strong font-mono text-[11px] font-bold shrink-0 ${statusStyle.className}`}
                    data-testid={`loop-status-${loop.loop_name}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                {/* Live Countdown Block */}
                <div
                  className={`rounded-[4px] border-strong px-3 py-2.5 flex items-center justify-between gap-2 ${
                    countdown.isDueNow ? 'bg-hype-moderate/35' : 'bg-canvas'
                  }`}
                  data-testid={`loop-countdown-${loop.loop_name}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                      Next Run
                    </span>
                    <span className="font-mono text-xl font-bold text-ink-primary leading-tight mt-0.5">
                      {countdown.value}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-secondary text-right shrink-0">
                    {countdown.subtitle}
                  </span>
                </div>

                {/* Metadata Ledger Rows */}
                <dl className="divide-y divide-border-hairline font-mono text-xs">
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <dt className="text-ink-secondary uppercase text-[11px]">Interval</dt>
                    <dd className="text-ink-primary font-semibold">{intervalLabel}</dd>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <dt className="text-ink-secondary uppercase text-[11px]">Last Started</dt>
                    <dd
                      className="text-ink-primary font-semibold"
                      data-testid={`loop-last-started-${loop.loop_name}`}
                    >
                      {formatRelativeToNow(loop.last_started_at, nowMs)}
                    </dd>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <dt className="text-ink-secondary uppercase text-[11px]">Last Completed</dt>
                    <dd className="text-ink-primary font-semibold">
                      {formatRelativeToNow(loop.last_completed_at, nowMs)}
                    </dd>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <dt className="text-ink-secondary uppercase text-[11px]">Last Duration</dt>
                    <dd className="text-ink-primary font-semibold">
                      {formatDurationMs(loop.last_duration_ms)}
                    </dd>
                  </div>
                  <div className="pt-1.5 flex flex-col gap-0.5">
                    <dt className="text-ink-secondary uppercase text-[11px]">Last Throughput</dt>
                    <dd className="text-ink-primary font-semibold text-[11px] leading-snug">
                      {formatThroughputStats(loop.last_run_stats)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Inline Coral Error Alert */}
              {loop.last_error && (
                <div
                  role="alert"
                  className="bg-alert-coral border-strong rounded-[4px] p-2.5 text-ink-primary flex items-start gap-2"
                  data-testid={`loop-error-${loop.loop_name}`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="font-mono text-[11px] font-semibold leading-snug break-words min-w-0">
                    {loop.last_error}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
