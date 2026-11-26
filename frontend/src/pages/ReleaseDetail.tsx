import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Disc,
  Layers,
  Store,
  User,
} from 'lucide-react'
import {
  ActivityOverTimeChart,
  type MentionMarker,
  type TimeSeriesBucket,
} from '../components/ActivityOverTimeChart'
import { EntityDetailSkeleton } from '../components/EntityDetailSkeleton'
import { EntityEditorialHeader, type HypeWindow } from '../components/EntityEditorialHeader'
import { EngagementKpiCard, HypeIndexKpiCard } from '../components/EntityHeroKpiCards'
import { formatLastSeenDisplay, formatRelativeTime } from '../utils/formatTime'
import { DEFAULT_VARIANT_LABEL, formatVariantLabel } from '../utils/formatters'

type WindowType = HypeWindow
type TierType = 'high' | 'moderate' | 'low'

interface RedditSubmissionProvenance {
  submission_id: string
  title: string
  created_utc: string
  latest_score: number
  latest_upvote_ratio: number
  latest_num_comments: number
  window_velocity: number
  url: string
  external_url?: string | null
}

interface ReleaseDetailResponse {
  release_id: string
  album_id: string
  album_title: string
  combined_artist: string
  variant?: string | null
  retailer_name?: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  monogram_key: string
  window: WindowType
  specs: {
    release_id: string
    album_id: string
    album_title: string
    combined_artist: string
    artist_id?: string | null
    variant?: string | null
    retailer_name?: string | null
    first_seen_at: string | null
    last_seen_at: string | null
    monogram_key: string
  }
  parent_album: {
    album_id: string
    album_title: string
    release_count: number
  }
  hero_kpi: {
    hype_index: number
    tier: TierType
    hype_velocity: number
    submission_engagement: {
      points_gain: number
      total_score: number
      total_comments: number
      submission_count: number
      latest_upvote_ratio?: number | null
      upvote_ratio?: number | null
    }
    provenance_summary: {
      first_seen_at: string | null
      last_seen_at: string | null
      linked_submissions_count: number
    }
    points_gain: number
    total_score: number
    total_comments: number
    submission_count: number
    first_seen_at: string | null
    last_seen_at: string | null
  }
  time_series: Array<TimeSeriesBucket & { velocity_pts_per_hr: number }>
  submission_markers: MentionMarker[]
  submissions: RedditSubmissionProvenance[]
}

async function fetchReleaseDetail(
  releaseId: string,
  window: WindowType
): Promise<ReleaseDetailResponse> {
  const res = await fetch(`/api/v1/releases/${releaseId}?window=${window}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch release detail: ${res.statusText}`)
  }
  return res.json()
}

export const ReleaseDetail: React.FC = () => {
  const { releaseId = '' } = useParams<{ releaseId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawWindow = searchParams.get('window')?.toUpperCase()
  const window: WindowType =
    rawWindow === '7D' || rawWindow === '1M' ? rawWindow : '24H'

  const handleWindowChange = (newWindow: WindowType) => {
    setSearchParams({ window: newWindow })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['release', releaseId, window],
    queryFn: () => fetchReleaseDetail(releaseId, window),
    enabled: Boolean(releaseId),
  })

  // Loading Skeleton State matching exact container geometries
  if (isLoading) {
    return (
      <EntityDetailSkeleton screenTestId="screen-release-detail-loading" monogramShape="square">
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 h-80 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
            <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex justify-between py-1.5 border-b border-[#E5E0DA]">
                  <div className="w-20 h-4 bg-[#E5E0DA] rounded animate-pulse" />
                  <div className="w-32 h-4 bg-[#E5E0DA] rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="w-full h-3 bg-[#E5E0DA] rounded animate-pulse" />
          </div>
          <div className="col-span-12 lg:col-span-7 h-80 bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 flex flex-col justify-between">
            <div className="w-48 h-6 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-full h-48 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-64 h-4 bg-[#E5E0DA] rounded animate-pulse" />
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
      </EntityDetailSkeleton>
    )
  }

  // Error State with Coral Alert Banner
  if (isError || !data) {
    return (
      <div
        className="bg-[#F56565] border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 text-[#121212] flex flex-col gap-4"
        data-testid="release-detail-error"
      >
        <div className="flex items-center gap-2 font-grotesk font-bold text-lg">
          <AlertTriangle className="w-5 h-5 text-[#121212]" />
          Failed to load release specification
        </div>
        <p className="font-sans text-sm">
          {error instanceof Error
            ? error.message
            : 'The release could not be found or the server returned an error.'}
        </p>
        <div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#121212] text-white font-mono text-xs font-bold rounded-[4px] shadow-brutal-sm hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors"
            data-testid="release-retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { specs, parent_album, hero_kpi, time_series, submission_markers, submissions } = data
  const hasActivity =
    (hero_kpi.points_gain ?? 0) > 0 ||
    (hero_kpi.submission_engagement?.points_gain ?? 0) > 0 ||
    time_series.some((b) => b.velocity_pts_per_hr > 0)

  const lastSeenDate = formatLastSeenDisplay(specs.last_seen_at)

  const firstSeenFormatted = specs.first_seen_at
    ? `${new Date(specs.first_seen_at).toISOString().split('T')[0]}`
    : 'UNKNOWN'

  const variantDisplay = formatVariantLabel(specs.variant)
  const mastheadTitle =
    variantDisplay === DEFAULT_VARIANT_LABEL
      ? `${specs.album_title} — ${DEFAULT_VARIANT_LABEL}`
      : variantDisplay
  const retailerDisplay = specs.retailer_name?.trim() || 'Wide / Unspecified'

  return (
    <div className="flex flex-col gap-6" data-testid="screen-release-detail">
      <EntityEditorialHeader
        entityLabel="RELEASE"
        activeWindow={window}
        onWindowChange={handleWindowChange}
        backLinks={
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/albums/${specs.album_id}?window=${window}`}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Album: {specs.album_title} ({parent_album.release_count}{' '}
              {parent_album.release_count === 1 ? 'Release' : 'Releases'})
            </Link>
            <span className="text-[#646464]">·</span>
            <Link
              to={`/directory?tab=releases&window=${window}`}
              className="font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
            >
              All Releases
            </Link>
          </div>
        }
        monogram={{
          name: specs.album_title,
          entityId: specs.monogram_key || specs.release_id,
          shape: 'square',
        }}
      >
        <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
          {mastheadTitle}
        </h1>

        {/* Equal-prominence Parent Album & Artist Hierarchy */}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mt-1">
          <Link
            to={`/albums/${specs.album_id}?window=${window}`}
            className="font-grotesk font-bold text-xl sm:text-2xl text-[#121212] tracking-tight hover:underline"
          >
            {specs.album_title}
          </Link>
          <span className="font-grotesk font-bold text-xl text-[#646464]" aria-hidden="true">
            ·
          </span>
          {specs.artist_id ? (
            <Link
              to={`/artists/${specs.artist_id}?window=${window}`}
              className="font-grotesk font-bold text-xl sm:text-2xl text-[#121212] tracking-tight hover:underline"
            >
              {specs.combined_artist}
            </Link>
          ) : (
            <span className="font-grotesk font-bold text-xl sm:text-2xl text-[#121212] tracking-tight">
              {specs.combined_artist}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <div className="inline-flex items-center gap-1.5 bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold text-[#121212]">
            <Store className="w-3 h-3 text-[#646464]" />
            <span>{retailerDisplay}</span>
          </div>
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
          totalScore={hero_kpi.submission_engagement?.total_score ?? hero_kpi.total_score}
          totalComments={hero_kpi.submission_engagement?.total_comments ?? hero_kpi.total_comments}
          mentionCount={
            hero_kpi.submission_engagement?.submission_count ?? hero_kpi.submission_count
          }
        />

        {/* Card 3: Retailer & First Seen */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-retailer-first-seen"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#121212]" />
              Retailer &amp; First Seen
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212] truncate" title={retailerDisplay}>
              {retailerDisplay}
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              First tracked {firstSeenFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns): 5-col Physical Specs Card + 7-col Activity Over Time Chart */}
      <div className="grid grid-cols-12 gap-5">
        {/* 5-col Physical Release Specification Card */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12 lg:col-span-5 flex flex-col justify-between"
          data-testid="card-physical-specs"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
                <Disc className="w-4 h-4 text-[#121212]" />
                Physical Specifications
              </div>
            </div>
            <p className="font-sans text-xs text-[#646464] mb-5">
              Physical attributes, retailer attribution, and release timeline.
            </p>

            {/* Specifications Grid */}
            <div className="flex flex-col gap-3 font-sans text-xs">
              {/* Row 1: Artist */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#646464]" />
                  Artist
                </span>
                {specs.artist_id ? (
                  <Link
                    to={`/artists/${specs.artist_id}?window=${window}`}
                    className="font-semibold text-[#121212] text-right hover:text-[#9B6DFF] transition-colors inline-flex items-center gap-1"
                  >
                    {specs.combined_artist} →
                  </Link>
                ) : (
                  <span className="font-semibold text-[#121212] text-right">
                    {specs.combined_artist}
                  </span>
                )}
              </div>

              {/* Row 2: Parent Album */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#646464]" />
                  Parent Album
                </span>
                <Link
                  to={`/albums/${specs.album_id}?window=${window}`}
                  className="font-mono font-bold text-[#121212] text-right hover:text-[#9B6DFF] transition-colors inline-flex items-center gap-1"
                >
                  View Album ({parent_album.release_count}{' '}
                  {parent_album.release_count === 1 ? 'Release' : 'Releases'}) →
                </Link>
              </div>

              {/* Row 3: Pressing Variant */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-[#646464]" />
                  Variant
                </span>
                <span className="bg-[#F7F3F0] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-semibold text-[#121212]">
                  {variantDisplay}
                </span>
              </div>

              {/* Row 4: Retailer */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#646464]" />
                  Retailer
                </span>
                <span className="font-medium text-[#121212]">
                  {retailerDisplay}
                </span>
              </div>

              {/* Row 5: First Seen */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#646464]" />
                  First Seen
                </span>
                <span className="font-mono text-[#121212]">
                  {firstSeenFormatted}
                </span>
              </div>

              {/* Row 6: Last Seen */}
              <div className="flex items-start justify-between py-2">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#646464]" />
                  Last Seen
                </span>
                <span className="font-mono text-[#121212]">
                  {lastSeenDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 7-col Shared Activity Over Time Chart */}
        <ActivityOverTimeChart
          window={window}
          timeSeries={time_series}
          mentionMarkers={submission_markers}
          hasActivity={hasActivity}
          lastSeenDisplay={lastSeenDate}
          subtitle="Community engagement for this pressing."
          className="col-span-12 lg:col-span-7"
        />
      </div>

      {/* Bottom Row (12 columns) — 5-Column Source Mentions Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-source-mentions"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            Source Mentions
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {submissions.length} {submissions.length === 1 ? 'Linked Mention' : 'Linked Mentions'}
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Community discussions and source references linked to this pressing.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Mention Title</th>
                <th className="py-2.5 px-3">Posted</th>
                <th className="py-2.5 px-3">Votes</th>
                <th className="py-2.5 px-3">Comments</th>
                <th className="py-2.5 px-3 text-right">Source Link</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const postedDate = new Date(sub.created_utc).toISOString().split('T')[0]
                const postedRelative = formatRelativeTime(sub.created_utc)

                return (
                  <tr
                    key={sub.submission_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* Column 1: Mention Title */}
                    <td className="py-3 px-3">
                      <div className="max-w-md">
                        <span className="font-sans text-xs font-medium text-[#121212] line-clamp-2">
                          {sub.title}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: Posted */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      <div>{postedRelative}</div>
                      <div className="text-[10px] text-[#646464]">{postedDate}</div>
                    </td>

                    {/* Column 3: Votes */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      <span className="font-bold">{sub.latest_score} votes</span>
                    </td>

                    {/* Column 4: Comments */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      {sub.latest_num_comments} comments
                    </td>

                    {/* Column 5: Source Link */}
                    <td className="py-3 px-3 text-right">
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#121212] bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-1 rounded-[4px] hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
                      >
                        View Source ↗
                      </a>
                    </td>
                  </tr>
                )
              })}

              {submissions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No mentions recorded for this pressing.
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

export default ReleaseDetail
