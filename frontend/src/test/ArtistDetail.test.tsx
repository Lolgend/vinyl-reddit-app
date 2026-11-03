import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArtistDetail } from '../pages/ArtistDetail'

const mockArtistResponse24H = {
  artist_id: 'art-test-123',
  name: 'The Smashing Pumpkins',
  monogram_key: 'art-test-123',
  last_seen_at: '2026-10-31T15:00:00Z',
  window: '24H',
  artist: {
    artist_id: 'art-test-123',
    name: 'The Smashing Pumpkins',
    monogram_key: 'art-test-123',
    last_seen_at: '2026-10-31T15:00:00Z',
  },
  hero_kpi: {
    hype_index: 88,
    tier: 'high',
    hype_velocity: 14.5,
    catalog_footprint: {
      total_albums: 2,
      solo_album_count: 1,
      combined_album_count: 1,
      total_releases: 4,
    },
    reddit_demand: {
      total_submissions: 5,
      submission_count: 5,
      total_score: 220,
      total_comments: 45,
      points_gain: 85,
      last_seen: '2026-10-31T15:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
    },
    total_albums: 2,
    solo_album_count: 1,
    combined_album_count: 1,
    total_releases: 4,
    submission_count: 5,
    total_score: 220,
    total_comments: 45,
    points_gain: 85,
    last_seen_at: '2026-10-31T15:00:00Z',
  },
  tracked_albums: [
    {
      album_id: 'alb-1',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      billing_attribution: 'Solo',
      release_count: 3,
      submission_count: 3,
      score: 160,
      num_comments: 30,
      hype_velocity: 9.5,
      hype_index: 85,
      tier: 'high',
      first_seen_at: '2026-10-30T10:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
    },
    {
      album_id: 'alb-2',
      album_title: 'Judas O',
      combined_artist: 'The Smashing Pumpkins / Various',
      billing_attribution: 'Combined: The Smashing Pumpkins / Various',
      release_count: 1,
      submission_count: 2,
      score: 60,
      num_comments: 15,
      hype_velocity: 5.0,
      hype_index: 60,
      tier: 'moderate',
      first_seen_at: '2026-10-31T08:00:00Z',
      last_seen_at: '2026-10-31T12:00:00Z',
    },
  ],
  child_releases: [
    {
      release_id: 'rel-1',
      album_id: 'alb-1',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      variant: '2LP Purple Marbled',
      retailer_name: 'Rough Trade',
      submission_count: 2,
      score: 110,
      num_comments: 20,
      hype_velocity: 6.5,
      hype_index: 80,
      tier: 'high',
      first_seen_at: '2026-10-30T10:00:00Z',
      last_seen_at: '2026-10-31T15:00:00Z',
    },
    {
      release_id: 'rel-2',
      album_id: 'alb-1',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      variant: null,
      retailer_name: null,
      submission_count: 1,
      score: 50,
      num_comments: 10,
      hype_velocity: 3.0,
      hype_index: 55,
      tier: 'moderate',
      first_seen_at: '2026-10-30T12:00:00Z',
      last_seen_at: '2026-10-31T09:00:00Z',
    },
    {
      release_id: 'rel-3',
      album_id: 'alb-2',
      album_title: 'Judas O',
      combined_artist: 'The Smashing Pumpkins / Various',
      variant: 'Standard Black',
      retailer_name: 'Wide',
      submission_count: 2,
      score: 60,
      num_comments: 15,
      hype_velocity: 5.0,
      hype_index: 60,
      tier: 'moderate',
      first_seen_at: '2026-10-31T08:00:00Z',
      last_seen_at: '2026-10-31T12:00:00Z',
    },
  ],
}

const mockArtistResponse7D = {
  ...mockArtistResponse24H,
  window: '7D',
}

function renderComponent(initialRoute = '/artists/art-test-123') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/artists/:artistId" element={<ArtistDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ArtistDetail Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading skeleton when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    expect(screen.getByTestId('screen-artist-detail-loading')).toBeInTheDocument()
  })

  it('renders header, artist name, and Last Seen provenance chip', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'The Smashing Pumpkins' })
      ).toBeInTheDocument()
    })

    expect(screen.getByText(/Artist Discography · ID: art-test/i)).toBeInTheDocument()
    expect(screen.getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Directory/i)).toBeInTheDocument()
  })

  it('renders 4-cell hero KPI strip with correct metrics, index, velocity, catalog footprint, reddit demand', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const hypeCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeCard).toHaveTextContent('88')
    expect(hypeCard).toHaveTextContent(/HIGH/i)

    const velCard = screen.getByTestId('hero-kpi-hype-velocity')
    expect(velCard).toHaveTextContent('+14.5 pts/hr')

    const footprintCard = screen.getByTestId('hero-kpi-catalog-footprint')
    expect(footprintCard).toHaveTextContent('2 Albums')
    expect(footprintCard).toHaveTextContent('1 Solo · 1 Combined · 4 Pressings')

    const demandCard = screen.getByTestId('hero-kpi-reddit-demand')
    expect(demandCard).toHaveTextContent('+85 pts')
    expect(demandCard).toHaveTextContent('5 Submissions · 220 upvotes · 45 comments')
  })

  it('renders Tracked Albums matrix with 7 columns, Solo and Combined badges, and View Album links with window query', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent('/artists/art-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-tracked-albums')).toBeInTheDocument()
    })

    const table = screen.getByTestId('table-tracked-albums')
    expect(within(table).getByText('Siamese Dream')).toBeInTheDocument()
    expect(within(table).getByText('Judas O')).toBeInTheDocument()

    // Solo badge vs Combined badge
    expect(within(table).getByText('Solo')).toBeInTheDocument()
    expect(
      within(table).getByText('Combined: The Smashing Pumpkins / Various')
    ).toBeInTheDocument()

    const viewAlbumLinks = within(table).getAllByRole('link', { name: /View Album →/i })
    expect(viewAlbumLinks).toHaveLength(2)
    expect(viewAlbumLinks[0]).toHaveAttribute('href', '/albums/alb-1?window=24H')
    expect(viewAlbumLinks[1]).toHaveAttribute('href', '/albums/alb-2?window=24H')
  })

  it('renders Child Releases discography ledger with 7 columns, variants, retailers, and View Release links with window query', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent('/artists/art-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-child-releases')).toBeInTheDocument()
    })

    expect(screen.getByText(/All physical variants across/i)).toBeInTheDocument()

    const table = screen.getByTestId('table-child-releases')
    expect(within(table).getByText('2LP Purple Marbled')).toBeInTheDocument()
    expect(within(table).getByText('Standard Pressing')).toBeInTheDocument() // fallback for null variant
    expect(within(table).getByText('Wide / Unspecified')).toBeInTheDocument() // fallback for null retailer

    const viewReleaseLinks = within(table).getAllByRole('link', { name: /View Release →/i })
    expect(viewReleaseLinks).toHaveLength(3)
    expect(viewReleaseLinks[0]).toHaveAttribute('href', '/releases/rel-1?window=24H')
  })

  it('switches window from 24H to 7D updating fetch query', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArtistResponse24H,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArtistResponse7D,
      } as Response)

    renderComponent('/artists/art-test-123?window=24H')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'The Smashing Pumpkins' })
      ).toBeInTheDocument()
    })

    const btn7D = screen.getByRole('button', { name: '7D' })
    fireEvent.click(btn7D)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/artists/art-test-123?window=7D')
    })
  })

  it('renders error banner with retry button on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('artist-detail-error')).toBeInTheDocument()
    })

    expect(screen.getByText(/Failed to load artist discography/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
