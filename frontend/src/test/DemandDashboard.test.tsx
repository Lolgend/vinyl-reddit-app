import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DemandDashboard } from '../pages/DemandDashboard'

const mock24hDashboard = {
  window: '24H',
  top_albums: [
    {
      album_id: 'alb-1',
      album_title: 'In Rainbows',
      combined_artist: 'Radiohead',
      hype_index: 92,
      hype_velocity: 14.5,
      tier: 'high',
      release_count: 3,
      submission_count: 7,
      monogram_key: 'alb-1',
    },
    {
      album_id: 'alb-2',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      hype_index: 78,
      hype_velocity: 8.2,
      tier: 'high',
      release_count: 2,
      submission_count: 4,
      monogram_key: 'alb-2',
    },
  ],
  top_releases: [
    {
      release_id: 'rel-1',
      album_id: 'alb-1',
      album_title: 'In Rainbows',
      combined_artist: 'Radiohead',
      variant: 'Limited Edition Yellow',
      retailer_name: 'Rough Trade',
      hype_index: 92,
      hype_velocity: 14.5,
      tier: 'high',
      monogram_key: 'rel-1',
    },
    {
      release_id: 'rel-2',
      album_id: 'alb-2',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      variant: null,
      retailer_name: null,
      hype_index: 65,
      hype_velocity: 5.1,
      tier: 'moderate',
      monogram_key: 'rel-2',
    },
  ],
  newly_added: [
    {
      release_id: 'rel-new-1',
      album_id: 'alb-3',
      album_title: 'Loveless',
      combined_artist: 'My Bloody Valentine',
      variant: 'Standard Black',
      retailer_name: 'Domino',
      hype_index: 80,
      hype_velocity: 12.0,
      tier: 'high',
      latest_score: 95,
      monogram_key: 'rel-new-1',
      first_seen_at: new Date().toISOString(),
    },
  ],
  live_feed: [
    {
      release_id: 'rel-1',
      album_id: 'alb-1',
      album_title: 'In Rainbows',
      combined_artist: 'Radiohead',
      variant: 'Limited Edition Yellow',
      retailer_name: 'Rough Trade',
      hype_index: 92,
      hype_velocity: 14.5,
      tier: 'high',
      score: 150,
      num_comments: 42,
      posted_at: new Date(Date.now() - 3600000).toISOString(),
      monogram_key: 'rel-1',
    },
    {
      release_id: 'rel-2',
      album_id: 'alb-2',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      variant: null,
      retailer_name: null,
      hype_index: 65,
      hype_velocity: 5.1,
      tier: 'moderate',
      score: 80,
      num_comments: 18,
      posted_at: new Date(Date.now() - 7200000).toISOString(),
      monogram_key: 'rel-2',
    },
    {
      release_id: 'rel-3',
      album_id: 'alb-4',
      album_title: 'Doolittle',
      combined_artist: 'Pixies',
      variant: 'Green Marbled',
      retailer_name: '4AD',
      hype_index: 30,
      hype_velocity: 0.8,
      tier: 'low',
      score: 25,
      num_comments: 4,
      posted_at: new Date(Date.now() - 14400000).toISOString(),
      monogram_key: 'rel-3',
    },
  ],
}

const mock7dDashboard = {
  ...mock24hDashboard,
  window: '7D',
  top_albums: [
    {
      album_id: 'alb-7d-1',
      album_title: 'OK Computer',
      combined_artist: 'Radiohead',
      hype_index: 95,
      hype_velocity: 22.0,
      tier: 'high',
      release_count: 4,
      submission_count: 9,
      monogram_key: 'alb-7d-1',
    },
  ],
  top_releases: [
    {
      release_id: 'rel-7d-1',
      album_id: 'alb-7d-2',
      album_title: 'Dummy',
      combined_artist: 'Portishead',
      variant: '180g Reissue',
      retailer_name: 'Rough Trade',
      hype_index: 88,
      hype_velocity: 11.4,
      tier: 'high',
      monogram_key: 'rel-7d-1',
    },
  ],
}

const mock1mDashboard = {
  ...mock24hDashboard,
  window: '1M',
  top_albums: [
    {
      album_id: 'alb-1m-1',
      album_title: 'Kid A',
      combined_artist: 'Radiohead',
      hype_index: 90,
      hype_velocity: 18.0,
      tier: 'high',
      release_count: 2,
      submission_count: 6,
      monogram_key: 'alb-1m-1',
    },
  ],
  top_releases: [
    {
      release_id: 'rel-1m-1',
      album_id: 'alb-1m-1',
      album_title: 'Kid A',
      combined_artist: 'Radiohead',
      variant: 'Cream Double LP',
      retailer_name: 'XL Recordings',
      hype_index: 91,
      hype_velocity: 16.2,
      tier: 'high',
      monogram_key: 'rel-1m-1',
    },
  ],
}

describe('DemandDashboard Page', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('window=7D')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mock7dDashboard),
          })
        }
        if (url.includes('window=1M')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mock1mDashboard),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mock24hDashboard),
        })
      })
    )
  })

  function renderDashboard(initialEntries = ['/']) {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/" element={<DemandDashboard />} />
            <Route path="/albums/:albumId" element={<div>Album Detail Screen</div>} />
            <Route path="/releases/:releaseId" element={<div>Release Detail Screen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders the 3 leaderboard cards and live feed', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByText('Top Albums')).toBeDefined()
    expect(screen.getByText('Top Releases')).toBeDefined()
    expect(screen.getByText('Newly Added Releases')).toBeDefined()
    expect(screen.getByText('Live Release Feed')).toBeDefined()
    expect(screen.getByText(/7 Submissions/i)).toBeInTheDocument()
    expect(screen.getByText(/95 pts/i)).toBeInTheDocument()
  })

  it('uses adaptive xl 3-column grid, consolidated h2 headings, and complete leaderboard attribution', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Radiohead — In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    // Adaptive grid: 1 column below 1280px (xl), 3 columns at 1280px+
    const albumCard = screen.getByTestId('card-top-albums')
    const releaseCard = screen.getByTestId('card-top-releases')
    const newlyCard = screen.getByTestId('card-newly-added')
    expect(albumCard.parentElement).toHaveClass('grid', 'grid-cols-1', 'xl:grid-cols-3', 'gap-5')
    expect(albumCard.parentElement).not.toHaveClass('md:grid-cols-3')

    // Consolidated single <h2> heading per leaderboard card without redundant secondary headings
    expect(within(albumCard).getByRole('heading', { level: 2, name: 'Top Albums' })).toBeInTheDocument()
    expect(within(releaseCard).getByRole('heading', { level: 2, name: 'Top Releases' })).toBeInTheDocument()
    expect(
      within(newlyCard).getByRole('heading', { level: 2, name: 'Newly Added Releases' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Top 5 Albums')).not.toBeInTheDocument()
    expect(screen.queryByText('Top 5 Pressings')).not.toBeInTheDocument()
    expect(screen.queryByText('Last 24 Hours')).not.toBeInTheDocument()

    // Top Albums attribution: Line 1 Combined Artist — Album, Line 2 Submissions · Releases
    expect(within(albumCard).getByRole('link', { name: 'Radiohead — In Rainbows' })).toBeInTheDocument()
    expect(within(albumCard).getByText('7 Submissions · 3 Releases')).toBeInTheDocument()
    expect(
      within(albumCard).getByRole('link', { name: 'The Smashing Pumpkins — Siamese Dream' })
    ).toBeInTheDocument()
    expect(within(albumCard).getByText('4 Submissions · 2 Releases')).toBeInTheDocument()

    // Top Releases attribution: Line 1 Combined Artist — Album, Line 2 Variant · Retailer with fallbacks
    expect(within(releaseCard).getByRole('link', { name: 'Radiohead — In Rainbows' })).toBeInTheDocument()
    expect(within(releaseCard).getByText('Limited Edition Yellow · Rough Trade')).toBeInTheDocument()
    expect(
      within(releaseCard).getByRole('link', { name: 'The Smashing Pumpkins — Siamese Dream' })
    ).toBeInTheDocument()
    expect(within(releaseCard).getByText('Standard Pressing · Wide / Unspecified')).toBeInTheDocument()

    // Newly Added Releases attribution: Line 1 Combined Artist — Album, Line 2 Variant · Retailer + velocity/score
    expect(
      within(newlyCard).getByRole('link', { name: 'My Bloody Valentine — Loveless' })
    ).toBeInTheDocument()
    expect(within(newlyCard).getByText('Standard Black · Domino')).toBeInTheDocument()
    expect(within(newlyCard).getByText('+12 pts/hr · 95 pts')).toBeInTheDocument()
  })

  it('renders uniform 5 rows with window-aware dashed placeholders across all 3 leaderboard cards', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    // top_albums has 2 items -> 3 empty slot rows
    const albumEmptySlots = screen.getAllByTestId('empty-slot-album')
    expect(albumEmptySlots).toHaveLength(3)
    for (const slot of albumEmptySlots) {
      expect(slot).toHaveTextContent('No additional active items in 24H window — switch to 7D or 1M')
    }

    // top_releases has 2 items -> 3 empty slot rows
    const releaseEmptySlots = screen.getAllByTestId('empty-slot-release')
    expect(releaseEmptySlots).toHaveLength(3)
    for (const slot of releaseEmptySlots) {
      expect(slot).toHaveTextContent('No additional active items in 24H window — switch to 7D or 1M')
    }

    // newly_added has 1 item -> 4 empty slot rows (always 24H)
    const newlyEmptySlots = screen.getAllByTestId('empty-slot-newly-added')
    expect(newlyEmptySlots).toHaveLength(4)
    for (const slot of newlyEmptySlots) {
      expect(slot).toHaveTextContent('No additional active items in 24H window — switch to 7D or 1M')
    }

    // Switch Top Albums to 7D (mock7dDashboard has 1 album -> 4 empty slots showing 7D)
    const albumCard = screen.getByTestId('card-top-albums')
    fireEvent.click(within(albumCard).getByRole('button', { name: '7D' }))

    await waitFor(() => {
      expect(screen.getAllByTestId('empty-slot-album')).toHaveLength(4)
    })
    for (const slot of screen.getAllByTestId('empty-slot-album')) {
      expect(slot).toHaveTextContent('No additional active items in 7D window — switch to 7D or 1M')
    }
    for (const slot of screen.getAllByTestId('empty-slot-newly-added')) {
      expect(slot).toHaveTextContent('No additional active items in 24H window — switch to 7D or 1M')
    }
  })

  it('allows independent window switching for Top Albums', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    // Find the 7D toggle button specifically inside Top Albums
    const albumCard = screen.getByTestId('card-top-albums')
    const btn7d = albumCard.querySelector('button[data-window="7D"]')
    expect(btn7d).toBeDefined()
    if (btn7d) {
      fireEvent.click(btn7d)
    }

    await waitFor(() => {
      expect(screen.getByText('Radiohead — OK Computer')).toBeDefined()
    })
  })

  it('decouples Top Albums and Top Releases window switchers while still syncing external URL changes', async () => {
    const RouterShell = () => {
      const location = useLocation()
      return (
        <>
          <div data-testid="current-search">{location.search}</div>
          <Link to="/?window=24H">External Reset 24H</Link>
          <DemandDashboard />
        </>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RouterShell />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Radiohead — In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    const albumCard = screen.getByTestId('card-top-albums')
    const releaseCard = screen.getByTestId('card-top-releases')

    // 1. Switch Top Albums to 7D -> URL becomes ?window=7D, Top Releases stays 24H
    fireEvent.click(within(albumCard).getByRole('button', { name: '7D' }))

    await waitFor(() => {
      expect(within(albumCard).getByText('Radiohead — OK Computer')).toBeInTheDocument()
    })
    expect(screen.getByTestId('current-search')).toHaveTextContent('?window=7D')
    expect(within(albumCard).getByRole('button', { name: '7D' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(releaseCard).getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(releaseCard).getByRole('button', { name: '7D' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(releaseCard).getByRole('link', { name: 'Radiohead — In Rainbows' })).toHaveAttribute(
      'href',
      '/releases/rel-1?window=24H'
    )

    // 2. Switch Top Releases to 1M -> URL becomes ?window=1M, Top Albums stays 7D
    fireEvent.click(within(releaseCard).getByRole('button', { name: '1M' }))

    await waitFor(() => {
      expect(within(releaseCard).getByText('Radiohead — Kid A')).toBeInTheDocument()
    })
    expect(screen.getByTestId('current-search')).toHaveTextContent('?window=1M')
    expect(within(releaseCard).getByRole('button', { name: '1M' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(releaseCard).getByRole('link', { name: 'Radiohead — Kid A' })).toHaveAttribute(
      'href',
      '/releases/rel-1m-1?window=1M'
    )
    expect(within(albumCard).getByRole('button', { name: '7D' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(albumCard).getByText('Radiohead — OK Computer')).toBeInTheDocument()

    // 3. External URL navigation resets both Top Albums and Top Releases to the URL window
    fireEvent.click(screen.getByRole('link', { name: 'External Reset 24H' }))

    await waitFor(() => {
      expect(within(albumCard).getByText('Radiohead — In Rainbows')).toBeInTheDocument()
      expect(within(releaseCard).getByText('Radiohead — In Rainbows')).toBeInTheDocument()
    })
    expect(within(albumCard).getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(releaseCard).getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('pins Newly Added Releases and Live Release Feed to fixed 24H cohort without skeleton flash on leaderboard switch', async () => {
    let resolve7d!: (value: unknown) => void
    let resolve1m!: (value: unknown) => void
    const pending7d = new Promise((resolve) => {
      resolve7d = resolve
    })
    const pending1m = new Promise((resolve) => {
      resolve1m = resolve
    })

    const modified7dPayload = {
      ...mock7dDashboard,
      newly_added: [
        {
          release_id: 'rel-7d-new',
          album_id: 'alb-7d-new',
          album_title: '7D Should Not Appear',
          combined_artist: 'Wrong Cohort',
          variant: '7D Variant',
          retailer_name: '7D Store',
          hype_index: 50,
          hype_velocity: 3.0,
          tier: 'moderate',
          latest_score: 10,
          monogram_key: 'rel-7d-new',
          first_seen_at: new Date().toISOString(),
        },
      ],
      live_feed: [
        {
          release_id: 'rel-7d-feed',
          album_id: 'alb-7d-feed',
          album_title: '7D Feed Should Not Appear',
          combined_artist: 'Wrong Cohort',
          variant: '7D Variant',
          retailer_name: '7D Store',
          hype_index: 50,
          hype_velocity: 3.0,
          tier: 'moderate',
          score: 10,
          num_comments: 2,
          posted_at: new Date().toISOString(),
          monogram_key: 'rel-7d-feed',
        },
      ],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('window=7D')) {
          return pending7d
        }
        if (url.includes('window=1M')) {
          return pending1m
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mock24hDashboard),
        })
      })
    )

    renderDashboard()

    const albumCard = screen.getByTestId('card-top-albums')
    const releaseCard = screen.getByTestId('card-top-releases')
    const newlyCard = screen.getByTestId('card-newly-added')

    await waitFor(() => {
      expect(within(newlyCard).getByText('My Bloody Valentine — Loveless')).toBeInTheDocument()
    })
    const feedTable = screen.getByRole('table')
    expect(within(feedTable).getByText('Doolittle')).toBeInTheDocument()

    // Switch Top Albums to 7D while request is pending
    fireEvent.click(within(albumCard).getByRole('button', { name: '7D' }))

    await waitFor(() => {
      expect(within(albumCard).getAllByTestId('album-skeleton-row')).toHaveLength(5)
    })
    // Newly Added Releases and Live Release Feed must NOT flash skeletons
    expect(screen.queryAllByTestId('newly-added-skeleton-row')).toHaveLength(0)
    expect(screen.queryAllByTestId('feed-skeleton-row')).toHaveLength(0)
    expect(within(newlyCard).getByText('My Bloody Valentine — Loveless')).toBeInTheDocument()
    expect(within(feedTable).getByText('Doolittle')).toBeInTheDocument()

    // Resolve 7D fetch with different newly_added/live_feed -> 24H cohort remains intact
    resolve7d({
      ok: true,
      json: () => Promise.resolve(modified7dPayload),
    })

    await waitFor(() => {
      expect(within(albumCard).getByText('Radiohead — OK Computer')).toBeInTheDocument()
    })
    expect(within(newlyCard).getByText('My Bloody Valentine — Loveless')).toBeInTheDocument()
    expect(screen.queryByText(/7D Should Not Appear/i)).not.toBeInTheDocument()
    expect(within(feedTable).getByText('Doolittle')).toBeInTheDocument()
    expect(screen.queryByText(/7D Feed Should Not Appear/i)).not.toBeInTheDocument()

    // Feed detail links stay pinned to ?window=24H even when albumWindow is 7D
    expect(within(feedTable).getByRole('link', { name: 'In Rainbows' })).toHaveAttribute(
      'href',
      '/albums/alb-1?window=24H'
    )
    const viewLinks = within(feedTable).getAllByRole('link', { name: /view/i })
    expect(viewLinks[0]).toHaveAttribute('href', '/releases/rel-1?window=24H')

    // Switch Top Releases to 1M while pending -> only Top Releases shows skeletons
    fireEvent.click(within(releaseCard).getByRole('button', { name: '1M' }))

    await waitFor(() => {
      expect(within(releaseCard).getAllByTestId('release-skeleton-row')).toHaveLength(5)
    })
    expect(screen.queryAllByTestId('newly-added-skeleton-row')).toHaveLength(0)
    expect(screen.queryAllByTestId('feed-skeleton-row')).toHaveLength(0)

    resolve1m({
      ok: true,
      json: () => Promise.resolve(mock1mDashboard),
    })

    await waitFor(() => {
      expect(within(releaseCard).getByText('Radiohead — Kid A')).toBeInTheDocument()
    })
    expect(within(newlyCard).getByText('My Bloody Valentine — Loveless')).toBeInTheDocument()
  })

  it('renders fallbacks for null variant and retailer in Live Release Feed', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Siamese Dream').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Standard Pressing').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Wide / Unspecified').length).toBeGreaterThanOrEqual(1)
  })

  it('filters Live Release Feed with text search query', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    const filterInput = screen.getByPlaceholderText(/filter feed/i)
    fireEvent.change(filterInput, { target: { value: 'Doolittle' } })

    const feedTable = screen.getByRole('table')
    expect(within(feedTable).getByText('Doolittle')).toBeDefined()
    expect(within(feedTable).queryByText('In Rainbows')).toBeNull()
  })

  it('filters Live Release Feed by tier pill', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    // Click 'Low' tier pill
    const lowPill = screen.getByRole('button', { name: /^low$/i })
    fireEvent.click(lowPill)

    const feedTable = screen.getByRole('table')
    expect(within(feedTable).getByText('Doolittle')).toBeDefined()
    expect(within(feedTable).queryByText('In Rainbows')).toBeNull()
  })

  it('sorts Live Release Feed by Hype Velocity', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    const sortSelect = screen.getByTestId('feed-sort-select')
    fireEvent.change(sortSelect, { target: { value: 'velocity' } })

    const rows = screen.getAllByTestId('feed-table-row')
    expect(rows.length).toBe(3)
    // First row should be In Rainbows (+14.5 pts/hr)
    expect(rows[0].textContent).toContain('In Rainbows')
  })

  it('navigates to album and release detail preserving window parameter', async () => {
    renderDashboard(['/?window=7D'])

    await waitFor(() => {
      expect(screen.getByText('Radiohead — OK Computer')).toBeInTheDocument()
    })

    // In Top Albums card, check link href
    const albumCard = screen.getByTestId('card-top-albums')
    const albumLink = within(albumCard).getByRole('link', { name: /radiohead — ok computer/i })
    expect(albumLink).toHaveAttribute('href', '/albums/alb-7d-1?window=7D')

    // Click album link
    fireEvent.click(albumLink)

    await waitFor(() => {
      expect(screen.getByText('Album Detail Screen')).toBeDefined()
    })
  })

  it('renders brutalist empty state with active filter pills and resets filters', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    const filterInput = screen.getByPlaceholderText(/filter feed/i)
    fireEvent.change(filterInput, { target: { value: 'NonexistentVinylTitle123' } })

    await waitFor(() => {
      expect(screen.getByTestId('feed-empty-state')).toBeInTheDocument()
      expect(screen.getByText('0 MATCHING RECORDS')).toBeInTheDocument()
      expect(screen.getByText(/Query: "NonexistentVinylTitle123"/i)).toBeInTheDocument()
    })

    const resetBtn = screen.getByTestId('reset-filters-btn')
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('feed-empty-state')).not.toBeInTheDocument()
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders Coral Alert banner with role="alert" and retries failed queries including fixed 24H cohort', async () => {
    let fail24h = true
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('window=24H') && fail24h) {
          return Promise.reject(new Error('24H Network failure'))
        }
        if (url.includes('window=7D')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mock7dDashboard),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mock24hDashboard),
        })
      })
    )

    renderDashboard(['/?window=7D'])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    const banner = screen.getByTestId('dashboard-error-banner')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(banner).toHaveClass('bg-alert-coral', 'border-strong')
    expect(screen.getByText(/Failed to load demand intelligence/i)).toBeInTheDocument()

    const retryBtn = screen.getByTestId('dashboard-retry-btn')
    expect(retryBtn).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary'
    )

    fail24h = false
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('My Bloody Valentine — Loveless')).toBeInTheDocument()
    })
  })

  it('styles leaderboard Hype Window pills for WCAG target size, inactive contrast, and focus-visible outlines', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Radiohead — In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    for (const cardTestId of ['card-top-albums', 'card-top-releases']) {
      const card = screen.getByTestId(cardTestId)
      const btn24h = within(card).getByRole('button', { name: '24H' })
      const btn7d = within(card).getByRole('button', { name: '7D' })
      const btn1m = within(card).getByRole('button', { name: '1M' })

      expect(btn24h.parentElement).toHaveClass('gap-1', 'p-1', 'bg-canvas', 'rounded-full', 'border-strong')
      expect(btn24h).toHaveAttribute('type', 'button')
      expect(btn24h).toHaveAttribute('aria-pressed', 'true')
      expect(btn24h).toHaveClass(
        'min-h-[26px]',
        'min-w-[32px]',
        'border-strong',
        'bg-ink-primary',
        'text-white',
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-accent-primary'
      )

      for (const inactiveBtn of [btn7d, btn1m]) {
        expect(inactiveBtn).toHaveAttribute('type', 'button')
        expect(inactiveBtn).toHaveAttribute('aria-pressed', 'false')
        expect(inactiveBtn).toHaveClass(
          'min-h-[26px]',
          'min-w-[32px]',
          'border-strong',
          'bg-card',
          'text-ink-primary',
          'hover:bg-row-hover',
          'focus-visible:outline-2',
          'focus-visible:outline-offset-2',
          'focus-visible:outline-accent-primary'
        )
      }
    }

    // Leaderboard links expose visible focus-visible outlines
    const albumCard = screen.getByTestId('card-top-albums')
    const releaseCard = screen.getByTestId('card-top-releases')
    const newlyCard = screen.getByTestId('card-newly-added')
    for (const link of [
      within(albumCard).getByRole('link', { name: 'Radiohead — In Rainbows' }),
      within(releaseCard).getByRole('link', { name: 'Radiohead — In Rainbows' }),
      within(newlyCard).getByRole('link', { name: 'My Bloody Valentine — Loveless' }),
    ]) {
      expect(link).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-accent-primary'
      )
    }
  })

  it('handles singular counts, null fallbacks in Newly Added Releases, and invalid URL window parameter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              window: '24H',
              top_albums: [
                {
                  album_id: 'alb-single',
                  album_title: 'Moon Safari',
                  combined_artist: 'Air',
                  hype_index: 45,
                  hype_velocity: 2.0,
                  tier: 'moderate',
                  release_count: 1,
                  submission_count: 1,
                  monogram_key: 'alb-single',
                },
              ],
              top_releases: [],
              newly_added: [
                {
                  release_id: 'rel-null-new',
                  album_id: 'alb-single',
                  album_title: 'Moon Safari',
                  combined_artist: 'Air',
                  variant: null,
                  retailer_name: null,
                  hype_index: 45,
                  hype_velocity: 2.0,
                  tier: 'moderate',
                  latest_score: 12,
                  monogram_key: 'rel-null-new',
                  first_seen_at: new Date().toISOString(),
                },
              ],
              live_feed: [],
            }),
        })
      )
    )

    renderDashboard(['/?window=bogus'])

    const albumCard = screen.getByTestId('card-top-albums')
    const releaseCard = screen.getByTestId('card-top-releases')
    const newlyCard = screen.getByTestId('card-newly-added')

    await waitFor(() => {
      expect(within(albumCard).getByText('1 Submission · 1 Release')).toBeInTheDocument()
    })

    expect(within(albumCard).getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(releaseCard).getByRole('button', { name: '24H' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(newlyCard).getByText('Standard Pressing · Wide / Unspecified')).toBeInTheDocument()
    expect(within(newlyCard).getByText('+2 pts/hr · 12 pts')).toBeInTheDocument()
  })
})
