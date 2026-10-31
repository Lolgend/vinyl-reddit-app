import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { formatRelativeTime } from '../utils/formatTime'

interface HealthResponse {
  status: string
  database: string
  latest_snapshot_at: string | null
}

export const TopBar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const isDirectory = location.pathname === '/directory'
  const urlQuery = searchParams.get('q') || ''

  // Sync urlQuery into local query during render when URL query changes
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery)
  const [localQuery, setLocalQuery] = useState(urlQuery)

  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery)
    setLocalQuery(urlQuery)
  }

  // Global [⌘K] / [Ctrl+K] shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Health endpoint query
  const { data: healthData, isError, isLoading } = useQuery<HealthResponse>({
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalQuery(val)
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
    if (isDirectory) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('q')
      setSearchParams(newParams, { replace: true })
    }
    inputRef.current?.focus()
  }

  const freshnessLabel = isLoading
    ? 'SYNCING...'
    : isError
      ? 'OFFLINE'
      : formatRelativeTime(healthData?.latest_snapshot_at)

  return (
    <header
      className="h-16 shrink-0 bg-[#F7F3F0] border-b-[1.5px] border-[#121212] flex items-center justify-between px-8 z-10 sticky top-0"
      data-testid="top-bar"
    >
      {/* Left: Global Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full max-w-lg">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#646464]">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={handleSearchChange}
            placeholder="Search releases, albums, artists, variants, retailers..."
            className="w-full pl-9 pr-24 py-1.5 text-xs font-medium bg-white text-[#121212] border-[1.5px] border-[#121212] rounded-[4px] shadow-brutal-sm focus:outline-none placeholder:text-[#888888]"
            data-testid="global-search-input"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
            {localQuery ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#121212] text-white rounded hover:bg-[#27272A] flex items-center gap-0.5"
                data-testid="search-clear-button"
              >
                <X className="w-3 h-3" />
                <span>CLEAR</span>
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#646464] bg-[#F7F3F0] border border-[#E5E0DA] rounded">
                ⌘K
              </kbd>
            )}
          </div>
        </div>
      </form>

      {/* Right: Factual database freshness indicator */}
      <div
        className="font-mono text-[11px] text-[#646464] shrink-0 ml-4 hidden md:flex items-center gap-1.5"
        data-testid="freshness-indicator"
      >
        <span>SOURCE: r/vinylreleases</span>
        <span>·</span>
        <span>LAST SNAPSHOT:</span>
        <span className="font-semibold text-[#121212]">{freshnessLabel}</span>
      </div>
    </header>
  )
}
