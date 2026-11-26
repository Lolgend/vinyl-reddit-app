import React from 'react'

export interface EntityDetailSkeletonProps {
  screenTestId: string
  monogramShape?: 'circle' | 'square'
  children?: React.ReactNode
}

/**
 * Shared loading skeleton for entity detail screens (super-header, masthead, and 3-card KPI strip).
 */
export const EntityDetailSkeleton: React.FC<EntityDetailSkeletonProps> = ({
  screenTestId,
  monogramShape = 'square',
  children,
}) => (
  <div className="flex flex-col gap-6" data-testid={screenTestId}>
    <div className="w-36 h-4 bg-[#E5E0DA] rounded animate-pulse" />
    <div className="border-b-[3px] border-[#121212] pb-3 flex items-end justify-between gap-3">
      <div className="w-36 h-10 bg-[#E5E0DA] rounded animate-pulse" />
      <div className="w-36 h-8 bg-[#E5E0DA] rounded-full animate-pulse" />
    </div>
    <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 flex items-center gap-4">
      <div
        data-testid={monogramShape === 'circle' ? 'masthead-monogram-skeleton' : undefined}
        className={`w-[68px] h-[68px] ${
          monogramShape === 'circle' ? 'rounded-full' : 'rounded-[6px]'
        } bg-[#E5E0DA] border-[1.5px] border-[#121212] animate-pulse shrink-0`}
      />
      <div className="flex flex-col gap-2">
        <div className="w-64 h-8 bg-[#E5E0DA] rounded animate-pulse" />
        <div className="w-40 h-5 bg-[#E5E0DA] rounded animate-pulse" />
        <div className="w-48 h-6 bg-[#E5E0DA] rounded-full animate-pulse mt-1" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          data-testid="hero-kpi-skeleton-card"
          className="h-28 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
        >
          <div className="flex justify-between">
            <div className="w-24 h-3.5 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-12 h-4 bg-[#E5E0DA] rounded animate-pulse" />
          </div>
          <div className="w-20 h-7 bg-[#E5E0DA] rounded animate-pulse" />
          <div className="w-full h-2 bg-[#E5E0DA] rounded animate-pulse" />
        </div>
      ))}
    </div>
    {children}
  </div>
)
