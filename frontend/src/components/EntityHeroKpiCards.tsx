import React from 'react'
import { Activity, Flame } from 'lucide-react'
import { TIER_BAR_CLASS } from '../utils/uiClasses'
import { TierBadge, type TierType } from './TierBadge'

export interface HypeIndexKpiCardProps {
  hypeIndex: number
  tier: TierType
}

/**
 * Shared Hype Index KPI card for entity detail hero strips.
 */
export const HypeIndexKpiCard: React.FC<HypeIndexKpiCardProps> = ({ hypeIndex, tier }) => {
  const clampedWidth = `${Math.min(100, Math.max(0, hypeIndex))}%`

  return (
    <div
      className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
      data-testid="hero-kpi-hype-index"
    >
      <div className="flex items-center justify-between text-[#646464] mb-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-[#121212]" />
          Hype Index
        </span>
        <TierBadge value={hypeIndex} tier={tier} />
      </div>
      <div>
        <div className="font-mono font-bold text-2xl text-[#121212]">
          {hypeIndex} <span className="text-sm font-normal text-[#646464]">/ 100</span>
        </div>
        <div className="w-full bg-[#E5E0DA] h-2 rounded-[2px] mt-2 overflow-hidden border border-[#121212]">
          <div className={`h-full ${TIER_BAR_CLASS[tier]}`} style={{ width: clampedWidth }} />
        </div>
      </div>
    </div>
  )
}

export interface EngagementKpiCardProps {
  totalScore: number
  totalComments: number
  mentionCount: number
}

/**
 * Shared Engagement KPI card for entity detail hero strips.
 */
export const EngagementKpiCard: React.FC<EngagementKpiCardProps> = ({
  totalScore,
  totalComments,
  mentionCount,
}) => (
  <div
    className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
    data-testid="hero-kpi-engagement"
  >
    <div className="flex items-center justify-between text-[#646464] mb-2">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-[#121212]" />
        Engagement
      </span>
    </div>
    <div>
      <div className="font-mono font-bold text-2xl text-[#121212]">
        {totalScore} <span className="text-sm font-normal text-[#646464]">votes</span>
      </div>
      <div className="font-mono text-[11px] text-[#646464] mt-2 truncate">
        {totalComments} comments · {mentionCount} {mentionCount === 1 ? 'mention' : 'mentions'}
      </div>
    </div>
  </div>
)
