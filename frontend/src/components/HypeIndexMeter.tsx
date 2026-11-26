import React from 'react'
import { TIER_BAR_CLASS } from '../utils/uiClasses'
import { TierBadge, type TierType } from './TierBadge'

export interface HypeIndexMeterProps {
  hypeIndex: number
  tier: TierType
  layout?: 'stacked' | 'inline'
  barWidthClassName?: string
}

/**
 * Displays a TierBadge alongside a tier-colored Hype Index progress bar.
 */
export const HypeIndexMeter: React.FC<HypeIndexMeterProps> = ({
  hypeIndex,
  tier,
  layout = 'stacked',
  barWidthClassName,
}) => {
  const clampedWidth = `${Math.min(100, Math.max(0, hypeIndex))}%`

  if (layout === 'inline') {
    return (
      <div className="flex items-center gap-1.5">
        <TierBadge value={hypeIndex} tier={tier} />
        <div
          className={`${barWidthClassName ?? 'w-12'} bg-accent-sand h-1.5 rounded-[1px] overflow-hidden border border-ink-primary`}
        >
          <div className={`h-full ${TIER_BAR_CLASS[tier]}`} style={{ width: clampedWidth }} />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-end shrink-0 ${barWidthClassName ?? 'w-24'}`}>
      <TierBadge value={hypeIndex} tier={tier} />
      <div className="w-full bg-accent-sand h-1.5 rounded-[2px] mt-1 overflow-hidden border border-ink-primary">
        <div className={`h-full ${TIER_BAR_CLASS[tier]}`} style={{ width: clampedWidth }} />
      </div>
    </div>
  )
}
