import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

  it('renders uniform 5 rows with dashed placeholders across all 3 leaderboard cards', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('In Rainbows').length).toBeGreaterThanOrEqual(1)
    })

    // top_albums has 2 items -> 3 empty slot rows
    const albumEmptySlots = screen.getAllByTestId('empty-slot-album')
    expect(albumEmptySlots).toHaveLength(3)

    // top_releases has 2 items -> 3 empty slot rows
    const releaseEmptySlots = screen.getAllByTestId('empty-slot-release')
    expect(releaseEmptySlots).toHaveLength(3)

    // newly_added has 1 item -> 4 empty slot rows
    const newlyEmptySlots = screen.getAllByTestId('empty-slot-newly-added')
    expect(newlyEmptySlots).toHaveLength(4)
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
      expect(screen.getByText('OK Computer')).toBeDefined()
    })
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
      expect(screen.getByText('OK Computer')).toBeInTheDocument()
    })

    // In Top Albums card, check link href
    const albumCard = screen.getByTestId('card-top-albums')
    const albumLink = within(albumCard).getByRole('link', { name: /ok computer/i })
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

  it('renders Coral Alert banner and retry button on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure'))
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error-banner')).toBeInTheDocument()
    })

    expect(screen.getByText(/Failed to load demand intelligence/i)).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-retry-btn')).toBeInTheDocument()
  })
})
