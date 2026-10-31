import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Disc,
  Flame,
  Layers,
  Store,
  TrendingUp,
  User,
} from 'lucide-react'
import { VinylMonogram } from '../components/VinylMonogram'
import { formatRelativeTime } from '../utils/formatTime'

type WindowType = '24H' | '7D' | '1M'
type TierType = 'high' | 'moderate' | 'low'

interface TimeSeriesBucket {
  bucket_start: string
  bucket_end: string
  cumulative_points: number
  velocity_pts_per_hr: number
  timestamp: string
  points: number
  velocity: number
}

interface SubmissionMarker {
  timestamp: string
  submission_id: string
  title: string
}

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
  variant: string
  retailer_name: string
  first_seen_at: string | null
  last_seen_at: string | null
  monogram_key: string
  window: WindowType
  specs: {
    release_id: string
    album_id: string
    album_title: string
    combined_artist: string
    variant: string
    retailer_name: string
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
  time_series: TimeSeriesBucket[]
  submission_markers: SubmissionMarker[]
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

  // Loading Skeleton State matching exact container geometries
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" data-testid="screen-release-detail-loading">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[4px] bg-[#E5E0DA] border-[1.5px] border-[#121212] animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="w-48 h-4 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-72 h-8 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-56 h-4 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-48 h-6 bg-[#E5E0DA] rounded-full animate-pulse mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
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
      </div>
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

  // Chart dimensions & calculations
  const chartWidth = 650
  const chartHeight = 180
  const padLeft = 45
  const padTop = 25
  const maxPts = Math.max(...time_series.map((b) => b.cumulative_points), 10)
  const maxVel = Math.max(...time_series.map((b) => b.velocity_pts_per_hr), 1.0)
  const numBuckets = time_series.length

  // Build SVG stepped line path
  let stepPathD = ''
  let areaPathD = ''
  if (!hasActivity) {
    // When zero window engagement exists in active window W: render a flat baseline at 0
    stepPathD = `M ${padLeft} ${padTop + chartHeight} L ${padLeft + chartWidth} ${padTop + chartHeight}`
    areaPathD = ''
  } else if (numBuckets > 0) {
    const bucketWidth = chartWidth / numBuckets
    const firstY =
      padTop + chartHeight - (time_series[0].cumulative_points / maxPts) * chartHeight
    stepPathD = `M ${padLeft} ${firstY}`
    areaPathD = `M ${padLeft} ${padTop + chartHeight} L ${padLeft} ${firstY}`

    time_series.forEach((b, i) => {
      const x1 = padLeft + i * bucketWidth
      const x2 = padLeft + (i + 1) * bucketWidth
      const y = padTop + chartHeight - (b.cumulative_points / maxPts) * chartHeight

      stepPathD += ` L ${x1} ${y} L ${x2} ${y}`
      areaPathD += ` L ${x1} ${y} L ${x2} ${y}`
    })

    const lastX = padLeft + numBuckets * bucketWidth
    areaPathD += ` L ${lastX} ${padTop + chartHeight} Z`
  }

  // Format last seen date string
  const lastSeenDate = specs.last_seen_at
    ? `${formatRelativeTime(specs.last_seen_at)} (${new Date(specs.last_seen_at).toISOString().split('T')[0]})`
    : 'NEVER'

  const firstSeenFormatted = specs.first_seen_at
    ? `${new Date(specs.first_seen_at).toISOString().split('T')[0]}`
    : 'UNKNOWN'

  return (
    <div className="flex flex-col gap-6" data-testid="screen-release-detail">
      {/* Back Link preserving window parameter */}
      <div className="flex items-center gap-4">
        <Link
          to={`/albums/${specs.album_id}?window=${window}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Album: {specs.album_title} ({parent_album.release_count} {parent_album.release_count === 1 ? 'Release' : 'Releases'})
        </Link>
        <span className="text-[#646464]">·</span>
        <Link
          to={`/directory?tab=releases&window=${window}`}
          className="font-mono text-xs text-[#646464] hover:text-[#121212] transition-colors"
        >
          All Releases
        </Link>
      </div>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <VinylMonogram
            name={specs.album_title}
            entityId={specs.monogram_key || specs.release_id}
            size={64}
          />
          <div>
            {/* Breadcrumb Hierarchy with window parameter */}
            <div className="flex items-center gap-1.5 font-mono text-xs text-[#646464] mb-1">
              <span>{specs.combined_artist}</span>
              <span>&gt;</span>
              <Link
                to={`/albums/${specs.album_id}?window=${window}`}
                className="text-[#121212] font-semibold hover:underline"
              >
                {specs.album_title}
              </Link>
              <span>&gt;</span>
              <span className="text-[#9B6DFF] font-bold">{specs.variant}</span>
            </div>

            <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
              {specs.album_title} — {specs.variant}
            </h1>
            <div className="text-base text-[#646464] font-medium mt-0.5">
              {specs.combined_artist} · {specs.retailer_name}
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

        {/* Cell 3: Submission Engagement */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-submission-engagement"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#121212]" />
              Submission Engagement
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              +{hero_kpi.submission_engagement.points_gain}{' '}
              <span className="text-sm font-normal text-[#646464]">pts</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2 truncate">
              {hero_kpi.submission_engagement.total_score} upvotes ·{' '}
              {hero_kpi.submission_engagement.total_comments} comments
            </div>
          </div>
        </div>

        {/* Cell 4: Provenance Summary */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-provenance-summary"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-[#121212]" />
              Provenance Summary
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-[#121212]">
              {hero_kpi.provenance_summary.linked_submissions_count}{' '}
              <span className="text-sm font-normal text-[#646464]">
                {hero_kpi.provenance_summary.linked_submissions_count === 1
                  ? 'Linked Post'
                  : 'Linked Posts'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              Last seen {formatRelativeTime(specs.last_seen_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns): 5-col Physical Specs Card + 7-col Stepped Snapshot Chart */}
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
              <span className="font-mono text-[11px] text-[#646464]">
                UUID: {specs.release_id.slice(0, 8)}...
              </span>
            </div>
            <p className="font-sans text-xs text-[#646464] mb-5">
              Physical attributes, retailer attribution, and catalog provenance.
            </p>

            {/* Specifications Grid */}
            <div className="flex flex-col gap-3 font-sans text-xs">
              {/* Row 1: Artist */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#646464]" />
                  Artist
                </span>
                <span className="font-semibold text-[#121212] text-right">
                  {specs.combined_artist}
                </span>
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
                  View Album ({parent_album.release_count} {parent_album.release_count === 1 ? 'Release' : 'Releases'}) →
                </Link>
              </div>

              {/* Row 3: Pressing Variant */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-[#646464]" />
                  Variant
                </span>
                <span className="bg-[#F7F3F0] border border-[#121212] px-2 py-0.5 rounded-[4px] font-mono text-xs font-semibold text-[#121212]">
                  {specs.variant}
                </span>
              </div>

              {/* Row 4: Retailer */}
              <div className="flex items-start justify-between py-2 border-b border-[#E5E0DA]">
                <span className="font-mono text-[#646464] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#646464]" />
                  Retailer
                </span>
                <span className="font-medium text-[#121212]">
                  {specs.retailer_name}
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

          <div className="mt-4 pt-3 border-t border-[#E5E0DA] font-mono text-[10px] text-[#646464]">
            Catalog identity derived from normalized metadata.
          </div>
        </div>

        {/* 7-col Stepped Snapshot Engagement Chart */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12 lg:col-span-7 flex flex-col justify-between"
          data-testid="chart-stepped-locf"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-grotesk font-bold text-lg text-[#121212]">
                Stepped Engagement Curve
              </div>
              <div className="font-mono text-[11px] text-[#646464]">
                {time_series.length} Buckets · LOCF Sampling
              </div>
            </div>
            <p className="font-sans text-xs text-[#646464] mb-4">
              Cumulative engagement points (E = score + 2 × comments) with stepped velocity intervals.
            </p>

            {/* Zero-activity Mono Callout Banner */}
            {!hasActivity && (
              <div
                className="mb-4 bg-[#FAF7F5] border-[1.5px] border-dashed border-[#121212] p-3 text-center rounded-[4px] font-mono text-xs text-[#646464]"
                data-testid="zero-activity-callout"
              >
                NO NEW ACTIVITY IN {window} — LAST SEEN {lastSeenDate}
              </div>
            )}

            {/* Stepped SVG Chart */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth + padLeft + 20} ${chartHeight + padTop + 35}`}
                className="w-full h-auto min-w-[450px]"
              >
                {/* Background Grid Lines */}
                {[0, 0.5, 1].map((pct) => {
                  const y = padTop + chartHeight - pct * chartHeight
                  const ptsVal = hasActivity ? Math.round(pct * maxPts) : 0
                  return (
                    <g key={pct}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={padLeft + chartWidth}
                        y2={y}
                        stroke="#E5E0DA"
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="font-mono text-[9px] fill-[#646464]"
                      >
                        {ptsVal}
                      </text>
                    </g>
                  )
                })}

                {/* Shaded Area under Stepped Line */}
                {hasActivity && areaPathD && (
                  <path d={areaPathD} fill="#9B6DFF" fillOpacity="0.08" />
                )}

                {/* Stepped Velocity Bars */}
                {hasActivity &&
                  time_series.map((b, i) => {
                    const bWidth = chartWidth / numBuckets
                    const x = padLeft + i * bWidth
                    const barHeight =
                      (b.velocity_pts_per_hr / maxVel) * (chartHeight * 0.4)
                    const y = padTop + chartHeight - barHeight
                    return (
                      <rect
                        key={`vel-${i}`}
                        x={x + 1}
                        y={y}
                        width={Math.max(1, bWidth - 2)}
                        height={barHeight}
                        fill="#9B6DFF"
                        fillOpacity="0.25"
                      >
                        <title>{`Velocity: +${b.velocity_pts_per_hr} pts/hr`}</title>
                      </rect>
                    )
                  })}

                {/* Stepped Line (Flat baseline at 0 if no activity) */}
                {stepPathD && (
                  <path
                    d={stepPathD}
                    fill="none"
                    stroke="#121212"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                )}

                {/* Vertical Dashed Submission Event Markers */}
                {hasActivity &&
                  submission_markers.map((marker, idx) => {
                    if (numBuckets === 0) return null
                    const t0 = new Date(time_series[0].bucket_start).getTime()
                    const tN = new Date(
                      time_series[numBuckets - 1].bucket_end
                    ).getTime()
                    const tm = new Date(marker.timestamp).getTime()
                    const ratio = Math.max(
                      0,
                      Math.min(1, (tm - t0) / Math.max(1, tN - t0))
                    )
                    const xm = padLeft + ratio * chartWidth

                    return (
                      <g key={`marker-${idx}`} className="cursor-pointer group">
                        <line
                          x1={xm}
                          y1={padTop}
                          x2={xm}
                          y2={padTop + chartHeight}
                          stroke="#F56565"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        <circle cx={xm} cy={padTop + 4} r="4" fill="#F56565" />
                        <title>{`${marker.title} (${formatRelativeTime(marker.timestamp)})`}</title>
                        <text
                          x={xm + 4}
                          y={padTop + 14}
                          className="font-mono text-[9px] fill-[#F56565] font-bold"
                        >
                          {marker.title.slice(0, 24)}...
                        </text>
                      </g>
                    )
                  })}

                {/* X Axis Baseline */}
                <line
                  x1={padLeft}
                  y1={padTop + chartHeight}
                  x2={padLeft + chartWidth}
                  y2={padTop + chartHeight}
                  stroke="#121212"
                  strokeWidth="1.5"
                />

                {/* X Axis Timestamps */}
                {numBuckets > 0 && (
                  <>
                    <text
                      x={padLeft}
                      y={padTop + chartHeight + 16}
                      className="font-mono text-[10px] fill-[#646464]"
                    >
                      -{window}
                    </text>
                    <text
                      x={padLeft + chartWidth / 2}
                      y={padTop + chartHeight + 16}
                      textAnchor="middle"
                      className="font-mono text-[10px] fill-[#646464]"
                    >
                      MID-WINDOW
                    </text>
                    <text
                      x={padLeft + chartWidth}
                      y={padTop + chartHeight + 16}
                      textAnchor="end"
                      className="font-mono text-[10px] fill-[#121212] font-bold"
                    >
                      NOW
                    </text>
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[#E5E0DA] font-mono text-[11px] text-[#646464]">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-[#121212]" />
              <span>Cumulative Points (LOCF)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#9B6DFF] opacity-30 border border-[#121212]" />
              <span>Interval Velocity (pts/hr)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t border-dashed border-[#F56565]" />
              <span>Reddit Submission Event</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row (12 columns) — 6-Column Reddit Submission Provenance Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-reddit-provenance"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            Reddit Submission Provenance
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {submissions.length} Linked Discussions
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Complete community discussion provenance indexed from r/vinylreleases threads with engagement telemetry.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Submission Title & ID</th>
                <th className="py-2.5 px-3">Posted</th>
                <th className="py-2.5 px-3">Score & Upvote Ratio</th>
                <th className="py-2.5 px-3">Comments</th>
                <th className="py-2.5 px-3">Window Velocity</th>
                <th className="py-2.5 px-3 text-right">Source Link</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const upvotePct = Math.round(sub.latest_upvote_ratio * 100)
                const postedDate = new Date(sub.created_utc).toISOString().split('T')[0]
                const postedRelative = formatRelativeTime(sub.created_utc)

                return (
                  <tr
                    key={sub.submission_id}
                    className="border-b border-[#E5E0DA] hover:bg-[#FAF7F5] transition-colors"
                  >
                    {/* Column 1: Submission Title & ID */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 max-w-md">
                        <span className="font-sans text-xs font-medium text-[#121212] line-clamp-2">
                          {sub.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="bg-[#F7F3F0] border border-[#121212] px-1.5 py-0.2 rounded font-mono text-[10px] text-[#646464]">
                            {sub.submission_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Posted */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      <div>{postedRelative}</div>
                      <div className="text-[10px] text-[#646464]">{postedDate}</div>
                    </td>

                    {/* Column 3: Score & Upvote Ratio */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      <span className="font-bold">{sub.latest_score} pts</span>{' '}
                      <span className="text-[#646464]">({upvotePct}% upvoted)</span>
                    </td>

                    {/* Column 4: Comments */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      {sub.latest_num_comments} comments
                    </td>

                    {/* Column 5: Window Velocity */}
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      +{sub.window_velocity} pts/hr
                    </td>

                    {/* Column 6: Source Link */}
                    <td className="py-3 px-3 text-right">
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#121212] bg-[#FAF7F5] border-[1.5px] border-[#121212] px-2.5 py-1 rounded-[4px] hover:bg-[#9B6DFF] hover:text-[#121212] transition-colors shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
                      >
                        Reddit ↗
                      </a>
                    </td>
                  </tr>
                )
              })}

              {submissions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center font-mono text-xs text-[#646464]"
                  >
                    No Reddit submissions recorded for this pressing.
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
