import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Layers, X } from 'lucide-react'
import { VinylMonogram } from './VinylMonogram'

interface NavigationRailProps {
  isOpen?: boolean
  onClose?: () => void
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  isOpen = false,
  onClose,
}) => {
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

  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard'
  const isDirectoryActive = location.pathname === '/directory'

  useEffect(() => {
    if (!isOpen || !onClose) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleLinkClick = () => {
    onClose?.()
  }

  const focusRingClass =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'

  const subLinks = [
    { tab: 'releases', label: 'Releases', testId: 'nav-sub-releases' },
    { tab: 'albums', label: 'Albums', testId: 'nav-sub-albums' },
    { tab: 'artists', label: 'Artists', testId: 'nav-sub-artists' },
  ] as const

  return (
    <>
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          data-testid="nav-backdrop"
          aria-hidden="true"
          onClick={() => onClose?.()}
        />
      )}
      <aside
        id="primary-navigation-rail"
        className={`w-[240px] shrink-0 fixed top-0 bottom-0 left-0 bg-nav border-r-[1.5px] border-ink-primary flex flex-col justify-between text-white z-40 select-none transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="navigation-rail"
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="p-5 border-b border-[#222226] flex items-center justify-between gap-2">
            <Link
              to={buildHref('/')}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 min-w-0 rounded hover:opacity-90 transition-opacity ${focusRingClass}`}
              data-testid="brand-header-link"
            >
              <VinylMonogram name="Vinyl Demand" entityId="brand-monogram" size={36} />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-grotesk font-bold text-[15px] tracking-wider text-white">
                  VINYL DEMAND
                </span>
                <span className="font-mono text-[11px] text-nav-muted tracking-wider uppercase truncate">
                  r/vinylreleases LEDGER
                </span>
              </div>
            </Link>
            <button
              type="button"
              aria-label="Close navigation menu"
              data-testid="close-nav-button"
              onClick={() => onClose?.()}
              className={`lg:hidden shrink-0 inline-flex items-center justify-center min-h-[28px] min-w-[28px] rounded-[4px] text-nav-muted hover:text-white hover:bg-[#1E1E22] ${focusRingClass}`}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav aria-label="Primary" className="p-4 flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-nav-muted uppercase px-3 mb-2 font-semibold">
                INTELLIGENCE
              </div>

              <div className="flex flex-col gap-1">
                {/* Demand Dashboard */}
                <Link
                  to={buildHref('/')}
                  onClick={handleLinkClick}
                  aria-current={isDashboardActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors ${focusRingClass} ${
                    isDashboardActive
                      ? 'bg-[#1E1E22] text-white border-l-2 border-accent-primary font-semibold'
                      : 'text-[#A0A0A0] hover:text-white hover:bg-[#161619]'
                  }`}
                  data-testid="nav-demand-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0 text-accent-primary" aria-hidden="true" />
                  <span>Demand Dashboard</span>
                </Link>

                {/* Directory Explorer */}
                <div className="flex flex-col">
                  <Link
                    to={buildHref('/directory')}
                    onClick={handleLinkClick}
                    aria-current={isDirectoryActive && !activeTab ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors ${focusRingClass} ${
                      isDirectoryActive && !activeTab
                        ? 'bg-[#1E1E22] text-white border-l-2 border-accent-primary font-semibold'
                        : 'text-[#A0A0A0] hover:text-white hover:bg-[#161619]'
                    }`}
                    data-testid="nav-directory-explorer"
                  >
                    <Layers className="w-4 h-4 shrink-0 text-accent-primary" aria-hidden="true" />
                    <span>Directory Explorer</span>
                  </Link>

                  {/* Sub-links for Releases, Albums, Artists */}
                  <div className="ml-6 pl-3 border-l border-[#27272A] flex flex-col gap-0.5 mt-1">
                    {subLinks.map(({ tab, label, testId }) => {
                      const isSubActive = isDirectoryActive && activeTab === tab
                      return (
                        <Link
                          key={tab}
                          to={buildHref('/directory', tab)}
                          onClick={handleLinkClick}
                          aria-current={isSubActive ? 'page' : undefined}
                          className={`px-2 py-1 text-[12px] rounded transition-colors ${focusRingClass} ${
                            isSubActive
                              ? 'text-white font-semibold bg-[#1E1E22]'
                              : 'text-nav-muted hover:text-white'
                          }`}
                          data-testid={testId}
                        >
                          {label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Rail Footer (Factual Provenance Only) */}
        <div className="p-4 border-t border-[#222226]">
          <div className="font-mono text-[11px] text-nav-muted tracking-wide" data-testid="rail-footer">
            SOURCE: r/vinylreleases
          </div>
        </div>
      </aside>
    </>
  )
}
