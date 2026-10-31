import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Layers } from 'lucide-react'
import { VinylMonogram } from './VinylMonogram'

export const NavigationRail: React.FC = () => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const windowParam = searchParams.get('window') || '24H'
  const activeTab = searchParams.get('tab')

  // Helper to preserve window query parameter across navigation
  const buildHref = (path: string, tab?: string) => {
    const params = new URLSearchParams()
    if (windowParam) {
      params.set('window', windowParam)
    }
    if (tab) {
      params.set('tab', tab)
    }
    const queryString = params.toString()
    return queryString ? `${path}?${queryString}` : path
  }

  const isDashboardActive = location.pathname === '/'
  const isDirectoryActive = location.pathname === '/directory'

  return (
    <aside
      className="w-[240px] shrink-0 fixed top-0 bottom-0 left-0 bg-[#0E0E10] border-r-[1.5px] border-[#121212] flex flex-col justify-between text-white z-20 select-none"
      data-testid="navigation-rail"
    >
      <div className="flex flex-col">
        {/* Brand Header */}
        <Link
          to={buildHref('/')}
          className="p-5 border-b border-[#222226] flex items-center gap-3 hover:opacity-90 transition-opacity"
          data-testid="brand-header-link"
        >
          <VinylMonogram name="Vinyl Demand" entityId="brand-monogram" size={36} />
          <div className="flex flex-col leading-tight">
            <span className="font-grotesk font-bold text-[15px] tracking-wider text-white">
              VINYL DEMAND
            </span>
            <span className="font-mono text-[11px] text-[#646464] tracking-wider uppercase">
              r/vinylreleases LEDGER
            </span>
          </div>
        </Link>

        {/* Primary Navigation */}
        <nav className="p-4 flex flex-col gap-6">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[#646464] uppercase px-3 mb-2 font-semibold">
              INTELLIGENCE
            </div>

            <div className="flex flex-col gap-1">
              {/* Demand Dashboard */}
              <Link
                to={buildHref('/')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors ${
                  isDashboardActive
                    ? 'bg-[#1E1E22] text-white border-l-2 border-[#9B6DFF] font-semibold'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#161619]'
                }`}
                data-testid="nav-demand-dashboard"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0 text-[#9B6DFF]" />
                <span>Demand Dashboard</span>
              </Link>

              {/* Directory Explorer */}
              <div className="flex flex-col">
                <Link
                  to={buildHref('/directory')}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors ${
                    isDirectoryActive && !activeTab
                      ? 'bg-[#1E1E22] text-white border-l-2 border-[#9B6DFF] font-semibold'
                      : 'text-[#A0A0A0] hover:text-white hover:bg-[#161619]'
                  }`}
                  data-testid="nav-directory-explorer"
                >
                  <Layers className="w-4 h-4 shrink-0 text-[#9B6DFF]" />
                  <span>Directory Explorer</span>
                </Link>

                {/* Sub-links for Releases, Albums, Artists */}
                <div className="ml-6 pl-3 border-l border-[#27272A] flex flex-col gap-0.5 mt-1">
                  <Link
                    to={buildHref('/directory', 'releases')}
                    className={`px-2 py-1 text-[12px] rounded transition-colors ${
                      isDirectoryActive && activeTab === 'releases'
                        ? 'text-white font-semibold bg-[#1E1E22]'
                        : 'text-[#888888] hover:text-white'
                    }`}
                    data-testid="nav-sub-releases"
                  >
                    Releases
                  </Link>
                  <Link
                    to={buildHref('/directory', 'albums')}
                    className={`px-2 py-1 text-[12px] rounded transition-colors ${
                      isDirectoryActive && activeTab === 'albums'
                        ? 'text-white font-semibold bg-[#1E1E22]'
                        : 'text-[#888888] hover:text-white'
                    }`}
                    data-testid="nav-sub-albums"
                  >
                    Albums
                  </Link>
                  <Link
                    to={buildHref('/directory', 'artists')}
                    className={`px-2 py-1 text-[12px] rounded transition-colors ${
                      isDirectoryActive && activeTab === 'artists'
                        ? 'text-white font-semibold bg-[#1E1E22]'
                        : 'text-[#888888] hover:text-white'
                    }`}
                    data-testid="nav-sub-artists"
                  >
                    Artists
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Rail Footer (Factual Provenance Only) */}
      <div className="p-4 border-t border-[#222226]">
        <div className="font-mono text-[11px] text-[#646464] tracking-wide" data-testid="rail-footer">
          SOURCE: r/vinylreleases
        </div>
      </div>
    </aside>
  )
}
