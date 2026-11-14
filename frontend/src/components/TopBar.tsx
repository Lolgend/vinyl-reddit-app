import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Disc3, Menu, Search, X } from 'lucide-react'
import { VinylMonogram } from './VinylMonogram'
import { formatRelativeTime } from '../utils/formatTime'
import { FOCUS_RING_CLASS } from '../utils/uiClasses'

interface HealthResponse {
  status: string
  database: string
  latest_snapshot_at: string | null
}

interface SearchItem {
  id: string
  title: string
  subtitle: string
  monogram_key: string
  extra?: Record<string, unknown>
}

interface SearchResponse {
  query: string
  albums: SearchItem[]
  releases: SearchItem[]
  artists: SearchItem[]
}

interface ResultEntry {
  type: 'album' | 'release' | 'artist'
  item: SearchItem
}

interface TopBarProps {
  isMobileNavOpen?: boolean
  onToggleMobileNav?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  isMobileNavOpen = false,
  onToggleMobileNav,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isDirectory = location.pathname === '/directory'
  const urlQuery = searchParams.get('q') || ''

  // Sync urlQuery into local query during render when URL query changes
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery)
  const [localQuery, setLocalQuery] = useState(urlQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery)
    setLocalQuery(urlQuery)
  }

  // Debounce query string for search API calls (~200ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(localQuery)
    }, 200)
    return () => clearTimeout(handler)
  }, [localQuery])

  // Global [⌘K] / [Ctrl+K] shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Health endpoint query
  const { data: healthData, isError, isLoading: isHealthLoading } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health')
      if (!res.ok) {
        throw new Error('Health check failed')
      }
      return res.json()
    },
    refetchInterval: 30000,
  })

  // Global typeahead search query
  const canSearch = debouncedQuery.trim().length >= 2
  const { data: searchData, isLoading: isSearchLoading } = useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery.trim()],
    queryFn: async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=5`)
      if (!res.ok) {
        throw new Error('Search failed')
      }
      return res.json()
    },
    enabled: canSearch,
    staleTime: 10000,
  })

  // Flattened entries for keyboard navigation
  const flatEntries = useMemo<ResultEntry[]>(() => {
    if (!searchData) return []
    const entries: ResultEntry[] = []
    for (const alb of searchData.albums) {
      entries.push({ type: 'album', item: alb })
    }
    for (const rel of searchData.releases) {
      entries.push({ type: 'release', item: rel })
    }
    for (const art of searchData.artists) {
      entries.push({ type: 'artist', item: art })
    }
    return entries
  }, [searchData])

  // Reset selectedIndex when query changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalQuery(val)
    setSelectedIndex(-1)
    setIsOpen(true)
    if (isDirectory) {
      const newParams = new URLSearchParams(searchParams)
      if (val.trim()) {
        newParams.set('q', val)
      } else {
        newParams.delete('q')
      }
      setSearchParams(newParams, { replace: true })
    }
  }

  const navigateToEntry = (entry: ResultEntry) => {
    const windowParam = searchParams.get('window')
    const qs = windowParam ? `?window=${encodeURIComponent(windowParam)}` : ''
    setIsOpen(false)

    if (entry.type === 'album') {
      navigate(`/albums/${entry.item.id}${qs}`)
    } else if (entry.type === 'release') {
      navigate(`/releases/${entry.item.id}${qs}`)
    } else if (entry.type === 'artist') {
      navigate(`/artists/${entry.item.id}${qs}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSelectedIndex(-1)
      inputRef.current?.blur()
      return
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (flatEntries.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % flatEntries.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + flatEntries.length) % flatEntries.length)
    } else if (e.key === 'Enter') {
      if (isOpen && selectedIndex >= 0 && selectedIndex < flatEntries.length) {
        e.preventDefault()
        navigateToEntry(flatEntries[selectedIndex])
      }
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIndex >= 0 && selectedIndex < flatEntries.length) {
      navigateToEntry(flatEntries[selectedIndex])
      return
    }

    setIsOpen(false)
    if (!isDirectory) {
      const params = new URLSearchParams()
      const windowParam = searchParams.get('window')
      if (windowParam) params.set('window', windowParam)
      if (localQuery.trim()) params.set('q', localQuery.trim())
      navigate(`/directory?${params.toString()}`)
    }
  }

  const handleClear = () => {
    setLocalQuery('')
    setDebouncedQuery('')
    setSelectedIndex(-1)
    setIsOpen(false)
    if (isDirectory) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('q')
      setSearchParams(newParams, { replace: true })
    }
    inputRef.current?.focus()
  }

  const freshnessLabel = isHealthLoading
    ? 'SYNCING...'
    : isError
      ? 'OFFLINE'
      : formatRelativeTime(healthData?.latest_snapshot_at)

  const activeEntry =
    isOpen && canSearch && selectedIndex >= 0 && selectedIndex < flatEntries.length
      ? flatEntries[selectedIndex]
      : null
  const activeOptionId = activeEntry
    ? `global-search-option-${activeEntry.type}-${activeEntry.item.id}`
    : undefined

  const searchGroups: Array<{
    type: ResultEntry['type']
    labelId: string
    label: string
    items: SearchItem[]
    offset: number
  }> = searchData
    ? [
        {
          type: 'album' as const,
          labelId: 'search-group-albums',
          label: 'ALBUMS',
          items: searchData.albums,
          offset: 0,
        },
        {
          type: 'release' as const,
          labelId: 'search-group-releases',
          label: 'RELEASES',
          items: searchData.releases,
          offset: searchData.albums.length,
        },
        {
          type: 'artist' as const,
          labelId: 'search-group-artists',
          label: 'ARTISTS',
          items: searchData.artists,
          offset: searchData.albums.length + searchData.releases.length,
        },
      ].filter((group) => group.items.length > 0)
    : []

  return (
    <header
      className="h-16 shrink-0 bg-canvas border-b-[1.5px] border-ink-primary flex items-center justify-between px-4 sm:px-6 lg:px-8 gap-3 z-20 sticky top-0"
      data-testid="top-bar"
    >
      {/* Left: Mobile Nav Trigger + Global Search Input & Dropdown */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={Boolean(isMobileNavOpen)}
          aria-controls="primary-navigation-rail"
          data-testid="open-nav-button"
          onClick={() => onToggleMobileNav?.()}
          className={`lg:hidden shrink-0 inline-flex items-center justify-center min-h-[36px] min-w-[36px] bg-card text-ink-primary border-strong rounded-[4px] shadow-brutal-sm hover:bg-row-hover ${FOCUS_RING_CLASS}`}
        >
          <Menu className="w-4 h-4" aria-hidden="true" />
        </button>

        <div ref={containerRef} className="relative flex items-center w-full max-w-lg min-w-0">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-secondary">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Global catalog search"
              aria-expanded={isOpen && canSearch}
              aria-autocomplete="list"
              aria-controls="global-search-listbox"
              aria-activedescendant={activeOptionId}
              value={localQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (localQuery.trim().length >= 2) {
                  setIsOpen(true)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search releases, albums, artists, variants, retailers..."
              className={`w-full pl-9 pr-24 py-2 text-xs font-medium bg-card text-ink-primary border-strong rounded-[4px] shadow-brutal-sm placeholder:text-ink-secondary ${FOCUS_RING_CLASS}`}
              data-testid="global-search-input"
              autoComplete="off"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
              {localQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={handleClear}
                  className={`px-2 min-h-[26px] min-w-[26px] text-[10px] font-mono font-bold uppercase bg-ink-primary text-white border-strong rounded hover:bg-accent-primary hover:text-ink-primary transition-colors flex items-center justify-center gap-0.5 ${FOCUS_RING_CLASS}`}
                  data-testid="search-clear-button"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                  <span>CLEAR</span>
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-ink-secondary bg-canvas border-subtle rounded">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </form>

        {/* Global Search Autocomplete Dropdown */}
        {isOpen && canSearch && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-card border-strong rounded-[6px] shadow-brutal-lg z-50 overflow-hidden max-h-[480px] overflow-y-auto"
            data-testid="search-dropdown"
          >
            {isSearchLoading ? (
              <div
                role="status"
                className="p-4 text-center font-mono text-xs text-ink-secondary flex items-center justify-center gap-2"
              >
                <Disc3 className="w-4 h-4 animate-spin text-accent-primary" aria-hidden="true" />
                <span>SEARCHING CATALOG...</span>
              </div>
            ) : flatEntries.length === 0 ? (
              <div role="status" className="p-6 text-center" data-testid="search-no-results">
                <div className="font-mono text-xs font-bold text-ink-primary uppercase tracking-wider">
                  0 MATCHING RECORDS
                </div>
                <div className="text-[11px] text-ink-secondary mt-1 font-sans">
                  No albums, releases, or artists found for &quot;{debouncedQuery}&quot;
                </div>
              </div>
            ) : null}

            <div id="global-search-listbox" role="listbox" aria-label="Search suggestions">
              {!isSearchLoading &&
                searchGroups.map((group) => (
                  <div
                    key={group.type}
                    role="group"
                    aria-labelledby={group.labelId}
                    className="border-b border-subtle last:border-b-0"
                  >
                    <div
                      id={group.labelId}
                      role="presentation"
                      className="font-mono text-[10px] font-bold text-ink-secondary uppercase px-3 py-1.5 bg-row-hover border-b border-subtle tracking-wider"
                    >
                      {group.label}
                    </div>
                    {group.items.map((item, idx) => {
                      const itemIdx = group.offset + idx
                      const isSelected = selectedIndex === itemIdx
                      return (
                        <div
                          key={`${group.type}-${item.id}`}
                          id={`global-search-option-${group.type}-${item.id}`}
                          onClick={() => navigateToEntry({ type: group.type, item })}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b last:border-b-0 border-subtle ${
                            isSelected ? 'bg-canvas' : 'hover:bg-row-hover'
                          }`}
                          data-testid={`search-result-${item.id}`}
                          data-selected={isSelected}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <VinylMonogram name={item.title} entityId={item.monogram_key} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="font-grotesk font-bold text-xs text-ink-primary truncate">
                              {item.title}
                            </div>
                            <div className="font-sans text-[11px] text-ink-secondary truncate">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Right: Factual database freshness indicator */}
      <div
        className="font-mono text-[11px] text-ink-secondary shrink-0 ml-4 hidden md:flex items-center gap-1.5"
        data-testid="freshness-indicator"
      >
        <span>SOURCE: r/vinylreleases</span>
        <span>·</span>
        <span>LAST SNAPSHOT:</span>
        <span className="font-semibold text-ink-primary">{freshnessLabel}</span>
      </div>
    </header>
  )
}
