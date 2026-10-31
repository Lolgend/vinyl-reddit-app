import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Disc,
  Flame,
  Layers,
  TrendingUp,
} from 'lucide-react'
import { VinylMonogram } from '../components/VinylMonogram'
import { formatRelativeTime } from '../utils/formatTime'

type WindowType = '24H' | '7D' | '1M'
type TierType = 'high' | 'moderate' | 'low'

interface TrackedAlbumRow {
  album_id: string
  album_title: string
  combined_artist: string
  billing_attribution: string
  release_count: number
  submission_count: number
  score: number
  num_comments: number
  hype_velocity: number
  hype_index: number
  tier: TierType
  first_seen_at: string | null
  last_seen_at: string | null
}

interface ChildReleaseLedgerRow {
  release_id: string
  album_id: string
  album_title: string
  combined_artist: string
  variant: string | null
  retailer_name: string | null
  submission_count: number
  score: number
  num_comments: number
  hype_velocity: number
  hype_index: number
  tier: TierType
  first_seen_at: string | null
  last_seen_at: string | null
}

interface ArtistDetailResponse {
  artist_id: string
  name: string
  monogram_key: string
  last_seen_at: string | null
  window: WindowType
  artist: {
    artist_id: string
    name: string
    monogram_key: string
    last_seen_at: string | null
  }
  hero_kpi: {
    hype_index: number
    tier: TierType
    hype_velocity: number
    catalog_footprint: {
      total_albums: number
      solo_album_count: number
      combined_album_count: number
      total_releases: number
    }
    reddit_demand: {
      total_submissions: number
      submission_count: number
      total_score: number
      total_comments: number
      points_gain: number
      last_seen: string | null
      last_seen_at: string | null
    }
    total_albums: number
    solo_album_count: number
    combined_album_count: number
    total_releases: number
    submission_count: number
    total_score: number
    total_comments: number
    points_gain: number
    last_seen_at: string | null
  }
  tracked_albums: TrackedAlbumRow[]
  child_releases: ChildReleaseLedgerRow[]
}

async function fetchArtistDetail(
  artistId: string,
  window: WindowType
): Promise<ArtistDetailResponse> {
  const res = await fetch(`/api/v1/artists/${artistId}?window=${window}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch artist detail: ${res.statusText}`)
  }
  return res.json()
}

export const ArtistDetail: React.FC = () => {
  const { artistId = '' } = useParams<{ artistId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawWindow = searchParams.get('window')
  const window: WindowType =
    rawWindow === '7D' || rawWindow === '1M' ? rawWindow : '24H'

  const handleWindowChange = (newWindow: WindowType) => {
    setSearchParams({ window: newWindow })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['artist', artistId, window],
    queryFn: () => fetchArtistDetail(artistId, window),
    enabled: Boolean(artistId),
  })

  const renderTierBadge = (index: number, tier: TierType) => {
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
        {index}
        <span className="text-[10px] font-normal uppercase">{tier}</span>
      </span>
    )
  }

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" data-testid="screen-artist-detail-loading">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[4px] bg-[#E5E0DA] border-[1.5px] border-[#121212] animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="w-64 h-8 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-40 h-4 bg-[#E5E0DA] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-white border-[1.5px] border-[#121212] rounded-[6px] p-4 animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 bg-white border-[1.5px] border-[#121212] rounded-[6px] animate-pulse" />
      </div>
    )
  }

  // Error State with Coral Alert Banner
  if (isError || !data) {
    return (
      <div
        className="bg-[#F56565] border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 text-[#121212] flex flex-col gap-4"
        data-testid="artist-detail-error"
      >
        <div className="flex items-center gap-2 font-grotesk font-bold text-lg">
          <AlertTriangle className="w-5 h-5 text-[#121212]" />
          Failed to load artist discography
        </div>
        <p className="font-sans text-sm">
          {error instanceof Error
            ? error.message
            : 'The artist could not be found or the server returned an error.'}
        </p>
        <div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#121212] text-white font-mono text-xs font-bold rounded-[4px] shadow-brutal-sm hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { artist, hero_kpi, tracked_albums, child_releases } = data

  // Format last seen date string
  const lastSeenDate = artist.last_seen_at
    ? `${formatRelativeTime(artist.last_seen_at)} (${new Date(artist.last_seen_at).toISOString().split('T')[0]})`
    : 'NEVER'

  return (
    <div className="flex flex-col gap-6" data-testid="screen-artist-detail">
      {/* Back Link */}
      <div>
        <Link
          to="/directory?tab=artists"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </Link>
      </div>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <VinylMonogram
            name={artist.name}
            entityId={artist.monogram_key || artist.artist_id}
            size={64}
          />
          <div>
            <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
              {artist.name}
            </h1>
            <div className="text-base text-[#646464] font-medium mt-0.5">
              Artist Discography · ID: {artist.artist_id.slice(0, 8)}...
            </div>

            {/* Top-level Last Seen Provenance Chip */}
            <div className="inline-flex items-center gap-1.5 mt-2 bg-white border-[1.5px] border-[#121212] px-2.5 py-0.5 rounded-full font-mono text-[11px] text-[#121212] shadow-brutal-sm">
              <span className="text-[#646464]">LAST SEEN:</span>
              <span className="font-bold">{lastSeenDate}</span>
            </div>
          </div>
        </div>

        {/* Page-level Window Pill Switcher */}
        <div className="flex items-center self-start md:self-auto bg-[#F7F3F0] p-0.5 rounded-full border-[1.5px] border-[#121212]">
          {(['24H', '7D', '1M'] as WindowType[]).map((w) => (
            <button
              key={w}
              data-window={w}
              onClick={() => handleWindowChange(w)}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                window === w
                  ? 'bg-[#121212] text-white font-bold shadow-brutal-sm'
                  : 'text-[#646464] hover:text-[#121212]'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Cell Hero KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cell 1: Hype Index */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-hype-index"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#121212]" />
              Hype Index
            </span>
            {renderTierBadge(hero_kpi.hype_index, hero_kpi.tier)}
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.hype_index}{' '}
              <span className="text-sm font-normal text-[#646464]">/ 100</span>
            </div>
            {/* Progress track */}
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

        {/* Cell 2: Hype Velocity */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-hype-velocity"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#121212]" />
              Hype Velocity
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              +{hero_kpi.hype_velocity}{' '}
              <span className="text-sm font-normal text-[#646464]">pts/hr</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              Engagement speed in {window}
            </div>
          </div>
        </div>

        {/* Cell 3: Catalog Footprint */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-catalog-footprint"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#121212]" />
              Catalog Footprint
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.catalog_footprint.total_albums}{' '}
              <span className="text-sm font-normal text-[#646464]">
                {hero_kpi.catalog_footprint.total_albums === 1 ? 'Album' : 'Albums'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              {hero_kpi.catalog_footprint.solo_album_count} Solo ·{' '}
              {hero_kpi.catalog_footprint.combined_album_count} Combined ·{' '}
              {hero_kpi.catalog_footprint.total_releases} Pressings
            </div>
          </div>
        </div>

        {/* Cell 4: Reddit Demand */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-reddit-demand"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#121212]" />
              Reddit Demand
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              +{hero_kpi.reddit_demand.points_gain}{' '}
              <span className="text-sm font-normal text-[#646464]">pts</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2 truncate">
              {hero_kpi.reddit_demand.total_submissions} Posts ·{' '}
              {hero_kpi.reddit_demand.total_score} upvotes ·{' '}
              {hero_kpi.reddit_demand.total_comments} comments
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns) — Tracked Albums & Billing Attribution Matrix */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-tracked-albums"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            Tracked Albums Matrix
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {tracked_albums.length} Indexed Titles
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Derived albums catalog attributed to {artist.name}, distinguishing solo projects from collaborative and split appearances.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Album</th>
                <th className="py-2.5 px-3">Billing Attribution</th>
                <th className="py-2.5 px-3">Child Releases</th>
                <th className="py-2.5 px-3">Submissions</th>
                <th className="py-2.5 px-3">Hype Velocity</th>
                <th className="py-2.5 px-3">Hype Index</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tracked_albums.map((alb) => {
                const isSolo = alb.billing_attribution === 'Solo'

                return (
                  <tr
                    key={alb.album_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* Column 1: Album (Monogram + Title) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <VinylMonogram
                          name={alb.album_title}
                          entityId={alb.album_id}
                          size={36}
                        />
                        <div className="flex flex-col">
                          <span className="font-grotesk font-bold text-sm text-[#121212]">
                            {alb.album_title}
                          </span>
                          <span className="font-mono text-[11px] text-[#646464]">
                            {alb.combined_artist}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Billing Attribution */}
                    <td className="py-3 px-3">
                      {isSolo ? (
                        <span className="inline-block bg-[#68D391] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-bold text-[#121212]">
                          Solo
                        </span>
                      ) : (
                        <span className="inline-block bg-[#FAF7F5] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-medium text-[#121212]">
                          {alb.billing_attribution}
                        </span>
                      )}
                    </td>

                    {/* Column 3: Child Releases count */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      {alb.release_count} {alb.release_count === 1 ? 'Pressing' : 'Pressings'}
                    </td>

                    {/* Column 4: Submissions */}
                    <td className="py-3 px-3 font-mono text-xs text-[#646464]">
                      {alb.submission_count} posts · {alb.score} pts · {alb.num_comments} comments
                    </td>

                    {/* Column 5: Hype Velocity */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      +{alb.hype_velocity} pts/hr
                    </td>

                    {/* Column 6: Hype Index */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {renderTierBadge(alb.hype_index, alb.tier)}
                        <div className="w-12 bg-[#E5E0DA] h-1.5 rounded-[1px] overflow-hidden border border-[#121212]">
                          <div
                            className={`h-full ${
                              alb.tier === 'high'
                                ? 'bg-[#68D391]'
                                : alb.tier === 'moderate'
                                ? 'bg-[#ECC94B]'
                                : 'bg-[#646464]'
                            }`}
                            style={{ width: `${alb.hype_index}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Column 7: Action */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/albums/${alb.album_id}`}
                        className="inline-block font-mono text-xs font-bold text-[#121212] bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-1 rounded-[4px] hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
                      >
                        View Album →
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {tracked_albums.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No tracked albums found for this artist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row (12 columns) — Child Releases Discography Ledger */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-child-releases"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#121212]" />
            Child Releases Discography Ledger
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {child_releases.length} Recorded Pressings
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          All physical editions and retailer colorways across {artist.name}&apos;s catalog with direct links to release intelligence.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Parent Album</th>
                <th className="py-2.5 px-3">Variant</th>
                <th className="py-2.5 px-3">Retailer</th>
                <th className="py-2.5 px-3">Submissions</th>
                <th className="py-2.5 px-3">Hype Velocity</th>
                <th className="py-2.5 px-3">Hype Index</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {child_releases.map((rel) => {
                const variantName = rel.variant || 'Standard Pressing'
                const retailerName = rel.retailer_name || 'Wide / Unspecified'

                return (
                  <tr
                    key={rel.release_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* Column 1: Parent Album */}
                    <td className="py-3 px-3">
                      <Link
                        to={`/albums/${rel.album_id}`}
                        className="font-mono text-xs font-bold text-[#121212] hover:text-[#9B6DFF] transition-colors"
                      >
                        {rel.album_title}
                      </Link>
                    </td>

                    {/* Column 2: Variant */}
                    <td className="py-3 px-3">
                      <span className="inline-block bg-[#F7F3F0] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs text-[#121212]">
                        {variantName}
                      </span>
                    </td>

                    {/* Column 3: Retailer */}
                    <td className="py-3 px-3 font-sans text-xs text-[#121212]">
                      {retailerName}
                    </td>

                    {/* Column 4: Submissions */}
                    <td className="py-3 px-3 font-mono text-xs text-[#646464]">
                      {rel.submission_count} posts · {rel.score} pts · {rel.num_comments} comments
                    </td>

                    {/* Column 5: Hype Velocity */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      +{rel.hype_velocity} pts/hr
                    </td>

                    {/* Column 6: Hype Index */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {renderTierBadge(rel.hype_index, rel.tier)}
                        <div className="w-12 bg-[#E5E0DA] h-1.5 rounded-[1px] overflow-hidden border border-[#121212]">
                          <div
                            className={`h-full ${
                              rel.tier === 'high'
                                ? 'bg-[#68D391]'
                                : rel.tier === 'moderate'
                                ? 'bg-[#ECC94B]'
                                : 'bg-[#646464]'
                            }`}
                            style={{ width: `${rel.hype_index}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Column 7: Action */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/releases/${rel.release_id}`}
                        className="inline-block font-mono text-xs font-bold text-[#121212] bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-1 rounded-[4px] hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
                      >
                        View Release →
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {child_releases.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No child releases recorded for this artist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ArtistDetail
