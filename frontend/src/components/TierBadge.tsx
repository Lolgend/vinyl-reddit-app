import React from 'react'

export type TierType = 'high' | 'moderate' | 'low'

export interface TierBadgeProps {
  value?: number
  index?: number
  hypeIndex?: number
  tier: TierType
  className?: string
  'data-testid'?: string
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  value,
  index,
  hypeIndex,
  tier,
  className = '',
  'data-testid': testId,
}) => {
  const displayValue = value ?? index ?? hypeIndex

  const bg =
    tier === 'high'
      ? 'bg-[#68D391] text-[#121212]'
      : tier === 'moderate'
      ? 'bg-[#ECC94B] text-[#121212]'
      : 'bg-[#E5E0DA] text-[#646464]'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-[1.5px] border-[#121212] font-mono text-xs font-bold shrink-0 ${bg} ${className}`.trim()}
      data-testid={testId || `tier-badge-${tier}`}
    >
      {displayValue !== undefined && displayValue !== null ? displayValue : null}
      <span className="text-[10px] font-normal uppercase">{tier}</span>
    </span>
  )
}
