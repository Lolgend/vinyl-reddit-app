import React from 'react'
import { useParams } from 'react-router-dom'
import { VinylMonogram } from '../components/VinylMonogram'

export const ReleaseDetail: React.FC = () => {
  const { releaseId } = useParams<{ releaseId: string }>()

  return (
    <div className="flex flex-col gap-6" data-testid="screen-release-detail">
      {/* Header */}
      <div className="flex items-center gap-4">
        <VinylMonogram name="Release Detail" entityId={releaseId} size={56} />
        <div>
          <div className="font-mono text-xs text-[#646464] uppercase tracking-wider">
            Release Specification · ID: {releaseId}
          </div>
          <h1 className="font-grotesk font-bold text-2xl text-[#121212] tracking-tight mt-0.5">
            Physical Release Detail
          </h1>
        </div>
      </div>

      {/* Hero KPI Strip Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['HYPE INDEX', 'HYPE VELOCITY', 'UPVOTES & RATIO', 'COMMENTS'].map((label) => (
          <div
            key={label}
            className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-sm p-4"
          >
            <div className="font-mono text-[11px] text-[#646464]">{label}</div>
            <div className="font-mono font-bold text-xl text-[#121212] mt-1">—</div>
          </div>
        ))}
      </div>

      {/* Main Detail Container */}
      <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6">
        <div className="h-64 flex items-center justify-center text-xs font-mono text-[#646464]">
          Physical specs and Reddit submission provenance loading...
        </div>
      </div>
    </div>
  )
}
