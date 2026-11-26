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

  it('renders loading skeleton with circular monogram and 3-card hero KPI skeleton when fetching', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderComponent()

    const loading = screen.getByTestId('screen-artist-detail-loading')
    expect(loading).toBeInTheDocument()
    expect(within(loading).getByTestId('masthead-monogram-skeleton')).toHaveClass('rounded-full')
    expect(within(loading).getAllByTestId('hero-kpi-skeleton-card')).toHaveLength(3)
  })

  it('renders ARTIST editorial super-header, circular portrait monogram, artist name, discography summary, and Last Seen', async () => {
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

    const superHeader = screen.getByTestId('entity-super-header')
    expect(superHeader).toHaveTextContent('ARTIST')
    expect(superHeader).toHaveClass('border-b-[3px]')
    expect(superHeader.textContent).not.toContain('/')
    expect(superHeader.textContent).not.toMatch(/Discography/i)

    expect(screen.getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')

    const masthead = screen.getByTestId('entity-masthead')
    expect(within(masthead).getByTestId('vinyl-monogram')).toHaveClass('rounded-full')
    expect(within(masthead).getByText('2 Albums · 4 Pressings')).toBeInTheDocument()
    expect(within(masthead).getByText(/LAST SEEN:/i)).toBeInTheDocument()
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Artist Discography/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Back to Directory/i)).toBeInTheDocument()
  })

  it('renders 3-card hero KPI strip with Hype Index, Engagement, and Discography', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('hero-kpi-hype-index')).toBeInTheDocument()
    })

    const kpiStrip = screen.getByTestId('hero-kpi-strip')
    expect(kpiStrip.children).toHaveLength(3)

    const hypeCard = screen.getByTestId('hero-kpi-hype-index')
    expect(hypeCard).toHaveTextContent('88')
    expect(hypeCard).toHaveTextContent(/HIGH/i)

    const engagementCard = screen.getByTestId('hero-kpi-engagement')
    expect(engagementCard).toHaveTextContent('Engagement')
    expect(engagementCard).toHaveTextContent('220 votes')
    expect(engagementCard).toHaveTextContent('45 comments · 5 mentions')

    const discographyCard = screen.getByTestId('hero-kpi-discography')
    expect(discographyCard).toHaveTextContent('Discography')
    expect(discographyCard).toHaveTextContent('2 Albums')
    expect(discographyCard).toHaveTextContent('1 Solo · 1 Collaboration · 4 Pressings')

    expect(screen.queryByTestId('hero-kpi-hype-velocity')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-catalog-footprint')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-kpi-reddit-demand')).not.toBeInTheDocument()
  })

  it('renders 6-column Albums table with Credit (Solo / Collaboration), Pressings, Engagement, and View Album links', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent('/artists/art-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-albums')).toBeInTheDocument()
    })

    const tableCard = screen.getByTestId('table-albums')
    expect(within(tableCard).getByText('Albums')).toBeInTheDocument()
    expect(within(tableCard).getByText('2 Albums')).toBeInTheDocument()

    const headers = within(tableCard)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim())
    expect(headers).toEqual(['Album', 'Credit', 'Pressings', 'Engagement', 'Hype Index', 'Action'])

    expect(within(tableCard).getByText('Siamese Dream')).toBeInTheDocument()
    expect(within(tableCard).getByText('Judas O')).toBeInTheDocument()
    // Combined artist credit string clearly shown under album title
    expect(within(tableCard).getByText('The Smashing Pumpkins / Various')).toBeInTheDocument()

    // Solo badge vs Collaboration badge (no raw "Combined:")
    expect(within(tableCard).getByText('Solo')).toBeInTheDocument()
    expect(within(tableCard).getByText('Collaboration')).toBeInTheDocument()
    expect(tableCard).not.toHaveTextContent(/Combined:/i)

    expect(within(tableCard).getByText('3 Pressings')).toBeInTheDocument()
    expect(within(tableCard).getByText('1 Pressing')).toBeInTheDocument()
    expect(within(tableCard).getByText('3 mentions · 160 votes · 30 comments')).toBeInTheDocument()
    expect(within(tableCard).getByText('2 mentions · 60 votes · 15 comments')).toBeInTheDocument()
    expect(tableCard).not.toHaveTextContent(/Hype Velocity|pts\/hr|Indexed Titles|Derived albums/i)

    const viewAlbumLinks = within(tableCard).getAllByRole('link', { name: /View Album →/i })
    expect(viewAlbumLinks).toHaveLength(2)
    expect(viewAlbumLinks[0]).toHaveAttribute('href', '/albums/alb-1?window=24H')
    expect(viewAlbumLinks[1]).toHaveAttribute('href', '/albums/alb-2?window=24H')
  })

  it('renders 6-column All Pressings table with Album, Variant, Retailer, Engagement, Hype Index, and View Release links', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent('/artists/art-test-123?window=24H')

    await waitFor(() => {
      expect(screen.getByTestId('table-all-pressings')).toBeInTheDocument()
    })

    const tableCard = screen.getByTestId('table-all-pressings')
    expect(within(tableCard).getByText('All Pressings')).toBeInTheDocument()
    expect(within(tableCard).getByText('3 Pressings')).toBeInTheDocument()

    const headers = within(tableCard)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim())
    expect(headers).toEqual(['Album', 'Variant', 'Retailer', 'Engagement', 'Hype Index', 'Action'])

    expect(within(tableCard).getByText('2LP Purple Marbled')).toBeInTheDocument()
    expect(within(tableCard).getByText('Standard Pressing')).toBeInTheDocument() // fallback for null variant
    expect(within(tableCard).getByText('Wide / Unspecified')).toBeInTheDocument() // fallback for null retailer
    expect(within(tableCard).getByText('2 mentions · 110 votes · 20 comments')).toBeInTheDocument()
    expect(within(tableCard).getByText('1 mention · 50 votes · 10 comments')).toBeInTheDocument()
    expect(tableCard).not.toHaveTextContent(/Hype Velocity|pts\/hr|Child Releases|Parent Album/i)

    const viewReleaseLinks = within(tableCard).getAllByRole('link', { name: /View Release →/i })
    expect(viewReleaseLinks).toHaveLength(3)
    expect(viewReleaseLinks[0]).toHaveAttribute('href', '/releases/rel-1?window=24H')
  })

  it('renders plain-English empty states when an artist has no albums or pressings', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockArtistResponse24H,
        hero_kpi: {
          ...mockArtistResponse24H.hero_kpi,
          total_albums: 0,
          solo_album_count: 0,
          combined_album_count: 0,
          total_releases: 0,
          catalog_footprint: {
            total_albums: 0,
            solo_album_count: 0,
            combined_album_count: 0,
            total_releases: 0,
          },
        },
        tracked_albums: [],
        child_releases: [],
      }),
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('table-albums')).toBeInTheDocument()
    })

    expect(screen.getByText('No albums recorded for this artist.')).toBeInTheDocument()
    expect(screen.getByText('No pressings recorded for this artist.')).toBeInTheDocument()
  })

  it('renders zero banned jargon strings across the entire Artist Detail screen', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse24H,
    } as Response)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('screen-artist-detail')).toBeInTheDocument()
    })

    const fullText = screen.getByTestId('screen-artist-detail').textContent || ''
    const bannedPatterns = [
      /\bReddit\b/i,
      /r\/vinylreleases/i,
      /pts\/hr/i,
      /\bHype Velocity\b/i,
      /ID:/i,
      /Reddit Demand/i,
      /Catalog Footprint/i,
      /Billing Attribution/i,
      /Tracked Albums Matrix/i,
      /Derived albums catalog/i,
      /Indexed Titles/i,
      /Child Releases/i,
      /\bSubmission\b/i,
      /\bSubmissions\b/i,
      /Combined:/i,
      /\bupvotes\b/i,
    ]
    for (const pattern of bannedPatterns) {
      expect(fullText).not.toMatch(pattern)
    }
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
