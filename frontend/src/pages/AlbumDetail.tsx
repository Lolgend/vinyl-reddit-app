import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowLeft, Disc, Flame, Layers } from 'lucide-react'
import {
  ActivityOverTimeChart,
  type SubmissionMarker,
  type TimeSeriesBucket,
} from '../components/ActivityOverTimeChart'
import { EntityEditorialHeader, type HypeWindow } from '../components/EntityEditorialHeader'
import { TierBadge } from '../components/TierBadge'
import { formatRelativeTime } from '../utils/formatTime'

type WindowType = HypeWindow
type TierType = 'high' | 'moderate' | 'low'

interface ShareOfDemandItem {
  release_id: string
  variant: string | null
  retailer_name: string | null
  share_percentage: number
  points: number
}

interface ChildReleaseRow {
  release_id: string
  variant: string | null
  retailer_name: string | null
  share_percentage: number
  hype_velocity: number
  hype_index: number
  tier: TierType
  submission_count: number
  total_score: number
  total_comments: number
  first_seen_at: string | null
  last_seen_at: string | null
}

interface AlbumDetailResponse {
  album_id: string
  album_title: string
  combined_artist: string
  monogram_key: string
  first_seen_at: string | null
  last_seen_at: string | null
  window: WindowType
  artists?: Array<{ artist_id: string; name: string }>
  album: {
    album_id: string
    album_title: string
    combined_artist: string
    monogram_key: string
    first_seen_at: string | null
    last_seen_at: string | null
    artists: Array<{ artist_id: string; name: string }>
  }
  hero_kpi: {
    hype_index: number
    tier: TierType
    hype_velocity: number
    points_gain: number
    total_score: number
    total_comments: number
    submission_count: number
    release_count: number
    first_seen_at: string | null
    last_seen_at: string | null
    reddit_demand: {
      points_gain: number
      total_score: number
      total_comments: number
      submission_count: number
    }
    pressings_provenance: {
      release_count: number
      submission_count: number
      first_seen_at: string | null
      last_seen_at: string | null
    }
  }
  time_series: TimeSeriesBucket[]
  submission_markers: SubmissionMarker[]
  share_of_demand: ShareOfDemandItem[]
  child_releases: ChildReleaseRow[]
}

async function fetchAlbumDetail(albumId: string, window: WindowType): Promise<AlbumDetailResponse> {
  const res = await fetch(`/api/v1/albums/${albumId}?window=${window}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch album detail: ${res.statusText}`)
  }
  return res.json()
}

export const AlbumDetail: React.FC = () => {
  const { albumId = '' } = useParams<{ albumId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawWindow = searchParams.get('window')?.toUpperCase()
  const window: WindowType =
    rawWindow === '7D' || rawWindow === '1M' ? rawWindow : '24H'

  const handleWindowChange = (newWindow: WindowType) => {
    setSearchParams({ window: newWindow })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['album', albumId, window],
    queryFn: () => fetchAlbumDetail(albumId, window),
    enabled: Boolean(albumId),
  })

  // Loading Skeleton State matching exact container geometries
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" data-testid="screen-album-detail-loading">
        <div className="w-32 h-4 bg-[#E5E0DA] rounded animate-pulse" />
        <div className="border-b-[3px] border-[#121212] pb-3 flex items-end justify-between gap-3">
          <div className="w-36 h-10 bg-[#E5E0DA] rounded animate-pulse" />
          <div className="w-36 h-8 bg-[#E5E0DA] rounded-full animate-pulse" />
        </div>
        <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 flex items-center gap-4">
          <div className="w-[68px] h-[68px] rounded-[6px] bg-[#E5E0DA] border-[1.5px] border-[#121212] animate-pulse shrink-0" />
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
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 h-80 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
            <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-full h-48 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-64 h-4 bg-[#E5E0DA] rounded animate-pulse" />
          </div>
          <div className="col-span-12 lg:col-span-4 h-80 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
            <div className="w-32 h-6 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex flex-col gap-1.5">
                  <div className="w-full h-3 bg-[#E5E0DA] rounded animate-pulse" />
                  <div className="w-full h-2.5 bg-[#E5E0DA] rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="w-full h-3 bg-[#E5E0DA] rounded animate-pulse" />
          </div>
        </div>
        <div className="h-64 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
          <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, k) => (
              <div key={k} className="w-full h-10 bg-[#E5E0DA] rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error State with Coral Alert Banner
  if (isError || !data) {
    return (
      <div
        className="bg-[#F56565] border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 text-[#121212] flex flex-col gap-4"
        data-testid="album-detail-error"
      >
        <div className="flex items-center gap-2 font-grotesk font-bold text-lg">
          <AlertTriangle className="w-5 h-5 text-[#121212]" />
          Failed to load album intelligence
        </div>
        <p className="font-sans text-sm">
          {error instanceof Error ? error.message : 'The album could not be found or the server returned an error.'}
        </p>
        <div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#121212] text-white font-mono text-xs font-bold rounded-[4px] shadow-brutal-sm hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors"
            data-testid="album-retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { hero_kpi, time_series, submission_markers, share_of_demand, child_releases } = data
  const hasActivity =
    (hero_kpi.points_gain ?? 0) > 0 ||
    (hero_kpi.reddit_demand?.points_gain ?? 0) > 0 ||
    time_series.some((b) => b.velocity_pts_per_hr > 0 || b.cumulative_points > 0)

  // Format last seen date string
  const lastSeenDate = data.last_seen_at
    ? `${formatRelativeTime(data.last_seen_at)} (${new Date(data.last_seen_at).toISOString().split('T')[0]})`
    : 'NEVER'

  const artists = data.album?.artists ?? data.artists ?? []

  return (
    <div className="flex flex-col gap-6" data-testid="screen-album-detail">
      <EntityEditorialHeader
        entityLabel="ALBUM"
        activeWindow={window}
        onWindowChange={handleWindowChange}
        backLinks={
          <Link
            to={`/directory?tab=albums&window=${window}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Directory
          </Link>
        }
        monogram={{
          name: data.album_title,
          entityId: data.monogram_key || data.album_id,
          shape: 'square',
        }}
      >
        <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
          {data.album_title}
        </h1>
        {(artists.length === 0 || artists.length > 1) && data.combined_artist && (
          <div className="text-base text-[#646464] font-medium mt-0.5">
            {artists.length > 1 ? `Collaboration: ${data.combined_artist}` : data.combined_artist}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {artists.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="album-artist-chips">
              {artists.map((art) => (
                <Link
                  key={art.artist_id}
                  to={`/artists/${art.artist_id}?window=${window}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FAF7F5] border-[1.5px] border-[#121212] rounded-full font-mono text-xs font-bold text-[#121212] hover:bg-[#121212] hover:text-white transition-colors shadow-brutal-sm"
                  data-testid={`artist-chip-${art.artist_id}`}
                >
                  <span>{art.name}</span>
                  <span className="text-[10px] opacity-70">→</span>
                </Link>
              ))}
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-0.5 rounded-full font-mono text-[11px] text-[#121212]">
            <span className="text-[#646464]">LAST SEEN:</span>
            <span className="font-bold">{lastSeenDate}</span>
          </div>
        </div>
      </EntityEditorialHeader>

      {/* 3-Card Hero KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="hero-kpi-strip">
        {/* Card 1: Hype Index */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-hype-index"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#121212]" />
              Hype Index
            </span>
            <TierBadge value={hero_kpi.hype_index} tier={hero_kpi.tier} />
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.hype_index}{' '}
              <span className="text-sm font-normal text-[#646464]">/ 100</span>
            </div>
            <div className="w-full bg-[#E5E0DA] h-2 rounded-[2px] mt-2 overflow-hidden border border-[#121212]">
              <div
                className={`h-full ${
                  hero_kpi.tier === 'high'
                    ? 'bg-[#68D391]'
                    : hero_kpi.tier === 'moderate'
                    ? 'bg-[#ECC94B]'
                    : 'bg-[#646464]'
                }`}
                style={{ width: `${hero_kpi.hype_index}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Engagement */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-engagement"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#121212]" />
              Engagement
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.total_score} <span className="text-sm font-normal text-[#646464]">votes</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2 truncate">
              {hero_kpi.total_comments} comments · {hero_kpi.submission_count}{' '}
              {hero_kpi.submission_count === 1 ? 'mention' : 'mentions'}
            </div>
          </div>
        </div>

        {/* Card 3: Pressings */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-pressings"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-[#121212]" />
              Pressings
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.release_count}{' '}
              <span className="text-sm font-normal text-[#646464]">
                {hero_kpi.release_count === 1 ? 'Pressing' : 'Pressings'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              Last seen {formatRelativeTime(data.last_seen_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns): 8-col Activity Over Time Chart + 4-col Share-of-Demand */}
      <div className="grid grid-cols-12 gap-5">
        <ActivityOverTimeChart
          window={window}
          timeSeries={time_series}
          submissionMarkers={submission_markers}
          hasActivity={hasActivity}
          lastSeenDisplay={lastSeenDate}
          subtitle="Combined engagement across all pressings of this album."
          className="col-span-12 lg:col-span-8"
        />

        {/* 4-col Share-of-Demand Card */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12 lg:col-span-4 flex flex-col justify-between"
          data-testid="card-share-of-demand"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-grotesk font-bold text-lg text-[#121212]">
                Share of Demand
              </div>
              <span className="font-mono text-[11px] text-[#646464]">
                {share_of_demand.length} {share_of_demand.length === 1 ? 'Pressing' : 'Pressings'}
              </span>
            </div>
            <p className="font-sans text-xs text-[#646464] mb-4">
              How demand is split across pressings of this album.
            </p>

            {/* Variant Shares List */}
            <div className="flex flex-col gap-3.5">
              {share_of_demand.map((item) => {
                const variantName = item.variant || 'Standard Pressing'
                const retailerName = item.retailer_name || 'Wide / Unspecified'
                return (
                  <div key={item.release_id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-medium text-xs text-[#121212] truncate max-w-[200px]" title={variantName}>
                        {variantName}
                      </span>
                      <span className="font-mono font-bold text-xs text-[#121212]">
                        {item.share_percentage}%
                      </span>
                    </div>
                    {/* Horizontal Percentage Bar */}
                    <div className="w-full bg-[#E5E0DA] h-2.5 rounded-[2px] overflow-hidden border border-[#121212]">
                      <div
                        className="bg-[#9B6DFF] h-full transition-all"
                        style={{ width: `${item.share_percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#646464]">
                      <span>{retailerName}</span>
                      <span>{item.points} engagement</span>
                    </div>
                  </div>
                )
              })}

              {share_of_demand.length === 0 && (
                <div className="p-4 border border-dashed border-[#E5E0DA] rounded-[4px] text-center font-mono text-xs text-[#646464]">
                  No pressing variants recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row (12 columns) — 6-Column All Pressings Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-all-pressings"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            All Pressings
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {child_releases.length} {child_releases.length === 1 ? 'Pressing' : 'Pressings'}
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Compare physical pressings, retailers, share of demand, and engagement.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Variant</th>
                <th className="py-2.5 px-3">Retailer</th>
                <th className="py-2.5 px-3">Share of Demand</th>
                <th className="py-2.5 px-3">Hype Index</th>
                <th className="py-2.5 px-3">Engagement</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {child_releases.map((cr) => {
                const variantName = cr.variant || 'Standard Pressing'
                const retailerName = cr.retailer_name || 'Wide / Unspecified'
                return (
                  <tr
                    key={cr.release_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span className="inline-block bg-[#F7F3F0] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs text-[#121212]">
                        {variantName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-xs text-[#121212]">
                      {retailerName}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#121212] w-10">
                          {cr.share_percentage}%
                        </span>
                        <div className="w-16 bg-[#E5E0DA] h-1.5 rounded-[1px] overflow-hidden border border-[#121212]">
                          <div
                            className="bg-[#9B6DFF] h-full"
                            style={{ width: `${cr.share_percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <TierBadge value={cr.hype_index} tier={cr.tier} />
                        <div className="w-12 bg-[#E5E0DA] h-1.5 rounded-[1px] overflow-hidden border border-[#121212]">
                          <div
                            className={`h-full ${
                              cr.tier === 'high'
                                ? 'bg-[#68D391]'
                                : cr.tier === 'moderate'
                                ? 'bg-[#ECC94B]'
                                : 'bg-[#646464]'
                            }`}
                            style={{ width: `${cr.hype_index}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-[#646464]">
                      {cr.submission_count} {cr.submission_count === 1 ? 'mention' : 'mentions'} · {cr.total_score} votes · {cr.total_comments} comments
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/releases/${cr.release_id}?window=${window}`}
                        className="inline-block font-mono text-xs font-bold text-[#121212] bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-1 rounded-[4px] hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
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
      </div>
    </div>
  )
}

export default AlbumDetail
