import React from 'react'

export const DemandDashboard: React.FC = () => {
  return (
    <div className="flex flex-col gap-6" data-testid="screen-demand-dashboard">
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-[#121212] tracking-tight">
          Demand Dashboard
        </h1>
        <p className="font-sans text-sm text-[#646464] mt-1">
          Live r/vinylreleases demand signals, leaderboard rankings, and post velocity.
        </p>
      </div>

      {/* Top 3 Intelligence Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between h-[300px]">
          <div>
            <div className="font-mono text-[11px] font-semibold text-[#646464] uppercase tracking-wider">
              Top Trending Albums
            </div>
            <div className="font-grotesk font-bold text-lg text-[#121212] mt-1">
              Top 5 Albums
            </div>
          </div>
          <div className="flex items-center justify-center text-xs font-mono text-[#646464] border-t border-[#E5E0DA] pt-4">
            Leaderboard loading...
          </div>
        </div>

        <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between h-[300px]">
          <div>
            <div className="font-mono text-[11px] font-semibold text-[#646464] uppercase tracking-wider">
              Top Trending Releases
            </div>
            <div className="font-grotesk font-bold text-lg text-[#121212] mt-1">
              Top 5 Pressings
            </div>
          </div>
          <div className="flex items-center justify-center text-xs font-mono text-[#646464] border-t border-[#E5E0DA] pt-4">
            Leaderboard loading...
          </div>
        </div>

        <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between h-[300px]">
          <div>
            <div className="font-mono text-[11px] font-semibold text-[#646464] uppercase tracking-wider">
              Newly Added Releases
            </div>
            <div className="font-grotesk font-bold text-lg text-[#121212] mt-1">
              Last 24 Hours
            </div>
          </div>
          <div className="flex items-center justify-center text-xs font-mono text-[#646464] border-t border-[#E5E0DA] pt-4">
            Leaderboard loading...
          </div>
        </div>
      </div>

      {/* Full-width Live Release Feed */}
      <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5">
        <div className="font-mono text-[11px] font-semibold text-[#646464] uppercase tracking-wider mb-2">
          Live Release Feed
        </div>
        <div className="h-48 flex items-center justify-center text-xs font-mono text-[#646464]">
          Feed table initializing...
        </div>
      </div>
    </div>
  )
}
