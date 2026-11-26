import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AlbumDetail } from '../pages/AlbumDetail'

const mockAlbumResponse24H = {
  album_id: 'alb-test-123',
  album_title: 'Lull',
  combined_artist: 'The Smashing Pumpkins',
  monogram_key: 'alb-test-123',
  first_seen_at: '2026-10-31T10:00:00Z',
  last_seen_at: '2026-10-31T15:00:00Z',
  window: '24H',
  album: {
    album_id: 'alb-test-123',
    album_title: 'Lull',
    combined_artist: 'The Smashing Pumpkins',
    monogram_key: 'alb-test-123',
    first_seen_at: '2026-10-31T10:00:00Z',
    last_seen_at: '2026-10-31T15:00:00Z',
    artists: [{ artist_id: 'art-1', name: 'The Smashing Pumpkins' }],
  },
  hero_kpi: {
    hype_index: 84,
    tier: 'high',
    hype_velocity: 12.5,
    points_gain: 45,
    total_score: 95,
    total_comments: 25,
    submission_count: 2,
    release_count: 2,
    first_seen_at: '2026-10-31T10:00:00Z',
    last_seen_at: '2026-10-31T15:00:00Z',
    reddit_demand: {
      points_gain: 45,
      total_score: 95,
      total_comments: 25,
      submission_count: 2,
    },
    pressings_provenance: {
      release_count: 2,
      submission_count: 2,
      first_seen_at: '2026-10-31T10:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
    },
  },
  time_series: Array.from({ length: 24 }).map((_, i) => ({
    bucket_start: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
    bucket_end: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    cumulative_points: i * 5,
    velocity_pts_per_hr: 5.0,
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    points: i * 5,
    velocity: 5.0,
  })),
  submission_markers: [
    {
      timestamp: '2026-10-31T12:00:00Z',
      submission_id: 'sub-1',
      title: '[Pre-Order] The Smashing Pumpkins - Lull (Reissue)',
    },
  ],
  share_of_demand: [
    {
      release_id: 'rel-1',
      variant: 'Opaque Purple Vinyl',
      retailer_name: 'Rough Trade',
      share_percentage: 65.0,
      points: 75,
    },
    {
      release_id: 'rel-2',
      variant: null,
      retailer_name: null,
      share_percentage: 35.0,
      points: 40,
    },
  ],
  child_releases: [
    {
      release_id: 'rel-1',
      variant: 'Opaque Purple Vinyl',
      retailer_name: 'Rough Trade',
      share_percentage: 65.0,
      hype_velocity: 8.5,
      hype_index: 82,
      tier: 'high',
      submission_count: 1,
      total_score: 60,
      total_comments: 15,
      first_seen_at: '2026-10-31T10:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
    },
    {
      release_id: 'rel-2',
      variant: null,
      retailer_name: null,
      share_percentage: 35.0,
      hype_velocity: 4.0,
      hype_index: 55,
      tier: 'moderate',
      submission_count: 1,
      total_score: 35,
      total_comments: 10,
      first_seen_at: '2026-10-31T11:00:00Z',
      last_seen_at: '2026-10-31T14:00:00Z',
    },
  ],
}

const mockAlbumResponse7D = {
  ...mockAlbumResponse24H,
  window: '7D',
  time_series: Array.from({ length: 28 }).map((_, i) => ({
    bucket_start: new Date(Date.now() - (28 - i) * 6 * 3600000).toISOString(),
    bucket_end: new Date(Date.now() - (27 - i) * 6 * 3600000).toISOString(),
    cumulative_points: i * 4,
    velocity_pts_per_hr: 2.0,
    timestamp: new Date(Date.now() - (27 - i) * 6 * 3600000).toISOString(),
    points: i * 4,
    velocity: 2.0,
  })),
}

function renderComponent(initialRoute = '/albums/alb-test-123') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/albums/:albumId" element={<AlbumDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AlbumDetail Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading skeleton with 3 KPI skeleton cards when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    const skeleton = screen.getByTestId('screen-album-detail-loading')
    expect(skeleton).toBeInTheDocument()
    expect(within(skeleton).getAllByTestId('hero-kpi-skeleton-card')).toHaveLength(3)
  })

  it('renders editorial ALBUM super-header, monochrome masthead with square monogram, artist chips, and Last Seen', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Lull' })).toBeInTheDocument()
    })

    const superHeader = screen.getByTestId('entity-super-header')
    expect(superHeader).toHaveTextContent('ALBUM')
    expect(superHeader).toHaveClass('border-b-[3px]')
    expect(superHeader.textContent).not.toContain('/')

    expect(screen.getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('vinyl-monogram')).toHaveClass('rounded-[6px]')
    expect(screen.getAllByText('The Smashing Pumpkins').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('artist-chip-art-1')).toBeInTheDocument()
    expect(screen.getByTestId('artist-chip-art-1')).toHaveAttribute('href', '/artists/art-1?window=24H')
    expect(screen.getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Directory/i)).toBeInTheDocument()
  })

  it('renders 3-card hero KPI strip with Hype Index, Engagement, and Pressings', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const kpiStrip = screen.getByTestId('hero-kpi-strip')
    expect(kpiStrip.children).toHaveLength(3)

    const hypeIndexCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeIndexCard).toHaveTextContent('84')
    expect(hypeIndexCard).toHaveTextContent(/HIGH/i)

    const engagementCard = screen.getByTestId('hero-kpi-engagement')
    expect(engagementCard).toHaveTextContent('Engagement')
    expect(engagementCard).toHaveTextContent('95 votes')
    expect(engagementCard).toHaveTextContent('25 comments · 2 mentions')

    const pressingsCard = screen.getByTestId('hero-kpi-pressings')
    expect(pressingsCard).toHaveTextContent('Pressings')
    expect(pressingsCard).toHaveTextContent('2 Pressings')
    expect(pressingsCard).toHaveTextContent(/Last seen/i)

    expect(screen.queryByTestId('hero-kpi-hype-velocity')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-reddit-demand')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-provenance')).not.toBeInTheDocument()
  })

  it('renders Activity Over Time chart with cumulative curve, readable ticks, interactive tooltip, and non-overlapping mention markers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-over-time-chart')).toBeInTheDocument()
    })

    const chart = screen.getByTestId('activity-over-time-chart')
    expect(within(chart).getByText('Activity Over Time')).toBeInTheDocument()
    expect(
      within(chart).getByText(/Combined engagement across all pressings of this album\./i)
    ).toBeInTheDocument()
    expect(within(chart).getByText('Engagement')).toBeInTheDocument()
    expect(within(chart).getByText('NOW')).toBeInTheDocument()

    // Readable local clock ticks for 24H (e.g. "6 PM", "12 AM")
    const xTicks = within(chart).getAllByTestId(/^x-axis-tick-/)
    expect(xTicks.length).toBeGreaterThanOrEqual(3)
    expect(xTicks.some((el) => /\b(1[0-2]|[1-9])\s?(AM|PM)\b/i.test(el.textContent || ''))).toBe(true)

    // No velocity bars
    expect(chart.querySelectorAll('[data-velocity-bar]')).toHaveLength(0)

    // Mention marker title is NOT rendered as colliding inline SVG text by default
    const svg = chart.querySelector('svg')
    expect(svg).not.toBeNull()
    const svgTexts = Array.from(svg!.querySelectorAll('text')).map((t) => t.textContent || '')
    expect(svgTexts.some((txt) => txt.includes('Pre-Order'))).toBe(false)

    // Hover & keyboard focus interval tooltip
    const interval10 = screen.getByTestId('chart-interval-10')
    fireEvent.mouseEnter(interval10)
    const tooltip = screen.getByTestId('chart-tooltip')
    expect(tooltip).toHaveTextContent('50')
    fireEvent.mouseLeave(interval10)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()

    const interval12 = screen.getByTestId('chart-interval-12')
    fireEvent.focus(interval12)
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('60')
    fireEvent.blur(interval12)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()

    // Hover/focus Mention marker reveals full mention title cleanly
    const marker0 = screen.getByTestId('mention-marker-0')
    fireEvent.mouseEnter(marker0)
    expect(screen.getByTestId('mention-marker-tooltip')).toHaveTextContent(
      '[Pre-Order] The Smashing Pumpkins - Lull (Reissue)'
    )
    fireEvent.mouseLeave(marker0)
    expect(screen.queryByTestId('mention-marker-tooltip')).not.toBeInTheDocument()
  })

  it('formats X-axis ticks as short month/day dates for 7D window', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse7D,
    } as Response)

    renderComponent('/albums/alb-test-123?window=7D')

    await waitFor(() => {
      expect(screen.getByTestId('activity-over-time-chart')).toBeInTheDocument()
    })

    const chart = screen.getByTestId('activity-over-time-chart')
    const xTicks = within(chart).getAllByTestId(/^x-axis-tick-/)
    expect(
      xTicks.some((el) =>
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/.test(
          el.textContent || ''
        )
      )
    ).toBe(true)
    expect(within(chart).getByText('NOW')).toBeInTheDocument()
  })

  it('renders plain-English Share of Demand card with variant fallbacks and no normalization footnote', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('card-share-of-demand')).toBeInTheDocument()
    })

    const card = screen.getByTestId('card-share-of-demand')
    expect(within(card).getByText('Opaque Purple Vinyl')).toBeInTheDocument()
    expect(within(card).getByText('65%')).toBeInTheDocument()

    // Fallback for null variant
    expect(within(card).getByText('Standard Pressing')).toBeInTheDocument()
    expect(within(card).getByText('35%')).toBeInTheDocument()
    // Fallback for null retailer
    expect(within(card).getByText('Wide / Unspecified')).toBeInTheDocument()

    expect(card).not.toHaveTextContent(/collector variant conviction/i)
    expect(card).not.toHaveTextContent(/Shares normalize to 100\.0%/i)
  })

  it('renders 6-column All Pressings table without Hype Velocity and with Engagement breakdown', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent('/albums/alb-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-all-pressings')).toBeInTheDocument()
    })

    const tableCard = screen.getByTestId('table-all-pressings')
    expect(within(tableCard).getByText('All Pressings')).toBeInTheDocument()
    expect(within(tableCard).getByText('2 Pressings')).toBeInTheDocument()

    const headers = within(tableCard)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim())
    expect(headers).toEqual([
      'Variant',
      'Retailer',
      'Share of Demand',
      'Hype Index',
      'Engagement',
      'Action',
    ])

    expect(tableCard).toHaveTextContent('1 mention · 60 votes · 15 comments')
    expect(tableCard).toHaveTextContent('1 mention · 35 votes · 10 comments')
    expect(tableCard).not.toHaveTextContent(/Hype Velocity|pts\/hr|provenance|Child Releases/i)

    const viewLinks = within(tableCard).getAllByRole('link', { name: /View Release →/i })
    expect(viewLinks.length).toBe(2)
    expect(viewLinks[0]).toHaveAttribute('href', '/releases/rel-1?window=24H')
    expect(viewLinks[1]).toHaveAttribute('href', '/releases/rel-2?window=24H')
  })

  it('renders zero banned jargon strings across the entire Album Detail screen', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('screen-album-detail')).toBeInTheDocument()
    })

    const fullText = screen.getByTestId('screen-album-detail').textContent || ''
    const bannedPatterns = [
      /\bReddit\b/i,
      /r\/vinylreleases/i,
      /pts\/hr/i,
      /\bLOCF\b/i,
      /\bBuckets\b/i,
      /\bProvenance\b/i,
      /E = score/i,
      /Child Releases/i,
      /Shares normalize to 100\.0%/i,
      /\bHype Velocity\b/i,
      /\bSubmissions\b/i,
    ]
    for (const pattern of bannedPatterns) {
      expect(fullText).not.toMatch(pattern)
    }
  })

  it('renders zero-activity callout banner when window engagement is zero', async () => {
    const zeroActivityResponse = {
      ...mockAlbumResponse24H,
      hero_kpi: {
        ...mockAlbumResponse24H.hero_kpi,
        points_gain: 0,
        reddit_demand: {
          points_gain: 0,
          total_score: 0,
          total_comments: 0,
          submission_count: 0,
        },
      },
      time_series: Array.from({ length: 24 }).map((_, i) => ({
        bucket_start: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
        bucket_end: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        cumulative_points: 0,
        velocity_pts_per_hr: 0,
        timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        points: 0,
        velocity: 0,
      })),
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => zeroActivityResponse,
    } as Response)

    renderComponent('/albums/alb-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('zero-activity-callout')).toBeInTheDocument()
    })

    expect(screen.getByText(/NO NEW ACTIVITY IN 24H/i)).toBeInTheDocument()
  })

  it('toggles window switcher and refetches with new window parameter', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlbumResponse24H,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlbumResponse7D,
      } as Response)

    renderComponent('/albums/alb-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByText('Lull')).toBeInTheDocument()
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/albums/alb-test-123?window=24H')

    // Click 7D window button
    const btn7D = screen.getByRole('button', { name: '7D' })
    fireEvent.click(btn7D)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/albums/alb-test-123?window=7D')
    })
  })

  it('renders Coral Alert error banner on fetch error with retry CTA', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('album-detail-error')).toBeInTheDocument()
    })

    expect(screen.getByText(/Failed to load album intelligence/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
