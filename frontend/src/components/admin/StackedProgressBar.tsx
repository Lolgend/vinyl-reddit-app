import React from 'react'

export interface StackedProgressSegment {
  key: string
  label: string
  count: number
  colorClass: string
  barTestId: string
  countTestId?: string
}

interface StackedProgressBarProps {
  segments: ReadonlyArray<StackedProgressSegment>
  total: number
  ariaLabel: string
  valueNow: number
  barTestId: string
  legendTestId?: string
  legendGridClassName: string
  legendLayout?: 'inline' | 'stacked'
}

function formatSegmentWidth(count: number, total: number): string {
  if (total <= 0 || count <= 0) return '0%'
  const pct = (count / total) * 100
  return `${Number(pct.toFixed(4))}%`
}

export const StackedProgressBar: React.FC<StackedProgressBarProps> = ({
  segments,
  total,
  ariaLabel,
  valueNow,
  barTestId,
  legendTestId,
  legendGridClassName,
  legendLayout = 'inline',
}) => {
  const visibleSegments = segments.filter((segment) => segment.count > 0)

  return (
    <div className="flex flex-col gap-3">
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        className="h-6 w-full rounded-[4px] border-strong bg-canvas overflow-hidden flex"
        data-testid={barTestId}
      >
        {total > 0 &&
          visibleSegments.map((segment) => {
            const pct = (segment.count / total) * 100
            return (
              <div
                key={segment.key}
                data-testid={segment.barTestId}
                title={`${segment.label}: ${segment.count.toLocaleString()} (${pct.toFixed(1)}%)`}
                style={{ width: formatSegmentWidth(segment.count, total) }}
                className={`h-full ${segment.colorClass} transition-all duration-300 border-r-[1.5px] border-ink-primary last:border-r-0`}
              />
            )
          })}
      </div>

      <dl className={legendGridClassName} data-testid={legendTestId}>
        {segments.map((segment) =>
          legendLayout === 'stacked' ? (
            <div
              key={segment.key}
              className="rounded-[4px] bg-canvas border border-border-hairline px-2.5 py-2 flex flex-col gap-1"
              data-testid={segment.countTestId}
            >
              <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">
                <span
                  className={`inline-block w-3 h-3 rounded-[2px] border-strong shrink-0 ${segment.colorClass}`}
                  aria-hidden="true"
                />
                <span className="truncate">{segment.label}</span>
              </dt>
              <dd className="font-mono text-sm font-bold text-ink-primary">
                {segment.count.toLocaleString()}
              </dd>
            </div>
          ) : (
            <div
              key={segment.key}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[4px] bg-canvas border border-border-hairline"
              data-testid={segment.countTestId}
            >
              <dt className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-[2px] border-strong shrink-0 ${segment.colorClass}`}
                  aria-hidden="true"
                />
                <span className="font-sans text-xs text-ink-secondary truncate">
                  {segment.label}
                </span>
              </dt>
              <dd className="font-mono text-xs font-bold text-ink-primary shrink-0">
                {segment.count.toLocaleString()}
              </dd>
            </div>
          )
        )}
      </dl>
    </div>
  )
}
