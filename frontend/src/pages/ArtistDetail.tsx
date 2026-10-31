import React from 'react'
import { useParams } from 'react-router-dom'
import { VinylMonogram } from '../components/VinylMonogram'

export const ArtistDetail: React.FC = () => {
  const { artistId } = useParams<{ artistId: string }>()

  return (
    <div className="flex flex-col gap-6" data-testid="screen-artist-detail">
      {/* Header */}
      <div className="flex items-center gap-4">
        <VinylMonogram name="Artist Detail" entityId={artistId} size={56} />
        <div>
          <div className="font-mono text-xs text-[#646464] uppercase tracking-wider">
            Artist Discography · ID: {artistId}
          </div>
          <h1 className="font-grotesk font-bold text-2xl text-[#121212] tracking-tight mt-0.5">
            Artist Detail
          </h1>
        </div>
      </div>

      {/* Hero KPI Strip Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['HYPE INDEX', 'HYPE VELOCITY', 'SOLO ALBUMS', 'COMBINED ALBUMS'].map((label) => (
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
          Artist catalog and tracked releases loading...
        </div>
      </div>
    </div>
  )
}
