import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, Flame, Layers, Search, Sparkles, TrendingUp, X } from 'lucide-react'
import { VinylMonogram } from '../components/VinylMonogram'
import { TierBadge } from '../components/TierBadge'
import { formatRelativeTime } from '../utils/formatTime'

type WindowType = '24H' | '7D' | '1M'
type TierFilter = 'all' | 'high' | 'moderate' | 'low'
type SortOption = 'hype_index' | 'velocity' | 'recency'

interface AlbumLeaderboardItem {
  album_id: string
  album_title: string
  combined_artist: string
  hype_index: number
  hype_velocity: number
  tier: 'high' | 'moderate' | 'low'
  release_count: number
  submission_count?: number
  monogram_key: string
}

interface ReleaseLeaderboardItem {
  release_id: string
  album_id: string
  album_title: string
  combined_artist: string
  variant: string | null
  retailer_name: string | null
  hype_index: number
  hype_velocity: number
  tier: 'high' | 'moderate' | 'low'
  monogram_key: string
}

interface NewlyAddedReleaseItem {
  release_id: string
  album_id: string
  album_title: string
  combined_artist: string
  variant: string | null
  retailer_name: string | null
  hype_index: number
  hype_velocity: number
  tier: 'high' | 'moderate' | 'low'
  monogram_key: string
  first_seen_at: string
  latest_score?: number
}

interface LiveFeedItem {
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
  posted_at: string
  monogram_key: string
}

interface DashboardResponse {
  window: WindowType
  top_albums: AlbumLeaderboardItem[]
  top_releases: ReleaseLeaderboardItem[]
  newly_added: NewlyAddedReleaseItem[]
  live_feed: LiveFeedItem[]
}

function parseWindow(raw: string | null): WindowType {
  const upper = raw?.toUpperCase()
  if (upper === '7D' || upper === '1M') return upper
  return '24H'
}

async function fetchDashboard(window: WindowType): Promise<DashboardResponse> {
  const res = await fetch(`/api/v1/dashboard?window=${window}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard data: ${res.statusText}`)
  }
  return res.json()
}

const WINDOW_OPTIONS: WindowType[] = ['24H', '7D', '1M']

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'

interface HypeWindowSwitcherProps {
  activeWindow: WindowType
  onChange: (w: WindowType) => void
  label: string
}

const HypeWindowSwitcher: React.FC<HypeWindowSwitcherProps> = ({
  activeWindow,
  onChange,
  label,
}) => (
  <div
    role="group"
    aria-label={label}
    className="flex items-center gap-1 p-1 bg-canvas rounded-full border-strong shrink-0"
  >
    {WINDOW_OPTIONS.map((w) => {
      const isActive = activeWindow === w
      return (
        <button
          key={w}
          type="button"
          data-window={w}
          aria-pressed={isActive}
          onClick={() => onChange(w)}
          className={`min-h-[26px] min-w-[32px] px-2.5 py-0.5 rounded-full font-mono text-[11px] border-strong transition-colors cursor-pointer ${FOCUS_RING_CLASS} ${
            isActive
              ? 'bg-ink-primary text-white font-bold shadow-brutal-sm'
              : 'bg-card text-ink-primary hover:bg-row-hover'
          }`}
        >
          {w}
        </button>
      )
    })}
  </div>
)

const LeaderboardSkeletonRows: React.FC<{ testId: string }> = ({ testId }) => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={`${testId}-${i}`}
        className="h-[52px] bg-accent-sand border-strong rounded-[4px] animate-pulse"
        data-testid={testId}
      />
    ))}
  </>
)

interface LeaderboardEmptySlotsProps {
  filledCount: number
  window: WindowType
  testId: string
}

const LeaderboardEmptySlots: React.FC<LeaderboardEmptySlotsProps> = ({
  filledCount,
  window,
  testId,
}) => {
  const slotCount = Math.max(0, 5 - filledCount)
  return (
    <>
      {Array.from({ length: slotCount }).map((_, i) => (
        <div
          key={`${testId}-${i}`}
          data-testid={testId}
          className="min-h-[52px] px-3 py-1.5 border border-dashed border-border-hairline rounded-[4px] flex items-center justify-center text-center text-[11px] font-mono text-ink-secondary select-none"
        >
          No additional active items in {window} window — switch to 7D or 1M
        </div>
      ))}
    </>
  )
}

export const DemandDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlWindow = parseWindow(searchParams.get('window'))

  // Independent window switchers for Top Albums and Top Releases initialized from URL
  const [prevUrlWindow, setPrevUrlWindow] = useState<WindowType>(urlWindow)
  const [pendingUrlWindow, setPendingUrlWindow] = useState<WindowType | null>(null)
  const [albumWindow, setAlbumWindow] = useState<WindowType>(urlWindow)
  const [releaseWindow, setReleaseWindow] = useState<WindowType>(urlWindow)

  // Synchronize both switchers only when URL ?window= changes externally
  if (urlWindow !== prevUrlWindow) {
    setPrevUrlWindow(urlWindow)
    if (pendingUrlWindow === urlWindow) {
      setPendingUrlWindow(null)
    } else {
      setPendingUrlWindow(null)
      setAlbumWindow(urlWindow)
      setReleaseWindow(urlWindow)
    }
  }

  const updateCardWindow = (
    w: WindowType,
    setCardWindow: React.Dispatch<React.SetStateAction<WindowType>>
  ) => {
    setCardWindow(w)
    setPendingUrlWindow(w !== urlWindow ? w : null)
    const next = new URLSearchParams(searchParams)
    next.set('window', w)
    setSearchParams(next)
  }

  const handleAlbumWindowChange = (w: WindowType) => updateCardWindow(w, setAlbumWindow)
  const handleReleaseWindowChange = (w: WindowType) => updateCardWindow(w, setReleaseWindow)

  // Live Release Feed controls
  const [feedQuery, setFeedQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('hype_index')

  const {
    data: albumData,
    isLoading: albumLoading,
    isError: isAlbumError,
    error: albumError,
    refetch: refetchAlbum,
  } = useQuery({
    queryKey: ['dashboard', albumWindow],
    queryFn: () => fetchDashboard(albumWindow),
  })

  const {
    data: releaseData,
    isLoading: releaseLoading,
    isError: isReleaseError,
    error: releaseError,
    refetch: refetchRelease,
  } = useQuery({
    queryKey: ['dashboard', releaseWindow],
    queryFn: () => fetchDashboard(releaseWindow),
  })

  const {
    data: fixed24hData,
    isLoading: fixed24hLoading,
    isError: isFixed24hError,
    error: fixed24hError,
    refetch: refetchFixed24h,
  } = useQuery({
    queryKey: ['dashboard', '24H'],
    queryFn: () => fetchDashboard('24H'),
  })

  const hasDashboardError = isAlbumError || isReleaseError || isFixed24hError
  const dashboardErrorMessage =
    (albumError instanceof Error ? albumError.message : null) ||
    (releaseError instanceof Error ? releaseError.message : null) ||
    (fixed24hError instanceof Error ? fixed24hError.message : null) ||
    'Failed to load demand intelligence.'

  // Filter and sort Live Release Feed (fixed 24H cohort)
  const filteredFeed = useMemo(() => {
    const rawFeed = fixed24hData?.live_feed ?? []
    let result = [...rawFeed]

    if (feedQuery.trim()) {
      const q = feedQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.album_title.toLowerCase().includes(q) ||
          item.combined_artist.toLowerCase().includes(q) ||
          (item.variant && item.variant.toLowerCase().includes(q)) ||
          (item.retailer_name && item.retailer_name.toLowerCase().includes(q))
      )
    }

    if (tierFilter !== 'all') {
      result = result.filter((item) => item.tier === tierFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'velocity') {
        return b.hype_velocity - a.hype_velocity
      }
      if (sortBy === 'recency') {
        return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      }
      // default: hype_index
      return b.hype_index - a.hype_index
    })

    return result
  }, [fixed24hData?.live_feed, feedQuery, tierFilter, sortBy])

  const topAlbums = albumData?.top_albums || []
  const topReleases = releaseData?.top_releases || []
  const newlyAdded = fixed24hData?.newly_added || []

  return (
    <div className="flex flex-col gap-6" data-testid="screen-demand-dashboard">
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-ink-primary tracking-tight">
          Demand Dashboard
        </h1>
        <p className="font-sans text-sm text-ink-secondary mt-1">
          Live r/vinylreleases demand signals, leaderboard rankings, and submission velocity.
        </p>
      </div>

      {/* Coral Error Alert Banner */}
      {hasDashboardError && (
        <div
          role="alert"
          className="bg-alert-coral border-strong rounded-[6px] shadow-brutal-md p-6 text-ink-primary flex flex-col gap-4"
          data-testid="dashboard-error-banner"
        >
          <div className="flex items-center gap-2 font-grotesk font-bold text-lg">
            <AlertTriangle className="w-5 h-5 text-ink-primary" aria-hidden="true" />
            Failed to load demand intelligence
          </div>
          <p className="font-sans text-sm">{dashboardErrorMessage}</p>
          <div>
            <button
              type="button"
              onClick={() => {
                refetchAlbum()
                refetchRelease()
                if (isFixed24hError) {
                  refetchFixed24h()
                }
              }}
              className={`px-4 py-2 bg-ink-primary text-white font-mono text-xs font-bold rounded-[4px] shadow-brutal-sm hover:bg-accent-primary hover:text-ink-primary transition-colors cursor-pointer ${FOCUS_RING_CLASS}`}
              data-testid="dashboard-retry-btn"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Top 3 Intelligence Cards Row (Uniform 5-Row Height) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Card 1: Top Albums */}
        <div
          className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between"
          data-testid="card-top-albums"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-grotesk font-bold text-lg text-ink-primary flex items-center gap-2 min-w-0">
              <Flame className="w-4 h-4 text-ink-primary shrink-0" aria-hidden="true" />
              <span>Top Albums</span>
            </h2>
            <HypeWindowSwitcher
              activeWindow={albumWindow}
              onChange={handleAlbumWindowChange}
              label="Top Albums Hype Window"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {albumLoading ? (
              <LeaderboardSkeletonRows testId="album-skeleton-row" />
            ) : (
                  <>
                    {topAlbums.map((album, idx) => {
                      const submissionCount = album.submission_count ?? 0
                      const fullTitle = `${album.combined_artist} — ${album.album_title}`
                      return (
                        <div
                          key={album.album_id}
                          className="flex items-center justify-between gap-3 p-2 bg-row-hover border border-border-hairline rounded-[4px] hover:border-ink-primary transition-colors min-h-[52px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="bg-ink-primary text-white font-mono text-xs font-bold px-1.5 py-0.5 rounded-[4px] shrink-0">
                              #{idx + 1}
                            </span>
                            <VinylMonogram
                              name={album.album_title}
                              entityId={album.monogram_key || album.album_id}
                              size={32}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/albums/${album.album_id}?window=${albumWindow}`}
                                className={`font-grotesk font-bold text-xs text-ink-primary hover:underline truncate block rounded-[2px] ${FOCUS_RING_CLASS}`}
                                title={fullTitle}
                              >
                                {fullTitle}
                              </Link>
                              <div className="text-[11px] text-ink-secondary font-sans truncate">
                                {submissionCount}{' '}
                                {submissionCount === 1 ? 'Submission' : 'Submissions'} ·{' '}
                                {album.release_count}{' '}
                                {album.release_count === 1 ? 'Release' : 'Releases'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 w-24">
                            <TierBadge value={album.hype_index} tier={album.tier} />
                            <div className="w-full bg-accent-sand h-1.5 rounded-[2px] mt-1 overflow-hidden border border-ink-primary">
                              <div
                                className={`h-full ${
                                  album.tier === 'high'
                                    ? 'bg-hype-high'
                                    : album.tier === 'moderate'
                                    ? 'bg-hype-moderate'
                                    : 'bg-ink-secondary'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, album.hype_index))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-ink-secondary mt-0.5">
                              +{album.hype_velocity} pts/hr
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {/* Uniform 5-Row Padding */}
                    <LeaderboardEmptySlots
                      filledCount={topAlbums.length}
                      window={albumWindow}
                      testId="empty-slot-album"
                    />
                  </>
                )}
          </div>
        </div>

        {/* Card 2: Top Releases */}
        <div
          className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between"
          data-testid="card-top-releases"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-grotesk font-bold text-lg text-ink-primary flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-ink-primary shrink-0" aria-hidden="true" />
              <span>Top Releases</span>
            </h2>
            <HypeWindowSwitcher
              activeWindow={releaseWindow}
              onChange={handleReleaseWindowChange}
              label="Top Releases Hype Window"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {releaseLoading ? (
              <LeaderboardSkeletonRows testId="release-skeleton-row" />
            ) : (
                  <>
                    {topReleases.map((release, idx) => {
                      const fullTitle = `${release.combined_artist} — ${release.album_title}`
                      return (
                        <div
                          key={release.release_id}
                          className="flex items-center justify-between gap-3 p-2 bg-row-hover border border-border-hairline rounded-[4px] hover:border-ink-primary transition-colors min-h-[52px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="bg-ink-primary text-white font-mono text-xs font-bold px-1.5 py-0.5 rounded-[4px] shrink-0">
                              #{idx + 1}
                            </span>
                            <VinylMonogram
                              name={release.album_title}
                              entityId={release.monogram_key || release.release_id}
                              size={32}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/releases/${release.release_id}?window=${releaseWindow}`}
                                className={`font-grotesk font-bold text-xs text-ink-primary hover:underline truncate block rounded-[2px] ${FOCUS_RING_CLASS}`}
                                title={fullTitle}
                              >
                                {fullTitle}
                              </Link>
                              <div className="text-[11px] text-ink-secondary font-sans truncate">
                                {release.variant || 'Standard Pressing'} ·{' '}
                                {release.retailer_name || 'Wide / Unspecified'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <TierBadge value={release.hype_index} tier={release.tier} />
                            <span className="font-mono text-[10px] text-ink-secondary mt-0.5">
                              +{release.hype_velocity} pts/hr
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {/* Uniform 5-Row Padding */}
                    <LeaderboardEmptySlots
                      filledCount={topReleases.length}
                      window={releaseWindow}
                      testId="empty-slot-release"
                    />
                  </>
                )}
          </div>
        </div>

        {/* Card 3: Newly Added Releases */}
        <div
          className="bg-card border-strong rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between"
          data-testid="card-newly-added"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-grotesk font-bold text-lg text-ink-primary flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-ink-primary shrink-0" aria-hidden="true" />
              <span>Newly Added Releases</span>
            </h2>
            <span className="font-mono text-[10px] bg-row-hover border-strong px-2 py-0.5 rounded-full font-bold text-ink-primary shrink-0">
              LAST 24H
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {fixed24hLoading ? (
              <LeaderboardSkeletonRows testId="newly-added-skeleton-row" />
            ) : (
                  <>
                    {newlyAdded.map((release) => {
                      const fullTitle = `${release.combined_artist} — ${release.album_title}`
                      return (
                        <div
                          key={release.release_id}
                          className="flex items-center justify-between gap-3 p-2 bg-row-hover border border-border-hairline rounded-[4px] hover:border-ink-primary transition-colors min-h-[52px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[10px] text-ink-secondary bg-card border border-border-hairline px-1.5 py-0.5 rounded shrink-0">
                              {formatRelativeTime(release.first_seen_at)}
                            </span>
                            <VinylMonogram
                              name={release.album_title}
                              entityId={release.monogram_key || release.release_id}
                              size={32}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/releases/${release.release_id}?window=24H`}
                                className={`font-grotesk font-bold text-xs text-ink-primary hover:underline truncate block rounded-[2px] ${FOCUS_RING_CLASS}`}
                                title={fullTitle}
                              >
                                {fullTitle}
                              </Link>
                              <div className="text-[11px] text-ink-secondary font-sans truncate">
                                {release.variant || 'Standard Pressing'} ·{' '}
                                {release.retailer_name || 'Wide / Unspecified'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <TierBadge value={release.hype_index} tier={release.tier} />
                            <span className="font-mono text-[10px] text-ink-secondary mt-0.5">
                              +{release.hype_velocity} pts/hr · {release.latest_score ?? 0} pts
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {/* Uniform 5-Row Padding */}
                    <LeaderboardEmptySlots
                      filledCount={newlyAdded.length}
                      window="24H"
                      testId="empty-slot-newly-added"
                    />
                  </>
                )}
          </div>
        </div>
      </div>

      {/* Full-Width Live Release Feed */}
      <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col gap-4">
        {/* Header and Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E0DA]">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#121212]" />
              <h2 className="font-grotesk font-bold text-lg text-[#121212]">
                Live Release Feed
              </h2>
            </div>
            <p className="font-sans text-xs text-[#646464] mt-0.5">
              Live pressings ledger with real-time velocity, variant specs, and Reddit community conviction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[220px]">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#646464] pointer-events-none" />
              <input
                type="text"
                value={feedQuery}
                onChange={(e) => setFeedQuery(e.target.value)}
                placeholder="Filter feed by artist, album, variant, retailer..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#FAF7F5] border-[1.5px] border-[#121212] rounded-[4px] font-sans text-xs text-[#121212] placeholder-[#646464] focus:outline-none focus:bg-white shadow-brutal-sm"
              />
              {feedQuery && (
                <button
                  onClick={() => setFeedQuery('')}
                  className="absolute right-2 text-[#646464] hover:text-[#121212]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tier Filter Pills */}
            <div className="flex items-center bg-[#F7F3F0] p-0.5 rounded-full border-[1.5px] border-[#121212]">
              {(['all', 'high', 'moderate', 'low'] as TierFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] capitalize transition-all ${
                    tierFilter === t
                      ? 'bg-[#121212] text-white font-bold shadow-brutal-sm'
                      : 'text-[#646464] hover:text-[#121212]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#646464] uppercase text-[11px]">SORT:</span>
              <select
                data-testid="feed-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-white border-[1.5px] border-[#121212] rounded-[4px] px-2 py-1 font-mono text-xs text-[#121212] shadow-brutal-sm focus:outline-none cursor-pointer"
              >
                <option value="hype_index">Hype Index ↓</option>
                <option value="velocity">Hype Velocity ↓</option>
                <option value="recency">Recency ↓</option>
              </select>
            </div>
          </div>
        </div>

        {/* 7-Column Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-[1.5px] border-[#121212] bg-[#F7F3F0] text-[11px] font-mono font-semibold text-[#646464] uppercase tracking-wider">
                <th className="py-2.5 px-3">Release & Artist</th>
                <th className="py-2.5 px-3">Variant</th>
                <th className="py-2.5 px-3">Retailer</th>
                <th className="py-2.5 px-3 text-center">Hype Index</th>
                <th className="py-2.5 px-3 text-right">Velocity</th>
                <th className="py-2.5 px-3 text-right">Reddit Demand</th>
                <th className="py-2.5 px-3 text-right">Action / Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0DA] font-sans text-xs">
              {fixed24hLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`feed-skel-${idx}`} data-testid="feed-skeleton-row" className="h-[56px]">
                    <td colSpan={7} className="py-3 px-3">
                      <div className="h-8 bg-[#E5E0DA] border-[1.5px] border-[#121212] rounded-[4px] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredFeed.length === 0 ? (
                <tr data-testid="feed-empty-state">
                  <td colSpan={7} className="py-12 text-center">
                    <div className="font-mono text-base font-bold text-[#121212]">
                      0 MATCHING RECORDS
                    </div>
                    <div className="text-xs text-[#646464] mt-2 font-sans flex items-center justify-center gap-2 flex-wrap">
                      {feedQuery && (
                        <span className="inline-block bg-[#F7F3F0] border border-[#121212] px-2.5 py-0.5 rounded font-mono text-xs text-[#121212]">
                          Query: &quot;{feedQuery}&quot;
                        </span>
                      )}
                      {tierFilter !== 'all' && (
                        <span className="inline-block bg-[#F7F3F0] border border-[#121212] px-2.5 py-0.5 rounded font-mono text-xs text-[#121212]">
                          Tier: {tierFilter.toUpperCase()}
                        </span>
                      )}
                      {!feedQuery && tierFilter === 'all' && (
                        <span>No live release feed records matched your current query or tier filter.</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setFeedQuery('')
                        setTierFilter('all')
                        setSortBy('hype_index')
                      }}
                      data-testid="reset-filters-btn"
                      className="mt-4 px-4 py-2 bg-[#9B6DFF] border-[1.5px] border-[#121212] rounded-[4px] font-mono text-xs font-bold text-[#121212] shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                    >
                      Reset Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredFeed.map((item) => (
                  <tr
                    key={item.release_id}
                    data-testid="feed-table-row"
                    className="hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* 1. Release & Artist */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <VinylMonogram
                          name={item.album_title}
                          entityId={item.monogram_key || item.album_id}
                          size={32}
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/albums/${item.album_id}?window=24H`}
                            className="font-grotesk font-bold text-xs text-[#121212] hover:underline block truncate"
                          >
                            {item.album_title}
                          </Link>
                          <div className="text-[11px] text-[#646464] truncate">
                            {item.combined_artist}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Variant */}
                    <td className="py-3 px-3">
                      <span className="inline-block border-[1.5px] border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-[11px] bg-white text-[#121212] shadow-brutal-sm max-w-[160px] truncate">
                        {item.variant || 'Standard Pressing'}
                      </span>
                    </td>

                    {/* 3. Retailer */}
                    <td className="py-3 px-3">
                      <span className="text-[#646464] font-sans text-xs max-w-[140px] truncate block">
                        {item.retailer_name || 'Wide / Unspecified'}
                      </span>
                    </td>

                    {/* 4. Hype Index */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1 w-20">
                        <TierBadge value={item.hype_index} tier={item.tier} />
                        <div className="w-full h-1.5 bg-[#E5E0DA] rounded-full overflow-hidden border border-[#121212]">
                          <div
                            className={`h-full ${
                              item.tier === 'high'
                                ? 'bg-[#68D391]'
                                : item.tier === 'moderate'
                                ? 'bg-[#ECC94B]'
                                : 'bg-[#646464]'
                            }`}
                            style={{ width: `${item.hype_index}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 5. Velocity */}
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-[#121212]">
                      +{item.hype_velocity} pts/hr
                    </td>

                    {/* 6. Reddit Demand */}
                    <td className="py-3 px-3 text-right font-mono text-xs text-[#646464]">
                      <span className="font-bold text-[#121212]">{item.score}</span> pts ·{' '}
                      <span className="font-bold text-[#121212]">{item.num_comments}</span> cmts
                    </td>

                    {/* 7. Action / Posted */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          to={`/releases/${item.release_id}?window=24H`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#121212] hover:text-[#9B6DFF] transition-colors"
                        >
                          View <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <span className="font-mono text-[10px] text-[#646464]">
                          {formatRelativeTime(item.posted_at)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
