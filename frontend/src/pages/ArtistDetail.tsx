import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Disc,
  Layers,
} from 'lucide-react'
import { EntityDetailSkeleton } from '../components/EntityDetailSkeleton'
import { EntityEditorialHeader, type HypeWindow } from '../components/EntityEditorialHeader'
import { EngagementKpiCard, HypeIndexKpiCard } from '../components/EntityHeroKpiCards'
import { HypeIndexMeter } from '../components/HypeIndexMeter'
import { VinylMonogram } from '../components/VinylMonogram'
import { formatLastSeenDisplay } from '../utils/formatTime'
import { formatVariantLabel } from '../utils/formatters'

type WindowType = HypeWindow
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

  const rawWindow = searchParams.get('window')?.toUpperCase()
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

  // Loading Skeleton State matching exact container geometries
  if (isLoading) {
    return (
      <EntityDetailSkeleton screenTestId="screen-artist-detail-loading" monogramShape="circle">
        {/* Albums Table Skeleton */}
        <div className="h-72 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
          <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, k) => (
              <div key={k} className="w-full h-10 bg-[#E5E0DA] rounded animate-pulse" />
            ))}
          </div>
        </div>
        {/* All Pressings Table Skeleton */}
        <div className="h-72 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
          <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, m) => (
              <div key={m} className="w-full h-10 bg-[#E5E0DA] rounded animate-pulse" />
            ))}
          </div>
        </div>
      </EntityDetailSkeleton>
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
            data-testid="artist-retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { artist, hero_kpi, tracked_albums, child_releases } = data
  const totalAlbums = hero_kpi.catalog_footprint?.total_albums ?? hero_kpi.total_albums
  const soloAlbumCount = hero_kpi.catalog_footprint?.solo_album_count ?? hero_kpi.solo_album_count
  const combinedAlbumCount =
    hero_kpi.catalog_footprint?.combined_album_count ?? hero_kpi.combined_album_count
  const totalReleases = hero_kpi.catalog_footprint?.total_releases ?? hero_kpi.total_releases
  const totalScore = hero_kpi.reddit_demand?.total_score ?? hero_kpi.total_score
  const totalComments = hero_kpi.reddit_demand?.total_comments ?? hero_kpi.total_comments
  const submissionCount = hero_kpi.reddit_demand?.submission_count ?? hero_kpi.submission_count

  const lastSeenDate = formatLastSeenDisplay(artist.last_seen_at)

  return (
    <div className="flex flex-col gap-6" data-testid="screen-artist-detail">
      <EntityEditorialHeader
        entityLabel="ARTIST"
        activeWindow={window}
        onWindowChange={handleWindowChange}
        backLinks={
          <Link
            to={`/directory?tab=artists&window=${window}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Directory
          </Link>
        }
        monogram={{
          name: artist.name,
          entityId: artist.monogram_key || artist.artist_id,
          shape: 'circle',
        }}
      >
        <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
          {artist.name}
        </h1>
        <div className="text-base text-[#646464] font-medium mt-0.5">
          {totalAlbums} {totalAlbums === 1 ? 'Album' : 'Albums'} · {totalReleases}{' '}
          {totalReleases === 1 ? 'Pressing' : 'Pressings'}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <div className="inline-flex items-center gap-1.5 bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-0.5 rounded-full font-mono text-[11px] text-[#121212]">
            <span className="text-[#646464]">LAST SEEN:</span>
            <span className="font-bold">{lastSeenDate}</span>
          </div>
        </div>
      </EntityEditorialHeader>

      {/* 3-Card Hero KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="hero-kpi-strip">
        <HypeIndexKpiCard hypeIndex={hero_kpi.hype_index} tier={hero_kpi.tier} />
        <EngagementKpiCard
          totalScore={totalScore}
          totalComments={totalComments}
          mentionCount={submissionCount}
        />

        {/* Card 3: Discography */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-discography"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#121212]" />
              Discography
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {totalAlbums}{' '}
              <span className="text-sm font-normal text-[#646464]">
                {totalAlbums === 1 ? 'Album' : 'Albums'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              {soloAlbumCount} Solo · {combinedAlbumCount} Collaboration ·{' '}
              {totalReleases} {totalReleases === 1 ? 'Pressing' : 'Pressings'}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns) — 6-Column Albums Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-albums"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            Albums
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {tracked_albums.length} {tracked_albums.length === 1 ? 'Album' : 'Albums'}
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Albums by {artist.name}, distinguishing solo projects from collaborations.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Album</th>
                <th className="py-2.5 px-3">Credit</th>
                <th className="py-2.5 px-3">Pressings</th>
                <th className="py-2.5 px-3">Engagement</th>
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
                    {/* Column 1: Album (Square Sleeve Monogram + Title + Combined Artist) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <VinylMonogram
                          name={alb.album_title}
                          entityId={alb.album_id}
                          size={36}
                          shape="square"
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

                    {/* Column 2: Credit */}
                    <td className="py-3 px-3">
                      {isSolo ? (
                        <span className="inline-block bg-[#68D391] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-bold text-[#121212]">
                          Solo
                        </span>
                      ) : (
                        <span className="inline-block bg-[#FAF7F5] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-medium text-[#121212]">
                          Collaboration
                        </span>
                      )}
                    </td>

                    {/* Column 3: Pressings */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      {alb.release_count} {alb.release_count === 1 ? 'Pressing' : 'Pressings'}
                    </td>

                    {/* Column 4: Engagement */}
                    <td className="py-3 px-3 font-mono text-xs text-[#646464]">
                      {alb.submission_count} {alb.submission_count === 1 ? 'mention' : 'mentions'} · {alb.score} votes · {alb.num_comments} comments
                    </td>

                    {/* Column 5: Hype Index */}
                    <td className="py-3 px-3">
                      <HypeIndexMeter
                        hypeIndex={alb.hype_index}
                        tier={alb.tier}
                        layout="inline"
                        barWidthClassName="w-12"
                      />
                    </td>

                    {/* Column 6: Action */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/albums/${alb.album_id}?window=${window}`}
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
                    colSpan={6}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No albums recorded for this artist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row (12 columns) — 6-Column All Pressings Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-all-pressings"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#121212]" />
            All Pressings
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {child_releases.length} {child_releases.length === 1 ? 'Pressing' : 'Pressings'}
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          All physical pressings across {artist.name}&apos;s discography with direct links to release details.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Album</th>
                <th className="py-2.5 px-3">Variant</th>
                <th className="py-2.5 px-3">Retailer</th>
                <th className="py-2.5 px-3">Engagement</th>
                <th className="py-2.5 px-3">Hype Index</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {child_releases.map((rel) => {
                const variantName = formatVariantLabel(rel.variant)
                const retailerName = rel.retailer_name || 'Wide / Unspecified'

                return (
                  <tr
                    key={rel.release_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* Column 1: Album */}
                    <td className="py-3 px-3">
                      <Link
                        to={`/albums/${rel.album_id}?window=${window}`}
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

                    {/* Column 4: Engagement */}
                    <td className="py-3 px-3 font-mono text-xs text-[#646464]">
                      {rel.submission_count} {rel.submission_count === 1 ? 'mention' : 'mentions'} · {rel.score} votes · {rel.num_comments} comments
                    </td>

                    {/* Column 5: Hype Index */}
                    <td className="py-3 px-3">
                      <HypeIndexMeter
                        hypeIndex={rel.hype_index}
                        tier={rel.tier}
                        layout="inline"
                        barWidthClassName="w-12"
                      />
                    </td>

                    {/* Column 6: Action */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/releases/${rel.release_id}?window=${window}`}
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
                    colSpan={6}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No pressings recorded for this artist.
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
