import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, List, Search, X } from 'lucide-react'
import { VinylMonogram } from '../components/VinylMonogram'

type DirectoryTab = 'releases' | 'albums' | 'artists'
type WindowType = '24H' | '7D' | '1M'
type TierFilter = 'all' | 'high' | 'moderate' | 'low'
type ViewMode = 'grid' | 'table'

interface ReleaseItem {
  release_id: string
  album_id: string
  album_title: string
  combined_artist: string
  variant: string | null
  retailer_name: string | null
  hype_index: number
  hype_velocity: number
  tier: 'high' | 'moderate' | 'low'
  score: number
  num_comments: number
  submission_count: number
  created_at: string
  monogram_key: string
}

interface AlbumItem {
  album_id: string
  album_title: string
  combined_artist: string
  release_count: number
  preview_variants: string[]
  retailers: string[]
  submission_count: number
  score: number
  num_comments: number
  hype_velocity: number
  hype_index: number
  tier: 'high' | 'moderate' | 'low'
  monogram_key: string
  created_at: string
}

interface ArtistItem {
  artist_id: string
  name: string
  solo_album_count: number
  combined_album_count: number
  album_count: number
  release_count: number
  submission_count: number
  score: number
  num_comments: number
  hype_velocity: number
  hype_index: number
  tier: 'high' | 'moderate' | 'low'
  monogram_key: string
  created_at: string
}

interface PaginatedData<T> {
  page: number
  page_size: number
  total_pages: number
  total_items: number
  items: T[]
}

interface DirectoryCounts {
  releases: number
  albums: number
  artists: number
}

export const DirectoryExplorer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab: DirectoryTab = (() => {
    const t = searchParams.get('tab')?.toLowerCase()
    if (t === 'albums' || t === 'artists') return t
    return 'releases'
  })()

  const activeWindow: WindowType = (() => {
    const w = searchParams.get('window')?.toUpperCase()
    if (w === '7D' || w === '1M') return w
    return '24H'
  })()

  const urlQuery = searchParams.get('q') || ''
  const activeTier: TierFilter = (() => {
    const tr = searchParams.get('tier')?.toLowerCase()
    if (tr === 'high' || tr === 'moderate' || tr === 'low') return tr
    return 'all'
  })()

  const activeRetailer = searchParams.get('retailer') || ''
  const activeSort = searchParams.get('sort') || 'hype_index'
  const activeOrder = searchParams.get('order')?.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const activePage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Search input local state & debounce
  const [searchInput, setSearchInput] = useState(urlQuery)

  useEffect(() => {
    setSearchInput(urlQuery)
  }, [urlQuery])

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '' || (key === 'tier' && val === 'all') || (key === 'retailer' && val === 'all')) {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    }
    setSearchParams(next)
  }

  const handleTabChange = (tab: DirectoryTab) => {
    updateParams({ tab, page: '1' })
  }

  const handleWindowChange = (window: WindowType) => {
    updateParams({ window, page: '1' })
  }

  const handleTierChange = (tier: TierFilter) => {
    updateParams({ tier, page: '1' })
  }

  const handleRetailerChange = (retailer: string) => {
    updateParams({ retailer, page: '1' })
  }

  const handleSortChange = (sort: string) => {
    updateParams({ sort, page: '1' })
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    updateParams({ q: searchInput.trim() ? searchInput.trim() : null, page: '1' })
  }

  const handleResetFilters = () => {
    setSearchInput('')
    const next = new URLSearchParams()
    if (activeTab !== 'releases') {
      next.set('tab', activeTab)
    }
    if (activeWindow !== '24H') {
      next.set('window', activeWindow)
    }
    setSearchParams(next)
  }

  // 1. Fetch live entity counts for tab headers
  const { data: countsData } = useQuery<DirectoryCounts>({
    queryKey: ['directory-counts'],
    queryFn: async () => {
      const res = await fetch('/api/v1/directory/counts')
      if (!res.ok) throw new Error('Failed to fetch catalog counts')
      return res.json()
    },
    staleTime: 30000,
  })

  // 2. Fetch distinct retailers list
  const { data: retailersData = [] } = useQuery<string[]>({
    queryKey: ['directory-retailers'],
    queryFn: async () => {
      const res = await fetch('/api/v1/directory/retailers')
      if (!res.ok) throw new Error('Failed to fetch retailers')
      return res.json()
    },
    staleTime: 60000,
  })

  // 3. Fetch tab data
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('window', activeWindow)
    params.set('page', String(activePage))
    params.set('page_size', '20')
    if (urlQuery.trim()) params.set('q', urlQuery.trim())
    if (activeTier !== 'all') params.set('tier', activeTier)
    if (activeRetailer.trim() && activeTab !== 'artists') params.set('retailer', activeRetailer.trim())
    if (activeSort) params.set('sort', activeSort)
    params.set('order', activeOrder)
    return params.toString()
  }, [activeWindow, activePage, urlQuery, activeTier, activeRetailer, activeSort, activeOrder, activeTab])

  const {
    data: tabData,
    isLoading,
    isError,
    refetch,
  } = useQuery<PaginatedData<ReleaseItem | AlbumItem | ArtistItem>>({
    queryKey: ['directory', activeTab, queryString],
    queryFn: async () => {
      const endpoint =
        activeTab === 'albums'
          ? `/api/v1/directory/albums?${queryString}`
          : activeTab === 'artists'
          ? `/api/v1/directory/artists?${queryString}`
          : `/api/v1/directory/releases?${queryString}`

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Failed to fetch ${activeTab}`)
      return res.json()
    },
  })

  const releasesCount = countsData?.releases ?? 0
  const albumsCount = countsData?.albums ?? 0
  const artistsCount = countsData?.artists ?? 0

  const items = tabData?.items ?? []
  const totalItems = tabData?.total_items ?? 0
  const totalPages = tabData?.total_pages ?? 1

  // Helper for tier badge
  const renderTierBadge = (hypeIndex: number, tier: 'high' | 'moderate' | 'low') => {
    const bg =
      tier === 'high'
        ? 'bg-[#68D391] text-[#121212]'
        : tier === 'moderate'
        ? 'bg-[#ECC94B] text-[#121212]'
        : 'bg-[#E5E0DA] text-[#646464]'

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-[1.5px] border-[#121212] font-mono text-xs font-bold shrink-0 ${bg}`}
      >
        {hypeIndex}
        <span className="text-[10px] font-normal uppercase">{tier}</span>
      </span>
    )
  }

  // Helper for tier progress bar
  const renderTierBar = (hypeIndex: number, tier: 'high' | 'moderate' | 'low') => {
    const barColor =
      tier === 'high' ? 'bg-[#68D391]' : tier === 'moderate' ? 'bg-[#ECC94B]' : 'bg-[#646464]'

    return (
      <div className="w-full bg-[#E5E0DA] h-1.5 rounded-full border border-[#121212] overflow-hidden mt-1">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.max(2, Math.min(100, hypeIndex))}%` }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" data-testid="screen-directory-explorer">
      {/* Header */}
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-[#121212] tracking-tight">
          Directory Explorer
        </h1>
        <p className="font-sans text-sm text-[#646464] mt-1">
          Browse indexed catalog across Releases, Albums, and Artists with live demand intelligence.
        </p>
      </div>

      {/* Segmented Tab Switcher with Live Entity Counts */}
      <div className="flex items-center gap-2 border-b-[1.5px] border-[#121212] pb-3 overflow-x-auto">
        <button
          onClick={() => handleTabChange('releases')}
          className={`px-4 py-2 rounded-[9999px] text-xs font-mono font-bold tracking-wider uppercase transition-transform flex items-center gap-2 shrink-0 ${
            activeTab === 'releases'
              ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
              : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
          }`}
          data-testid="tab-releases"
        >
          RELEASES <span className="opacity-80 font-normal">({releasesCount})</span>
        </button>

        <button
          onClick={() => handleTabChange('albums')}
          className={`px-4 py-2 rounded-[9999px] text-xs font-mono font-bold tracking-wider uppercase transition-transform flex items-center gap-2 shrink-0 ${
            activeTab === 'albums'
              ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
              : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
          }`}
          data-testid="tab-albums"
        >
          ALBUMS <span className="opacity-80 font-normal">({albumsCount})</span>
        </button>

        <button
          onClick={() => handleTabChange('artists')}
          className={`px-4 py-2 rounded-[9999px] text-xs font-mono font-bold tracking-wider uppercase transition-transform flex items-center gap-2 shrink-0 ${
            activeTab === 'artists'
              ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
              : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
          }`}
          data-testid="tab-artists"
        >
          ARTISTS <span className="opacity-80 font-normal">({artistsCount})</span>
        </button>
      </div>

      {/* Shared Command & Filter Card */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col gap-4"
        data-testid="directory-command-bar"
      >
        {/* Row 1: Search Input + Window Pills + View Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#646464]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search directory by artist, album, variant, retailer..."
              className="w-full pl-9 pr-8 py-2 bg-white border-[1.5px] border-[#121212] rounded-[4px] font-mono text-xs text-[#121212] placeholder:text-[#646464] shadow-brutal-sm focus:outline-none"
              data-testid="directory-search-input"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  updateParams({ q: null, page: '1' })
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#646464] hover:text-[#121212]"
                data-testid="clear-search-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Right Controls: Window Pills + (Grid/Table for releases) */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Window Pills */}
            <div className="flex items-center gap-1 bg-[#F7F3F0] p-1 rounded-[9999px] border-[1.5px] border-[#121212]">
              {(['24H', '7D', '1M'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => handleWindowChange(w)}
                  className={`px-3 py-1 rounded-[9999px] text-[11px] font-mono font-bold transition-colors ${
                    activeWindow === w
                      ? 'bg-[#121212] text-white'
                      : 'text-[#121212] hover:bg-[#E5E0DA]'
                  }`}
                  data-testid={`window-pill-${w}`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* View Switcher Toggle (Releases tab only) */}
            {activeTab === 'releases' && (
              <div className="flex items-center border-[1.5px] border-[#121212] rounded-[4px] bg-white overflow-hidden shadow-brutal-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#121212] text-white'
                      : 'bg-white text-[#121212] hover:bg-[#FAF7F5]'
                  }`}
                  title="Grid View"
                  data-testid="view-grid"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 transition-colors border-l-[1.5px] border-[#121212] ${
                    viewMode === 'table'
                      ? 'bg-[#121212] text-white'
                      : 'bg-white text-[#121212] hover:bg-[#FAF7F5]'
                  }`}
                  title="Table View"
                  data-testid="view-table"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Hype Tier Chips + Retailer Facets + Sort Dropdown */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-[#E5E0DA] pt-3">
          {/* Hype Tier Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-[#646464] uppercase mr-1">
              TIER:
            </span>
            <button
              onClick={() => handleTierChange('all')}
              className={`px-3 py-1 rounded-[9999px] text-xs font-mono font-bold transition-all ${
                activeTier === 'all'
                  ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid="tier-filter-all"
            >
              ALL
            </button>
            <button
              onClick={() => handleTierChange('high')}
              className={`px-3 py-1 rounded-[9999px] text-xs font-mono font-bold transition-all ${
                activeTier === 'high'
                  ? 'bg-[#68D391] text-[#121212] border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid="tier-filter-high"
            >
              HIGH 75–100
            </button>
            <button
              onClick={() => handleTierChange('moderate')}
              className={`px-3 py-1 rounded-[9999px] text-xs font-mono font-bold transition-all ${
                activeTier === 'moderate'
                  ? 'bg-[#ECC94B] text-[#121212] border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid="tier-filter-moderate"
            >
              MOD 40–74
            </button>
            <button
              onClick={() => handleTierChange('low')}
              className={`px-3 py-1 rounded-[9999px] text-xs font-mono font-bold transition-all ${
                activeTier === 'low'
                  ? 'bg-[#E5E0DA] text-[#646464] border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid="tier-filter-low"
            >
              LOW 0–39
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[11px] font-semibold text-[#646464] uppercase">
              SORT:
            </span>
            <select
              value={activeSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-white border-[1.5px] border-[#121212] rounded-[4px] px-3 py-1.5 font-mono text-xs text-[#121212] shadow-brutal-sm focus:outline-none cursor-pointer"
              data-testid="sort-select"
            >
              <option value="hype_index">Hype Index ↓</option>
              <option value="hype_velocity">Hype Velocity ↓</option>
              <option value="submissions">Submissions ↓</option>
              <option value="created_at">Recently Ingested ↓</option>
              {activeTab === 'albums' && <option value="release_count">Pressing Count ↓</option>}
              {activeTab === 'artists' && <option value="album_count">Catalog Albums ↓</option>}
              <option value="title">Title / Name A–Z</option>
            </select>
          </div>
        </div>

        {/* Row 3: Retailer Facet Chips (Releases & Albums tabs only) */}
        {activeTab !== 'artists' && retailersData.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap border-t border-[#E5E0DA] pt-3">
            <span className="font-mono text-[11px] font-semibold text-[#646464] uppercase mr-1">
              RETAILER:
            </span>
            <button
              onClick={() => handleRetailerChange('')}
              className={`px-2.5 py-0.5 rounded-[9999px] text-[11px] font-mono font-bold transition-all ${
                !activeRetailer
                  ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid="retailer-filter-all"
            >
              ALL
            </button>
            {retailersData.map((ret) => {
              const isSelected = activeRetailer.toLowerCase() === ret.toLowerCase()
              return (
                <button
                  key={ret}
                  onClick={() => handleRetailerChange(ret)}
                  className={`px-2.5 py-0.5 rounded-[9999px] text-[11px] font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
                      : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
                  }`}
                  data-testid={`retailer-chip-${ret}`}
                >
                  {ret}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Error State */}
      {isError && (
        <div
          className="bg-[#FED7D7] border-[1.5px] border-[#F56565] rounded-[6px] shadow-brutal-md p-4 text-[#C53030] flex items-center justify-between"
          data-testid="directory-error-banner"
        >
          <div className="font-mono text-xs font-bold">
            Failed to load {activeTab} data. Please check connection and try again.
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-white border border-[#F56565] rounded text-xs font-mono font-bold hover:bg-[#FFF5F5]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-4" data-testid="directory-skeleton">
          <div className="h-64 bg-[#E5E0DA] border-[1.5px] border-[#121212] rounded-[6px] animate-pulse flex items-center justify-center font-mono text-xs text-[#646464]">
            LOADING {activeTab.toUpperCase()} LEDGER...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && totalItems === 0 && (
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-10 flex flex-col items-center justify-center text-center gap-3"
          data-testid="directory-empty-state"
        >
          <div className="font-mono text-lg font-bold text-[#121212]">0 MATCHING RECORDS</div>
          <p className="font-sans text-xs text-[#646464] max-w-md">
            No records match the current filters in the {activeWindow} timeframe. Try resetting filters
            or clearing search parameters.
          </p>
          <button
            onClick={handleResetFilters}
            className="bg-[#9B6DFF] text-[#121212] font-mono font-bold text-xs px-4 py-2 rounded-[4px] border-[1.5px] border-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] mt-2 transition-transform"
            data-testid="reset-filters-btn"
          >
            RESET FILTERS
          </button>
        </div>
      )}

      {/* Content Area */}
      {!isLoading && !isError && totalItems > 0 && (
        <div className="flex flex-col gap-6" data-testid="directory-content">
          {/* TAB 1: RELEASES */}
          {activeTab === 'releases' && (
            <>
              {/* Grid View */}
              {viewMode === 'grid' ? (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                  data-testid="releases-card-grid"
                >
                  {(items as ReleaseItem[]).map((rel) => {
                    const variantDisplay = rel.variant || 'Standard Pressing'
                    const retailerDisplay = rel.retailer_name || 'Wide / Unspecified'

                    return (
                      <div
                        key={rel.release_id}
                        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-lg transition-all"
                        data-testid={`release-card-${rel.release_id}`}
                      >
                        <div>
                          {/* Top Card Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <VinylMonogram
                                name={rel.album_title}
                                entityId={rel.monogram_key}
                                size={44}
                              />
                              <div className="min-w-0">
                                <Link
                                  to={`/releases/${rel.release_id}?window=${activeWindow}`}
                                  className="font-grotesk font-bold text-base text-[#121212] hover:text-[#9B6DFF] line-clamp-1 block transition-colors"
                                  title={rel.album_title}
                                >
                                  {rel.album_title}
                                </Link>
                                <span
                                  className="font-sans text-xs text-[#646464] line-clamp-1 block"
                                  title={rel.combined_artist}
                                >
                                  {rel.combined_artist}
                                </span>
                              </div>
                            </div>
                            {renderTierBadge(rel.hype_index, rel.tier)}
                          </div>

                          {/* Metadata chips: Variant & Retailer */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] border border-[#121212] font-sans text-xs truncate max-w-[180px] ${
                                rel.variant
                                  ? 'bg-[#F7F3F0] text-[#121212] font-medium'
                                  : 'bg-white text-[#646464] border-dashed'
                              }`}
                              title={variantDisplay}
                            >
                              {variantDisplay}
                            </span>
                            <span
                              className="font-sans text-xs text-[#646464] truncate max-w-[140px]"
                              title={retailerDisplay}
                            >
                              {retailerDisplay}
                            </span>
                          </div>

                          {/* Metrics block */}
                          <div className="bg-[#FAF7F5] border border-[#E5E0DA] rounded-[4px] p-3 mb-4">
                            <div className="flex items-center justify-between font-mono text-xs">
                              <span className="text-[#646464] font-semibold">HYPE VELOCITY</span>
                              <span className="font-bold text-[#121212]">
                                +{rel.hype_velocity} pts/hr
                              </span>
                            </div>
                            {renderTierBar(rel.hype_index, rel.tier)}
                            <div className="font-mono text-[11px] text-[#646464] mt-2">
                              {rel.score} pts · {rel.num_comments} comments · {rel.submission_count} posts
                            </div>
                          </div>
                        </div>

                        {/* Dual Footer Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E0DA]">
                          <Link
                            to={`/releases/${rel.release_id}?window=${activeWindow}`}
                            className="flex-1 bg-[#9B6DFF] text-[#121212] font-mono font-bold text-xs py-1.5 px-3 rounded-[4px] border-[1.5px] border-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] flex items-center justify-center gap-1 transition-transform"
                          >
                            VIEW RELEASE <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/albums/${rel.album_id}?window=${activeWindow}`}
                            className="bg-white text-[#121212] font-mono font-medium text-xs py-1.5 px-3 rounded-[4px] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5] flex items-center justify-center gap-1 transition-colors"
                            title="View Parent Album"
                          >
                            ALBUM →
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* 7-Column Table View */
                <div
                  className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md overflow-x-auto"
                  data-testid="releases-table-view"
                >
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] font-bold text-[#121212] uppercase tracking-wider">
                        <th className="py-3 px-4">Combined Artist & Album</th>
                        <th className="py-3 px-4">Variant</th>
                        <th className="py-3 px-4">Retailer</th>
                        <th className="py-3 px-4 w-36">Hype Index</th>
                        <th className="py-3 px-4">Hype Velocity</th>
                        <th className="py-3 px-4">Submission Metrics</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0DA] font-sans text-xs">
                      {(items as ReleaseItem[]).map((rel) => {
                        const variantDisplay = rel.variant || 'Standard Pressing'
                        const retailerDisplay = rel.retailer_name || 'Wide / Unspecified'

                        return (
                          <tr
                            key={rel.release_id}
                            className="hover:bg-[#FAF7F5] transition-colors"
                            data-testid={`release-row-${rel.release_id}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <VinylMonogram
                                  name={rel.album_title}
                                  entityId={rel.monogram_key}
                                  size={32}
                                />
                                <div>
                                  <Link
                                    to={`/releases/${rel.release_id}?window=${activeWindow}`}
                                    className="font-grotesk font-bold text-sm text-[#121212] hover:text-[#9B6DFF] block"
                                  >
                                    {rel.album_title}
                                  </Link>
                                  <span className="text-[#646464] block">{rel.combined_artist}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-[4px] border border-[#121212] font-mono text-xs ${
                                  rel.variant
                                    ? 'bg-[#F7F3F0] text-[#121212]'
                                    : 'bg-white text-[#646464] border-dashed'
                                }`}
                              >
                                {variantDisplay}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#646464]">{retailerDisplay}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                {renderTierBadge(rel.hype_index, rel.tier)}
                                {renderTierBar(rel.hype_index, rel.tier)}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                              +{rel.hype_velocity} pts/hr
                            </td>
                            <td className="py-3 px-4 font-mono text-[#646464]">
                              {rel.score} pts · {rel.num_comments} cmts · {rel.submission_count} posts
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                to={`/releases/${rel.release_id}?window=${activeWindow}`}
                                className="bg-[#9B6DFF] text-[#121212] font-mono font-bold text-xs py-1 px-2.5 rounded-[4px] border-[1.5px] border-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] inline-flex items-center gap-1 transition-transform"
                              >
                                View Release →
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* TAB 2: ALBUMS (7-Column Ledger) */}
          {activeTab === 'albums' && (
            <div
              className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md overflow-x-auto"
              data-testid="albums-ledger-table"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] font-bold text-[#121212] uppercase tracking-wider">
                    <th className="py-3 px-4">Album & Combined Artist</th>
                    <th className="py-3 px-4">Child Releases</th>
                    <th className="py-3 px-4">Retailers</th>
                    <th className="py-3 px-4">Submissions</th>
                    <th className="py-3 px-4">Hype Velocity</th>
                    <th className="py-3 px-4 w-36">Hype Index</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0DA] font-sans text-xs">
                  {(items as AlbumItem[]).map((alb) => (
                    <tr
                      key={alb.album_id}
                      className="hover:bg-[#FAF7F5] transition-colors"
                      data-testid={`album-row-${alb.album_id}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <VinylMonogram
                            name={alb.album_title}
                            entityId={alb.monogram_key}
                            size={32}
                          />
                          <div>
                            <Link
                              to={`/albums/${alb.album_id}?window=${activeWindow}`}
                              className="font-grotesk font-bold text-sm text-[#121212] hover:text-[#9B6DFF] block"
                            >
                              {alb.album_title}
                            </Link>
                            <span className="text-[#646464] block">{alb.combined_artist}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-[4px] border border-[#121212] font-mono text-xs bg-white font-bold text-[#121212]">
                            {alb.release_count} {alb.release_count === 1 ? 'Pressing' : 'Pressings'}
                          </span>
                          {alb.preview_variants.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {alb.preview_variants.map((v, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-[#F7F3F0] text-[10px] font-mono text-[#646464] border border-[#E5E0DA] max-w-[140px] truncate"
                                  title={v}
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {alb.retailers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {alb.retailers.map((r, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-white text-[11px] font-sans text-[#121212] border border-[#121212]"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#646464] italic">Wide / Unspecified</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#646464]">
                        {alb.score} pts · {alb.num_comments} cmts · {alb.submission_count} posts
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                        +{alb.hype_velocity} pts/hr
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          {renderTierBadge(alb.hype_index, alb.tier)}
                          {renderTierBar(alb.hype_index, alb.tier)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/albums/${alb.album_id}?window=${activeWindow}`}
                          className="bg-[#9B6DFF] text-[#121212] font-mono font-bold text-xs py-1 px-2.5 rounded-[4px] border-[1.5px] border-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] inline-flex items-center gap-1 transition-transform"
                        >
                          View Album →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: ARTISTS (7-Column Ledger) */}
          {activeTab === 'artists' && (
            <div
              className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md overflow-x-auto"
              data-testid="artists-ledger-table"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] font-bold text-[#121212] uppercase tracking-wider">
                    <th className="py-3 px-4">Artist</th>
                    <th className="py-3 px-4">Catalog Footprint</th>
                    <th className="py-3 px-4">Total Releases</th>
                    <th className="py-3 px-4">Total Submissions</th>
                    <th className="py-3 px-4">Hype Velocity</th>
                    <th className="py-3 px-4 w-36">Hype Index</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0DA] font-sans text-xs">
                  {(items as ArtistItem[]).map((art) => (
                    <tr
                      key={art.artist_id}
                      className="hover:bg-[#FAF7F5] transition-colors"
                      data-testid={`artist-row-${art.artist_id}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <VinylMonogram
                            name={art.name}
                            entityId={art.monogram_key}
                            size={32}
                          />
                          <Link
                            to={`/artists/${art.artist_id}?window=${activeWindow}`}
                            className="font-grotesk font-bold text-sm text-[#121212] hover:text-[#9B6DFF] block"
                          >
                            {art.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded-[4px] border border-[#121212] bg-[#F7F3F0] font-bold text-[#121212]">
                            {art.solo_album_count} Solo
                          </span>
                          <span className="text-[#646464]">·</span>
                          <span className="px-2 py-0.5 rounded-[4px] border border-[#121212] bg-white text-[#646464]">
                            {art.combined_album_count} Combined
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                        {art.release_count} {art.release_count === 1 ? 'Pressing' : 'Pressings'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#646464]">
                        {art.score} pts · {art.num_comments} cmts · {art.submission_count} posts
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                        +{art.hype_velocity} pts/hr
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          {renderTierBadge(art.hype_index, art.tier)}
                          {renderTierBar(art.hype_index, art.tier)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/artists/${art.artist_id}?window=${activeWindow}`}
                          className="bg-[#9B6DFF] text-[#121212] font-mono font-bold text-xs py-1 px-2.5 rounded-[4px] border-[1.5px] border-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] inline-flex items-center gap-1 transition-transform"
                        >
                          View Artist →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Brutalist Pagination Controls */}
          <div
            className="flex items-center justify-between border-t-[1.5px] border-[#121212] pt-4 mt-2"
            data-testid="directory-pagination"
          >
            <div className="font-mono text-xs text-[#646464]" data-testid="pagination-info">
              Showing {(activePage - 1) * 20 + 1}–{Math.min(activePage * 20, totalItems)} of {totalItems} records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateParams({ page: String(activePage - 1) })}
                disabled={activePage <= 1}
                className={`px-3 py-1.5 rounded-[4px] border-[1.5px] border-[#121212] font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                  activePage <= 1
                    ? 'bg-[#E5E0DA] text-[#A0A0A0] cursor-not-allowed border-[#A0A0A0]'
                    : 'bg-white text-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:bg-[#FAF7F5]'
                }`}
                data-testid="pagination-prev"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> PREV
              </button>

              <span className="font-mono text-xs font-bold text-[#121212] px-2" data-testid="pagination-pages">
                Page {activePage} of {totalPages}
              </span>

              <button
                onClick={() => updateParams({ page: String(activePage + 1) })}
                disabled={activePage >= totalPages}
                className={`px-3 py-1.5 rounded-[4px] border-[1.5px] border-[#121212] font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                  activePage >= totalPages
                    ? 'bg-[#E5E0DA] text-[#A0A0A0] cursor-not-allowed border-[#A0A0A0]'
                    : 'bg-white text-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:bg-[#FAF7F5]'
                }`}
                data-testid="pagination-next"
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
