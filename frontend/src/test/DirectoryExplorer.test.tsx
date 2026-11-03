import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DirectoryExplorer } from '../pages/DirectoryExplorer'

const mockCounts = {
  releases: 51,
  albums: 42,
  artists: 38,
}

const mockRetailers = ['Rough Trade', 'Target', 'Indies']

const mockReleasesData = {
  page: 1,
  page_size: 20,
  total_pages: 3,
  total_items: 51,
  items: [
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
      submission_count: 2,
      created_at: '2026-10-31T12:00:00Z',
      monogram_key: 'rel-1',
    },
    {
      release_id: 'rel-2',
      album_id: 'alb-2',
      album_title: 'Siamese Dream',
      combined_artist: 'The Smashing Pumpkins',
      variant: null,
      retailer_name: null,
      hype_index: 25,
      hype_velocity: 0.0,
      tier: 'low',
      score: 10,
      num_comments: 2,
      submission_count: 1,
      created_at: '2026-10-30T10:00:00Z',
      monogram_key: 'rel-2',
    },
  ],
}

const mockAlbumsData = {
  page: 1,
  page_size: 20,
  total_pages: 3,
  total_items: 42,
  items: [
    {
      album_id: 'alb-1',
      album_title: 'In Rainbows',
      combined_artist: 'Radiohead',
      release_count: 3,
      preview_variants: ['Yellow Vinyl', 'Standard Black'],
      retailers: ['Rough Trade', 'XL Recordings'],
      submission_count: 4,
      score: 220,
      num_comments: 65,
      hype_velocity: 18.2,
      hype_index: 95,
      tier: 'high',
      monogram_key: 'alb-1',
      created_at: '2026-10-29T08:00:00Z',
    },
  ],
}

const mockArtistsData = {
  page: 1,
  page_size: 20,
  total_pages: 2,
  total_items: 38,
  items: [
    {
      artist_id: 'art-1',
      name: 'Radiohead',
      solo_album_count: 6,
      combined_album_count: 1,
      album_count: 7,
      release_count: 15,
      submission_count: 22,
      score: 850,
      num_comments: 310,
      hype_velocity: 24.0,
      hype_index: 98,
      tier: 'high',
      monogram_key: 'art-1',
      created_at: '2026-10-25T12:00:00Z',
    },
  ],
}

describe('DirectoryExplorer Page', () => {
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
        if (url.includes('/api/v1/directory/counts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCounts),
          })
        }
        if (url.includes('/api/v1/directory/retailers')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRetailers),
          })
        }
        if (url.includes('/api/v1/directory/albums')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAlbumsData),
          })
        }
        if (url.includes('/api/v1/directory/artists')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockArtistsData),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReleasesData),
        })
      })
    )
  })

  const renderComponent = (initialEntries = ['/directory']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/directory" element={<DirectoryExplorer />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders header, live counts on tab buttons, and default releases tab', async () => {
    renderComponent()

    expect(screen.getByText('Directory Explorer')).toBeInTheDocument()

    // Wait for live counts
    await waitFor(() => {
      expect(screen.getByTestId('tab-releases')).toHaveTextContent('RELEASES (51)')
      expect(screen.getByTestId('tab-albums')).toHaveTextContent('ALBUMS (42)')
      expect(screen.getByTestId('tab-artists')).toHaveTextContent('ARTISTS (38)')
    })

    // Default view is Grid for Releases
    await waitFor(() => {
      expect(screen.getByTestId('releases-card-grid')).toBeInTheDocument()
      expect(screen.getByText('In Rainbows')).toBeInTheDocument()
      expect(screen.getByText('Radiohead')).toBeInTheDocument()
    })
  })

  it('renders structural loading skeleton matching exact container geometries during fetch', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {}))
    )

    renderComponent()

    expect(screen.getByTestId('directory-skeleton')).toBeInTheDocument()
  })

  it('handles null variant and retailer fallbacks correctly', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Siamese Dream')).toBeInTheDocument()
      // Fallback for null variant
      expect(screen.getByText('Standard Pressing')).toBeInTheDocument()
      // Fallback for null retailer
      expect(screen.getByText('Wide / Unspecified')).toBeInTheDocument()
    })
  })

  it('switches between 3-column Card Grid and 7-column Table view on Releases tab', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('releases-card-grid')).toBeInTheDocument()
    })

    // Click Table view toggle
    fireEvent.click(screen.getByTestId('view-table'))

    await waitFor(() => {
      expect(screen.getByTestId('releases-table-view')).toBeInTheDocument()
      expect(screen.queryByTestId('releases-card-grid')).not.toBeInTheDocument()
    })

    // Click back to Grid view
    fireEvent.click(screen.getByTestId('view-grid'))

    await waitFor(() => {
      expect(screen.getByTestId('releases-card-grid')).toBeInTheDocument()
    })
  })

  it('switches tabs and synchronizes URL search parameter', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('tab-albums')).toBeInTheDocument()
    })

    // Click ALBUMS tab
    fireEvent.click(screen.getByTestId('tab-albums'))

    await waitFor(() => {
      expect(screen.getByTestId('albums-ledger-table')).toBeInTheDocument()
      expect(screen.getByText('Yellow Vinyl')).toBeInTheDocument()
    })

    // Click ARTISTS tab
    fireEvent.click(screen.getByTestId('tab-artists'))

    await waitFor(() => {
      expect(screen.getByTestId('artists-ledger-table')).toBeInTheDocument()
      expect(screen.getByText('6 Solo')).toBeInTheDocument()
      expect(screen.getByText('1 Combined')).toBeInTheDocument()
    })
  })

  it('loads directly into albums tab when ?tab=albums is in initial URL', async () => {
    renderComponent(['/directory?tab=albums'])

    await waitFor(() => {
      expect(screen.getByTestId('albums-ledger-table')).toBeInTheDocument()
      expect(screen.getByText('In Rainbows')).toBeInTheDocument()
    })
  })

  it('supports window switching and updates active window query', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('window-pill-7D')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('window-pill-7D'))

    await waitFor(() => {
      expect(screen.getByTestId('window-pill-7D')).toHaveClass('bg-[#121212]')
    })
  })

  it('filters by hype tier chips', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('tier-filter-high')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('tier-filter-high'))

    await waitFor(() => {
      expect(screen.getByTestId('tier-filter-high')).toHaveClass('bg-[#68D391]')
    })
  })

  it('renders attribution filter pills on Albums tab and filters when clicked', async () => {
    renderComponent(['/directory?tab=albums'])

    await waitFor(() => {
      expect(screen.getByTestId('attribution-filter-solo')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('attribution-filter-solo'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('attribution=solo')
      )
    })
  })

  it('supports sort_by and sort_order aliases in URL parameters', async () => {
    renderComponent(['/directory?sort_by=submissions&sort_order=asc'])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=submissions')
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('order=asc')
      )
    })
  })

  it('supports searching via command bar input', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('directory-search-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('directory-search-input')
    fireEvent.change(input, { target: { value: 'Rainbows' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=Rainbows')
      )
    })
  })

  it('renders empty state with active filter pills and handles reset filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/directory/counts')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCounts) })
        }
        if (url.includes('/api/v1/directory/retailers')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRetailers) })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              page: 1,
              page_size: 20,
              total_pages: 1,
              total_items: 0,
              items: [],
            }),
        })
      })
    )

    renderComponent(['/directory?q=UnknownArtist&tier=high&retailer=Rough%20Trade&attribution=solo'])

    await waitFor(() => {
      expect(screen.getByTestId('directory-empty-state')).toBeInTheDocument()
      expect(screen.getByText('0 MATCHING RECORDS')).toBeInTheDocument()
      expect(screen.getByTestId('filter-pill-query')).toBeInTheDocument()
      expect(screen.getByTestId('filter-pill-tier')).toBeInTheDocument()
      expect(screen.getByTestId('filter-pill-retailer')).toBeInTheDocument()
      expect(screen.getByTestId('filter-pill-attribution')).toBeInTheDocument()
      expect(screen.getByTestId('reset-filters-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('reset-filters-btn'))
  })

  it('renders Coral Alert banner and retry button on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/directory/counts') || url.includes('/api/v1/directory/retailers')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        }
        return Promise.reject(new Error('Network error'))
      })
    )

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('directory-error-banner')).toBeInTheDocument()
    })

    expect(screen.getByText(/Failed to load releases data/i)).toBeInTheDocument()
    expect(screen.getByTestId('directory-retry-btn')).toBeInTheDocument()
  })

  it('displays pagination controls and handles page navigation', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('directory-pagination')).toBeInTheDocument()
      expect(screen.getByTestId('pagination-prev')).toBeDisabled()
      expect(screen.getByTestId('pagination-next')).not.toBeDisabled()
      expect(screen.getByTestId('pagination-pages')).toHaveTextContent('Page 1 of 3')
    })

    fireEvent.click(screen.getByTestId('pagination-next'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      )
    })
  })
})
