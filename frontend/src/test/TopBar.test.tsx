import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopBar } from '../components/TopBar'

const mockSearchData = {
  query: 'smashing',
  albums: [
    {
      id: 'abc1234567890def',
      title: 'Lull',
      subtitle: 'The Smashing Pumpkins · 3 pressings',
      monogram_key: 'abc1234567890def',
    },
  ],
  releases: [
    {
      id: 'rel-1111-2222',
      title: 'Lull',
      subtitle: 'The Smashing Pumpkins · 35th Anniversary Splatter',
      monogram_key: 'rel-1111-2222',
    },
  ],
  artists: [
    {
      id: 'art-3333-4444',
      title: 'The Smashing Pumpkins',
      subtitle: '1 solo · 0 combined (1 album)',
      monogram_key: 'art-3333-4444',
    },
  ],
}

describe('TopBar Global Search', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                database: 'connected',
                latest_snapshot_at: new Date().toISOString(),
              }),
          })
        }
        if (url.includes('/api/v1/search')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchData),
          })
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`))
      })
    )
  })

  function renderTopBar(initialRoute = '/?window=7D') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="*" element={<TopBar />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders search input with placeholder and keyboard shortcut kbd', () => {
    renderTopBar()
    const input = screen.getByTestId('global-search-input')
    expect(input).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('focuses input on Cmd+K or Ctrl+K shortcut', () => {
    renderTopBar()
    const input = screen.getByTestId('global-search-input')
    expect(document.activeElement).not.toBe(input)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(document.activeElement).toBe(input)
  })

  it('opens dropdown and displays grouped search results with monograms on typing', async () => {
    renderTopBar()
    const input = screen.getByTestId('global-search-input')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'smashing' } })

    // Wait for debounced search and query resolution
    await waitFor(
      () => {
        expect(screen.getByText('ALBUMS')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    // Verify sections
    expect(screen.getByText('ALBUMS')).toBeInTheDocument()
    expect(screen.getByText('RELEASES')).toBeInTheDocument()
    expect(screen.getByText('ARTISTS')).toBeInTheDocument()

    // Verify items and subtitles
    expect(screen.getByText('The Smashing Pumpkins · 3 pressings')).toBeInTheDocument()
    expect(screen.getByText('The Smashing Pumpkins · 35th Anniversary Splatter')).toBeInTheDocument()
    expect(screen.getByText('1 solo · 0 combined (1 album)')).toBeInTheDocument()

    // Verify vinyl monograms rendered in dropdown
    const monograms = screen.getAllByTestId('vinyl-monogram')
    expect(monograms.length).toBeGreaterThanOrEqual(3)
  })

  it('closes dropdown when Escape key is pressed', async () => {
    renderTopBar()
    const input = screen.getByTestId('global-search-input')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'smashing' } })

    await waitFor(
      () => {
        expect(screen.getByText('ALBUMS')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument()
    })
  })

  it('navigates with arrow keys and Enter key preserving ?window= parameter', async () => {
    renderTopBar('/?window=7D')
    const input = screen.getByTestId('global-search-input')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'smashing' } })

    await waitFor(
      () => {
        expect(screen.getByText('ALBUMS')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    // Arrow down selects first item (Album: Lull)
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const albumItem = screen.getByTestId('search-result-abc1234567890def')
    expect(albumItem).toHaveAttribute('data-selected', 'true')

    // Press Enter to navigate
    fireEvent.keyDown(input, { key: 'Enter' })

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument()
    })
  })

  it('renders 0 MATCHING RECORDS when search returns no items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                database: 'connected',
                latest_snapshot_at: new Date().toISOString(),
              }),
          })
        }
        if (url.includes('/api/v1/search')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                query: 'unknownzzzz',
                albums: [],
                releases: [],
                artists: [],
              }),
          })
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`))
      })
    )

    renderTopBar()
    const input = screen.getByTestId('global-search-input')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'unknownzzzz' } })

    await waitFor(
      () => {
        expect(screen.getByTestId('search-no-results')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
    expect(screen.getByText('0 MATCHING RECORDS')).toBeInTheDocument()
  })

  it('clicking an item closes dropdown and navigates', async () => {
    renderTopBar('/?window=1M')
    const input = screen.getByTestId('global-search-input')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'smashing' } })

    await waitFor(
      () => {
        expect(screen.getByText('ALBUMS')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    const albumItem = screen.getByTestId('search-result-abc1234567890def')
    fireEvent.click(albumItem)

    await waitFor(() => {
      expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument()
    })
  })
})
