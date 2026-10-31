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

  it('renders loading skeleton when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    expect(screen.getByTestId('screen-album-detail-loading')).toBeInTheDocument()
  })

  it('renders header, title, combined artist, and Last Seen provenance chip', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Lull')).toBeInTheDocument()
    })

    expect(screen.getByText('The Smashing Pumpkins')).toBeInTheDocument()
    expect(screen.getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Directory/i)).toBeInTheDocument()
  })

  it('renders 4-cell hero KPI strip with correct metrics and tiers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const hypeIndexCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeIndexCard).toHaveTextContent('84')
    expect(hypeIndexCard).toHaveTextContent(/HIGH/i)

    const velocityCard = screen.getByTestId('hero-kpi-hype-velocity')
    expect(velocityCard).toHaveTextContent('+12.5 pts/hr')

    const redditCard = screen.getByTestId('hero-kpi-reddit-demand')
    expect(redditCard).toHaveTextContent('+45')
    expect(redditCard).toHaveTextContent('95 upvotes')

    const provCard = screen.getByTestId('hero-kpi-provenance')
    expect(provCard).toHaveTextContent('2 Pressings')
    expect(provCard).toHaveTextContent('2 Posts')
  })

  it('renders stepped LOCF chart and submission event markers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('chart-stepped-locf')).toBeInTheDocument()
    })

    expect(screen.getByText(/Stepped Engagement & Velocity Curve/i)).toBeInTheDocument()
    // Event marker title exists in DOM/tooltip
    expect(screen.getAllByText(/Pre-Order/i).length).toBeGreaterThan(0)
  })

  it('renders child-release share of demand card with variant fallbacks', async () => {
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
  })

  it('renders 7-column child releases matrix with action link preserving window query', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse24H,
    } as Response)

    renderComponent('/albums/alb-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-child-releases')).toBeInTheDocument()
    })

    const viewLinks = screen.getAllByRole('link', { name: /View Release →/i })
    expect(viewLinks.length).toBe(2)
    expect(viewLinks[0]).toHaveAttribute('href', '/releases/rel-1?window=24H')
    expect(viewLinks[1]).toHaveAttribute('href', '/releases/rel-2?window=24H')
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
