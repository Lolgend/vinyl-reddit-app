import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('wires WAI-ARIA combobox, listbox, option ids, and aria-activedescendant', async () => {
    renderTopBar()
    const input = screen.getByRole('combobox', { name: 'Global catalog search' })
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-controls', 'global-search-listbox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-activedescendant')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'smashing' } })

    const listbox = await screen.findByRole('listbox', { name: 'Search suggestions' })
    expect(listbox).toHaveAttribute('id', 'global-search-listbox')
    expect(input).toHaveAttribute('aria-expanded', 'true')

    const groups = await within(listbox).findAllByRole('group')
    expect(groups).toHaveLength(3)

    const albumsGroup = within(listbox).getByRole('group', { name: 'ALBUMS' })
    expect(albumsGroup).toHaveAttribute('aria-labelledby', 'search-group-albums')
    expect(albumsGroup.querySelector('#search-group-albums')).toHaveAttribute('role', 'presentation')
    expect(within(albumsGroup).getByRole('option')).toHaveAttribute(
      'id',
      'global-search-option-album-abc1234567890def'
    )

    const releasesGroup = within(listbox).getByRole('group', { name: 'RELEASES' })
    expect(releasesGroup).toHaveAttribute('aria-labelledby', 'search-group-releases')
    expect(releasesGroup.querySelector('#search-group-releases')).toHaveAttribute('role', 'presentation')
    expect(within(releasesGroup).getByRole('option')).toHaveAttribute(
      'id',
      'global-search-option-release-rel-1111-2222'
    )

    const artistsGroup = within(listbox).getByRole('group', { name: 'ARTISTS' })
    expect(artistsGroup).toHaveAttribute('aria-labelledby', 'search-group-artists')
    expect(artistsGroup.querySelector('#search-group-artists')).toHaveAttribute('role', 'presentation')
    expect(within(artistsGroup).getByRole('option')).toHaveAttribute(
      'id',
      'global-search-option-artist-art-3333-4444'
    )

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveAttribute('id', 'global-search-option-album-abc1234567890def')
    expect(options[1]).toHaveAttribute('id', 'global-search-option-release-rel-1111-2222')
    expect(options[2]).toHaveAttribute('id', 'global-search-option-artist-art-3333-4444')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'global-search-option-album-abc1234567890def'
    )

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'global-search-option-release-rel-1111-2222'
    )

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('keeps #global-search-listbox mounted with aria-expanded="true" during loading and 0-results states', async () => {
    let resolveSearch!: (value: Response) => void
    const pendingSearch = new Promise<Response>((resolve) => {
      resolveSearch = resolve
    })

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
          return pendingSearch
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`))
      })
    )

    renderTopBar()
    const input = screen.getByRole('combobox', { name: 'Global catalog search' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'unknownzzzz' } })

    // Loading state: aria-expanded="true" and #global-search-listbox exists
    const loadingStatus = await screen.findByText('SEARCHING CATALOG...', {}, { timeout: 2000 })
    expect(loadingStatus.closest('[role="status"]')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const listboxWhileLoading = screen.getByRole('listbox', { name: 'Search suggestions' })
    expect(listboxWhileLoading).toHaveAttribute('id', 'global-search-listbox')

    // Resolve with 0 results: aria-expanded="true" and #global-search-listbox still exists
    resolveSearch({
      ok: true,
      json: () =>
        Promise.resolve({
          query: 'unknownzzzz',
          albums: [],
          releases: [],
          artists: [],
        }),
    } as Response)

    const emptyState = await screen.findByTestId('search-no-results', {}, { timeout: 2000 })
    expect(emptyState).toHaveAttribute('role', 'status')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const listboxWhenEmpty = screen.getByRole('listbox', { name: 'Search suggestions' })
    expect(listboxWhenEmpty).toHaveAttribute('id', 'global-search-listbox')
  })

  it('uses WCAG AA placeholder contrast, focus-visible outlines, semantic tokens, and accessible button target size', () => {
    renderTopBar('/directory?q=taylor')

    const openNavButton = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(openNavButton).toHaveClass(
      'border-strong',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary'
    )
    expect(openNavButton).not.toHaveClass('border-[1.5px]')

    const input = screen.getByTestId('global-search-input')
    expect(input).toHaveClass(
      'border-strong',
      'placeholder:text-ink-secondary',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary'
    )
    expect(input).not.toHaveClass('focus:outline-none', 'border-[1.5px]')

    const clearButton = screen.getByRole('button', { name: 'Clear search' })
    expect(clearButton).toHaveAttribute('data-testid', 'search-clear-button')
    expect(clearButton).toHaveClass(
      'border-strong',
      'hover:bg-accent-primary',
      'hover:text-ink-primary',
      'min-h-[26px]',
      'min-w-[26px]',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary'
    )
    expect(clearButton).not.toHaveClass('hover:bg-[#27272A]')
  })
})
