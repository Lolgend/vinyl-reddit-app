import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('renders loading skeleton when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    expect(screen.getByTestId('screen-release-detail-loading')).toBeInTheDocument()
  })

  it('renders header, title, variant, combined artist, breadcrumbs, and Last Seen provenance chip', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Lull — Opaque Purple Vinyl')).toBeInTheDocument()
    })

    expect(screen.getByText(/The Smashing Pumpkins · Rough Trade/i)).toBeInTheDocument()
    expect(screen.getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Album: Lull \(3 Releases\)/i)).toBeInTheDocument()
  })

  it('renders 4-cell hero KPI strip with correct metrics, index, velocity, engagement, provenance', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const hypeCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeCard).toHaveTextContent('82')
    expect(hypeCard).toHaveTextContent(/HIGH/i)

    const velCard = screen.getByTestId('hero-kpi-hype-velocity')
    expect(velCard).toHaveTextContent('+8.5 pts/hr')

    const engCard = screen.getByTestId('hero-kpi-submission-engagement')
    expect(engCard).toHaveTextContent('+35 pts')
    expect(engCard).toHaveTextContent('60 upvotes · 15 comments')

    const provCard = screen.getByTestId('hero-kpi-provenance-summary')
    expect(provCard).toHaveTextContent('2 Linked Posts')
  })

  it('renders Physical Specification card with parent album link, variant chip, retailer, and dates', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('card-physical-specs')).toBeInTheDocument()
    })

    const specsCard = screen.getByTestId('card-physical-specs')
    expect(specsCard).toHaveTextContent('The Smashing Pumpkins')
    expect(specsCard).toHaveTextContent('View Album (3 Releases) →')
    expect(specsCard).toHaveTextContent('Opaque Purple Vinyl')
    expect(specsCard).toHaveTextContent('Rough Trade')
  })

  it('renders Stepped Snapshot chart with LOCF curve', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('chart-stepped-locf')).toBeInTheDocument()
    })

    const chart = screen.getByTestId('chart-stepped-locf')
    expect(chart).toHaveTextContent(/Stepped Engagement Curve/i)
    expect(chart).toHaveTextContent('24 Buckets · LOCF Sampling')
  })

  it('renders Reddit Submission Provenance table with 6 columns, badges, metrics, and external Reddit link', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('table-reddit-provenance')).toBeInTheDocument()
    })

    expect(screen.getByText('t3_1xjjfem')).toBeInTheDocument()
    expect(screen.getByText('The Smashing Pumpkins - Lull (Opaque Purple Vinyl)')).toBeInTheDocument()
    expect(screen.getByText('60 pts')).toBeInTheDocument()
    expect(screen.getByText('(95% upvoted)')).toBeInTheDocument()
    expect(screen.getByText('15 comments')).toBeInTheDocument()
    expect(screen.getByText('+5.5 pts/hr')).toBeInTheDocument()

    const redditLinks = screen.getAllByRole('link', { name: /Reddit ↗/i })
    expect(redditLinks).toHaveLength(2)
    expect(redditLinks[0]).toHaveAttribute('href', 'https://www.reddit.com/comments/1xjjfem')
    expect(redditLinks[0]).toHaveAttribute('target', '_blank')
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
      expect(screen.getByText('Lull — Opaque Purple Vinyl')).toBeInTheDocument()
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
