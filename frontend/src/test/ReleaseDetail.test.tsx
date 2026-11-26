import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReleaseDetail } from '../pages/ReleaseDetail'

const mockReleaseResponse24H = {
  release_id: 'rel-test-123',
  album_id: 'alb-test-456',
  album_title: 'Lull',
  combined_artist: 'The Smashing Pumpkins',
  variant: 'Opaque Purple Vinyl',
  retailer_name: 'Rough Trade',
  first_seen_at: '2026-10-31T10:00:00Z',
  last_seen_at: '2026-10-31T15:00:00Z',
  monogram_key: 'rel-test-123',
  window: '24H',
  specs: {
    release_id: 'rel-test-123',
    album_id: 'alb-test-456',
    album_title: 'Lull',
    combined_artist: 'The Smashing Pumpkins',
    artist_id: 'art-test-1',
    variant: 'Opaque Purple Vinyl',
    retailer_name: 'Rough Trade',
    first_seen_at: '2026-10-31T10:00:00Z',
    last_seen_at: '2026-10-31T15:00:00Z',
    monogram_key: 'rel-test-123',
  },
  parent_album: {
    album_id: 'alb-test-456',
    album_title: 'Lull',
    release_count: 3,
  },
  hero_kpi: {
    hype_index: 82,
    tier: 'high',
    hype_velocity: 8.5,
    submission_engagement: {
      points_gain: 35,
      total_score: 60,
      total_comments: 15,
      submission_count: 2,
      latest_upvote_ratio: 0.95,
    },
    provenance_summary: {
      first_seen_at: '2026-10-31T10:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
      linked_submissions_count: 2,
    },
    points_gain: 35,
    total_score: 60,
    total_comments: 15,
    submission_count: 2,
    first_seen_at: '2026-10-31T10:00:00Z',
    last_seen_at: '2026-10-31T15:00:00Z',
  },
  time_series: Array.from({ length: 24 }).map((_, i) => ({
    bucket_start: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
    bucket_end: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    cumulative_points: i * 4,
    velocity_pts_per_hr: 4.0,
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    points: i * 4,
    velocity: 4.0,
  })),
  submission_markers: [
    {
      timestamp: '2026-10-31T12:00:00Z',
      submission_id: 'sub-1',
      title: '[Pre-Order] The Smashing Pumpkins - Lull (Purple Vinyl)',
    },
  ],
  submissions: [
    {
      submission_id: 't3_1xjjfem',
      title: 'The Smashing Pumpkins - Lull (Opaque Purple Vinyl)',
      created_utc: '2026-10-31T12:00:00Z',
      latest_score: 60,
      latest_upvote_ratio: 0.95,
      latest_num_comments: 15,
      window_velocity: 5.5,
      url: 'https://www.reddit.com/comments/1xjjfem',
      external_url: 'https://roughtrade.com/product/lull',
    },
    {
      submission_id: 't3_1xjo999',
      title: 'The Smashing Pumpkins - Lull Restock',
      created_utc: '2026-10-31T14:00:00Z',
      latest_score: 25,
      latest_upvote_ratio: 0.88,
      latest_num_comments: 5,
      window_velocity: 3.0,
      url: 'https://www.reddit.com/comments/1xjo999',
      external_url: null,
    },
  ],
}

const mockReleaseResponse7D = {
  ...mockReleaseResponse24H,
  window: '7D',
  time_series: Array.from({ length: 28 }).map((_, i) => ({
    bucket_start: new Date(Date.now() - (28 - i) * 6 * 3600000).toISOString(),
    bucket_end: new Date(Date.now() - (27 - i) * 6 * 3600000).toISOString(),
    cumulative_points: i * 3,
    velocity_pts_per_hr: 1.5,
    timestamp: new Date(Date.now() - (27 - i) * 6 * 3600000).toISOString(),
    points: i * 3,
    velocity: 1.5,
  })),
}

function renderComponent(initialRoute = '/releases/rel-test-123') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/releases/:releaseId" element={<ReleaseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReleaseDetail Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading skeleton with 3 KPI skeleton cards and square monogram when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    const skeleton = screen.getByTestId('screen-release-detail-loading')
    expect(skeleton).toBeInTheDocument()
    expect(within(skeleton).getAllByTestId('hero-kpi-skeleton-card')).toHaveLength(3)
  })

  it('renders RELEASE super-header, monochrome masthead with square monogram, equal-prominence Album & Artist links, Retailer, and Last Seen', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Opaque Purple Vinyl' })).toBeInTheDocument()
    })

    const superHeader = screen.getByTestId('entity-super-header')
    expect(superHeader).toHaveTextContent('RELEASE')
    expect(superHeader).toHaveClass('border-b-[3px]')
    expect(superHeader.textContent).not.toContain('/')

    expect(screen.getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('vinyl-monogram')).toHaveClass('rounded-[6px]')

    const masthead = screen.getByTestId('entity-masthead')
    const albumLink = within(masthead).getByRole('link', { name: 'Lull' })
    expect(albumLink).toHaveAttribute('href', '/albums/alb-test-456?window=24H')
    expect(albumLink).toHaveClass('font-bold')

    const artistLink = within(masthead).getByRole('link', { name: 'The Smashing Pumpkins' })
    expect(artistLink).toHaveAttribute('href', '/artists/art-test-1?window=24H')
    expect(artistLink).toHaveClass('font-bold')

    expect(within(masthead).getByText(/Rough Trade/i)).toBeInTheDocument()
    expect(within(masthead).getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Album: Lull \(3 Releases\)/i)).toBeInTheDocument()
  })

  it('falls back H1 to "{album_title} — Standard Pressing" when variant is null or "Standard Pressing"', async () => {
    const nullVariantResponse = {
      ...mockReleaseResponse24H,
      variant: null,
      specs: {
        ...mockReleaseResponse24H.specs,
        variant: null,
      },
    }
    const standardPressingResponse = {
      ...mockReleaseResponse24H,
      variant: 'Standard Pressing',
      specs: {
        ...mockReleaseResponse24H.specs,
        variant: 'Standard Pressing',
      },
    }

    const fetchSpy = vi.spyOn(global, 'fetch')
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => nullVariantResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => standardPressingResponse,
      } as Response)

    const { unmount } = renderComponent()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Lull — Standard Pressing' })
      ).toBeInTheDocument()
    })

    const masthead = screen.getByTestId('entity-masthead')
    expect(within(masthead).getByRole('link', { name: 'Lull' })).toHaveAttribute(
      'href',
      '/albums/alb-test-456?window=24H'
    )
    expect(within(masthead).getByRole('link', { name: 'The Smashing Pumpkins' })).toHaveAttribute(
      'href',
      '/artists/art-test-1?window=24H'
    )

    unmount()
    renderComponent('/releases/rel-std-123')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Lull — Standard Pressing' })
      ).toBeInTheDocument()
    })
  })

  it('renders 3-card hero KPI strip with Hype Index, Engagement (no upvote ratio), and Retailer & First Seen', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const kpiStrip = screen.getByTestId('hero-kpi-strip')
    expect(kpiStrip.children).toHaveLength(3)

    const hypeCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeCard).toHaveTextContent('82')
    expect(hypeCard).toHaveTextContent(/HIGH/i)

    const engCard = screen.getByTestId('hero-kpi-engagement')
    expect(engCard).toHaveTextContent('Engagement')
    expect(engCard).toHaveTextContent('60 votes')
    expect(engCard).toHaveTextContent('15 comments · 2 mentions')
    expect(engCard.textContent).not.toMatch(/95%|pts\/hr|upvote/i)

    const retailerCard = screen.getByTestId('hero-kpi-retailer-first-seen')
    expect(retailerCard).toHaveTextContent('Retailer & First Seen')
    expect(retailerCard).toHaveTextContent('Rough Trade')
    expect(retailerCard).toHaveTextContent('First tracked 2026-10-31')

    expect(screen.queryByTestId('hero-kpi-hype-velocity')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-submission-engagement')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-provenance-summary')).not.toBeInTheDocument()
  })

  it('renders Physical Specifications card without UUID, catalog provenance, or normalized-metadata footnote', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent('/releases/rel-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('card-physical-specs')).toBeInTheDocument()
    })

    const specsCard = screen.getByTestId('card-physical-specs')
    expect(specsCard).toHaveTextContent('Physical Specifications')
    expect(specsCard).toHaveTextContent('The Smashing Pumpkins')
    const artistLink = within(specsCard).getByRole('link', { name: /The Smashing Pumpkins/i })
    expect(artistLink).toHaveAttribute('href', '/artists/art-test-1?window=24H')
    expect(specsCard).toHaveTextContent('View Album (3 Releases) →')
    expect(specsCard).toHaveTextContent('Opaque Purple Vinyl')
    expect(specsCard).toHaveTextContent('Rough Trade')
    expect(specsCard).toHaveTextContent('2026-10-31')

    const parentAlbumLink = within(specsCard).getByRole('link', { name: /View Album/i })
    expect(parentAlbumLink).toHaveAttribute('href', '/albums/alb-test-456?window=24H')

    expect(specsCard.textContent).not.toMatch(/UUID:|catalog provenance|Catalog identity derived from normalized metadata/i)
  })

  it('renders shared Activity Over Time chart with readable ticks, interactive tooltip, and mention markers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-over-time-chart')).toBeInTheDocument()
    })

    const chart = screen.getByTestId('activity-over-time-chart')
    expect(within(chart).getByText('Activity Over Time')).toBeInTheDocument()
    expect(within(chart).getByText('Engagement')).toBeInTheDocument()
    expect(within(chart).getByText('NOW')).toBeInTheDocument()

    const xTicks = within(chart).getAllByTestId(/^x-axis-tick-/)
    expect(xTicks.length).toBeGreaterThanOrEqual(3)
    expect(xTicks.some((el) => /\b(1[0-2]|[1-9])\s?(AM|PM)\b/i.test(el.textContent || ''))).toBe(true)

    expect(chart.textContent).not.toMatch(/LOCF|Buckets|E = score|pts\/hr/i)

    // Hover & keyboard focus interval tooltip
    const interval10 = screen.getByTestId('chart-interval-10')
    fireEvent.mouseEnter(interval10)
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('40')
    fireEvent.mouseLeave(interval10)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()

    const interval12 = screen.getByTestId('chart-interval-12')
    fireEvent.focus(interval12)
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('48')
    fireEvent.blur(interval12)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()

    // Mention marker hover tooltip
    const marker0 = screen.getByTestId('mention-marker-0')
    fireEvent.mouseEnter(marker0)
    expect(screen.getByTestId('mention-marker-tooltip')).toHaveTextContent(
      '[Pre-Order] The Smashing Pumpkins - Lull (Purple Vinyl)'
    )
  })

  it('renders zero-activity callout banner when window engagement is zero', async () => {
    const zeroActivityResponse = {
      ...mockReleaseResponse24H,
      hero_kpi: {
        ...mockReleaseResponse24H.hero_kpi,
        points_gain: 0,
        submission_engagement: {
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

    renderComponent('/releases/rel-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('zero-activity-callout')).toBeInTheDocument()
    })

    expect(screen.getByText(/NO NEW ACTIVITY IN 24H/i)).toBeInTheDocument()
  })

  it('renders Source Mentions table with 5 columns, clean votes, View Source links, and zero banned jargon', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('table-source-mentions')).toBeInTheDocument()
    })

    const tableSection = screen.getByTestId('table-source-mentions')
    expect(tableSection).toHaveTextContent('Source Mentions')
    expect(tableSection).toHaveTextContent('2 Linked Mentions')

    const columnHeaders = within(tableSection).getAllByRole('columnheader')
    expect(columnHeaders.map((th) => th.textContent?.trim())).toEqual([
      'Mention Title',
      'Posted',
      'Votes',
      'Comments',
      'Source Link',
    ])

    expect(within(tableSection).queryByText('t3_1xjjfem')).not.toBeInTheDocument()
    expect(within(tableSection).getByText('The Smashing Pumpkins - Lull (Opaque Purple Vinyl)')).toBeInTheDocument()
    expect(within(tableSection).getByText('60 votes')).toBeInTheDocument()
    expect(within(tableSection).getByText('15 comments')).toBeInTheDocument()

    const sourceLinks = within(tableSection).getAllByRole('link', { name: /View Source ↗/i })
    expect(sourceLinks).toHaveLength(2)
    expect(sourceLinks[0]).toHaveAttribute('href', 'https://www.reddit.com/comments/1xjjfem')
    expect(sourceLinks[0]).toHaveAttribute('target', '_blank')
    expect(sourceLinks[0]).toHaveAttribute('rel', 'noreferrer noopener')

    const screenText = screen.getByTestId('screen-release-detail').textContent || ''
    expect(screenText).not.toMatch(
      /Reddit|r\/vinylreleases|pts\/hr|LOCF|Buckets|Provenance|UUID|t3_|E = score|% upvoted|Window Velocity|engagement telemetry/i
    )
  })

  it('renders source-agnostic empty state when no mentions are recorded', async () => {
    const emptyMentionsResponse = {
      ...mockReleaseResponse24H,
      submissions: [],
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => emptyMentionsResponse,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('table-source-mentions')).toBeInTheDocument()
    })

    expect(screen.getByText('No mentions recorded for this pressing.')).toBeInTheDocument()
  })

  it('switches window from 24H to 7D updating fetch query', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleaseResponse24H,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleaseResponse7D,
      } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Opaque Purple Vinyl' })).toBeInTheDocument()
    })

    const btn7D = screen.getByRole('button', { name: '7D' })
    fireEvent.click(btn7D)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/releases/rel-test-123?window=7D')
    })
  })

  it('renders error banner with retry button on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('release-detail-error')).toBeInTheDocument()
    })

    expect(screen.getByText(/Failed to load release specification/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
