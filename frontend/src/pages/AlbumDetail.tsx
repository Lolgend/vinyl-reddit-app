import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowLeft, Disc, Flame, Layers, TrendingUp } from 'lucide-react'
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
      <div className="flex flex-col gap-6" data-testid="screen-album-detail-loading">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[4px] bg-[#E5E0DA] border-[1.5px] border-[#121212] animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="w-64 h-8 bg-[#E5E0DA] rounded animate-pulse" />
            <div className="w-40 h-4 bg-[#E5E0DA] rounded animate-pulse" />
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
    time_series.some((b) => b.velocity_pts_per_hr > 0)

  // Chart dimensions & calculations
  const chartWidth = 740
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
    const firstY = padTop + chartHeight - (time_series[0].cumulative_points / maxPts) * chartHeight
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
  const lastSeenDate = data.last_seen_at
    ? `${formatRelativeTime(data.last_seen_at)} (${new Date(data.last_seen_at).toISOString().split('T')[0]})`
    : 'NEVER'

  return (
    <div className="flex flex-col gap-6" data-testid="screen-album-detail">
      {/* Back Link preserving window parameter */}
      <div>
        <Link
          to={`/directory?tab=albums&window=${window}`}
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
            name={data.album_title}
            entityId={data.monogram_key || data.album_id}
            size={64}
          />
          <div>
            <h1 className="font-grotesk font-bold text-3xl text-[#121212] tracking-tight">
              {data.album_title}
            </h1>
            <div className="text-base text-[#646464] font-medium mt-0.5">
              {data.combined_artist}
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
              +{hero_kpi.hype_velocity} <span className="text-sm font-normal text-[#646464]">pts/hr</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2">
              Engagement speed in {window}
            </div>
          </div>
        </div>

        {/* Cell 3: Reddit Demand */}
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
              +{hero_kpi.points_gain} <span className="text-sm font-normal text-[#646464]">pts</span>
            </div>
            <div className="font-mono text-[11px] text-[#646464] mt-2 truncate">
              {hero_kpi.total_score} upvotes · {hero_kpi.total_comments} comments
            </div>
          </div>
        </div>

        {/* Cell 4: Pressings & Provenance */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-4 flex flex-col justify-between"
          data-testid="hero-kpi-provenance"
        >
          <div className="flex items-center justify-between text-[#646464] mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-[#121212]" />
              Pressings & Provenance
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
              {hero_kpi.submission_count} Posts · Last seen {formatRelativeTime(data.last_seen_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (12 columns): 8-col Stepped LOCF Chart + 4-col Share-of-Demand */}
      <div className="grid grid-cols-12 gap-5">
        {/* 8-col Stepped LOCF Time-Series Chart */}
        <div
          className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12 lg:col-span-8 flex flex-col justify-between"
          data-testid="chart-stepped-locf"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-grotesk font-bold text-lg text-[#121212]">
                Stepped Engagement & Velocity Curve
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
                className="w-full h-auto min-w-[500px]"
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

                {/* Stepped Velocity Bars (Secondary metric visual) */}
                {hasActivity &&
                  time_series.map((b, i) => {
                    const bWidth = chartWidth / numBuckets
                    const x = padLeft + i * bWidth
                    const barHeight = (b.velocity_pts_per_hr / maxVel) * (chartHeight * 0.4)
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
                    const tN = new Date(time_series[numBuckets - 1].bucket_end).getTime()
                    const tm = new Date(marker.timestamp).getTime()
                    const ratio = Math.max(0, Math.min(1, (tm - t0) / Math.max(1, tN - t0)))
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

        {/* 4-col Child-Release Share-of-Demand Card */}
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
                {share_of_demand.length} Pressings
              </span>
            </div>
            <p className="font-sans text-xs text-[#646464] mb-4">
              Relative collector variant conviction calculated across linked submission engagement.
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
                      <span>{item.points} pts</span>
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

          <div className="mt-4 pt-3 border-t border-[#E5E0DA] font-mono text-[10px] text-[#646464]">
            Shares normalize to 100.0% with uniform fallback.
          </div>
        </div>
      </div>

      {/* Bottom Row (12 columns) — 7-Column Child Releases Table */}
      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-5 col-span-12"
        data-testid="table-child-releases"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-grotesk font-bold text-lg text-[#121212] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#121212]" />
            Child Releases & Pressing Matrix
          </div>
          <span className="font-mono text-xs text-[#646464]">
            {child_releases.length} Recorded Editions
          </span>
        </div>
        <p className="font-sans text-xs text-[#646464] mb-4">
          Direct comparison across physical pressings, retail stockists, demand velocity, and provenance links.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3F0] border-b-[1.5px] border-[#121212] font-mono text-[11px] text-[#646464] uppercase">
                <th className="py-2.5 px-3">Variant</th>
                <th className="py-2.5 px-3">Retailer</th>
                <th className="py-2.5 px-3">Share of Demand</th>
                <th className="py-2.5 px-3">Hype Velocity</th>
                <th className="py-2.5 px-3">Hype Index</th>
                <th className="py-2.5 px-3">Submissions</th>
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
                    <td className="py-3 px-3 font-mono text-xs text-[#121212]">
                      +{cr.hype_velocity} pts/hr
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {renderTierBadge(cr.hype_index, cr.tier)}
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
                      {cr.submission_count} posts · {cr.total_score} pts · {cr.total_comments} comments
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
