import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { NavigationRail } from '../components/NavigationRail'
import { TopBar } from '../components/TopBar'
import { App } from '../App'

// Mock global fetch for health check
vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'ok',
          database: 'connected',
          latest_snapshot_at: new Date().toISOString(),
        }),
    })
  )
)

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderAppShell(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<div>Workspace Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppShell Responsive Drawer', () => {
  it('collapses rail off-canvas below lg and toggles drawer via top bar menu and close buttons', () => {
    renderAppShell()

    const mainContent = screen.getByTestId('main-content')
    expect(mainContent).toHaveClass('p-4', 'sm:p-6', 'lg:p-8')
    expect(mainContent.parentElement).toHaveClass('ml-0', 'lg:ml-[240px]')

    const rail = screen.getByTestId('navigation-rail')
    expect(rail).toHaveAttribute('id', 'primary-navigation-rail')
    expect(rail).toHaveClass('-translate-x-full', 'invisible', 'lg:translate-x-0', 'lg:visible')
    expect(rail).not.toHaveClass('shadow-brutal-lg')
    expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument()

    const openBtn = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    expect(openBtn).toHaveAttribute('aria-controls', 'primary-navigation-rail')
    expect(openBtn).toHaveClass('lg:hidden')

    fireEvent.click(openBtn)

    expect(openBtn).toHaveAttribute('aria-expanded', 'true')
    expect(rail).toHaveClass('translate-x-0', 'visible', 'shadow-brutal-lg', 'lg:shadow-none')
    expect(rail).not.toHaveClass('-translate-x-full', 'invisible')
    expect(screen.getByTestId('nav-backdrop')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Close navigation menu' })
    expect(closeBtn).toHaveClass('lg:hidden')
    fireEvent.click(closeBtn)

    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    expect(rail).toHaveClass('-translate-x-full', 'invisible', 'lg:visible')
    expect(rail).not.toHaveClass('shadow-brutal-lg')
    expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument()
  })

  it('closes drawer when clicking backdrop, pressing Escape, or clicking a navigation link', () => {
    renderAppShell()

    const openBtn = screen.getByRole('button', { name: 'Open navigation menu' })
    const rail = screen.getByTestId('navigation-rail')

    // 1. Backdrop click closes drawer
    fireEvent.click(openBtn)
    expect(rail).toHaveClass('translate-x-0')
    fireEvent.click(screen.getByTestId('nav-backdrop'))
    expect(rail).toHaveClass('-translate-x-full')
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')

    // 2. Escape key closes drawer
    fireEvent.click(openBtn)
    expect(rail).toHaveClass('translate-x-0')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(rail).toHaveClass('-translate-x-full')
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')

    // 3. Clicking a navigation link closes drawer
    fireEvent.click(openBtn)
    expect(rail).toHaveClass('translate-x-0')
    fireEvent.click(screen.getByTestId('nav-directory-explorer'))
    expect(rail).toHaveClass('-translate-x-full')
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')

    // 4. Clicking a sub-link or brand header link also closes drawer
    fireEvent.click(openBtn)
    fireEvent.click(screen.getByTestId('nav-sub-releases'))
    expect(rail).toHaveClass('-translate-x-full')

    fireEvent.click(openBtn)
    fireEvent.click(screen.getByTestId('brand-header-link'))
    expect(rail).toHaveClass('-translate-x-full')
  })

  it('closes drawer on any route navigation such as TopBar global search or in-page links', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const target = String(url)
      if (target.includes('/api/v1/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: 'smashing',
              albums: [
                {
                  id: 'abc1234567890def',
                  title: 'Lull',
                  subtitle: 'The Smashing Pumpkins · 3 pressings',
                  monogram_key: 'abc1234567890def',
                },
              ],
              releases: [],
              artists: [],
            }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            database: 'connected',
            latest_snapshot_at: new Date().toISOString(),
          }),
      } as Response)
    })

    const RouteProbe = () => {
      const location = useLocation()
      return (
        <div>
          <div data-testid="active-route">{`${location.pathname}${location.search}`}</div>
          <Link to="/directory?window=7D">Go to Directory</Link>
        </div>
      )
    }

    try {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="*" element={<RouteProbe />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      const openBtn = screen.getByRole('button', { name: 'Open navigation menu' })
      const rail = screen.getByTestId('navigation-rail')

      // 1. Open drawer on '/', then navigate via TopBar global search result
      fireEvent.click(openBtn)
      expect(rail).toHaveClass('translate-x-0')
      expect(openBtn).toHaveAttribute('aria-expanded', 'true')

      const searchInput = screen.getByTestId('global-search-input')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'smashing' } })

      const resultOption = await screen.findByTestId('search-result-abc1234567890def')
      fireEvent.click(resultOption)

      await waitFor(() => {
        expect(screen.getByTestId('active-route')).toHaveTextContent('/albums/abc1234567890def')
      })
      expect(rail).toHaveClass('-translate-x-full')
      expect(openBtn).toHaveAttribute('aria-expanded', 'false')

      // 2. Open drawer again, then navigate via an in-page link outside NavigationRail
      fireEvent.click(openBtn)
      expect(rail).toHaveClass('translate-x-0')
      fireEvent.click(screen.getByRole('link', { name: 'Go to Directory' }))

      await waitFor(() => {
        expect(screen.getByTestId('active-route')).toHaveTextContent('/directory?window=7D')
      })
      expect(rail).toHaveClass('-translate-x-full')
      expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('NavigationRail', () => {
  it('renders brand header, navigation destinations, and factual rail footer', () => {
    renderWithProviders(<NavigationRail />)

    expect(screen.getByText('VINYL DEMAND')).toBeInTheDocument()
    expect(screen.getByText('r/vinylreleases LEDGER')).toBeInTheDocument()
    expect(screen.getByTestId('nav-demand-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('nav-directory-explorer')).toBeInTheDocument()
    expect(screen.getByTestId('nav-sub-releases')).toBeInTheDocument()
    expect(screen.getByTestId('nav-sub-albums')).toBeInTheDocument()
    expect(screen.getByTestId('nav-sub-artists')).toBeInTheDocument()
    expect(screen.getByTestId('rail-footer')).toHaveTextContent('SOURCE: r/vinylreleases')
  })

  it('preserves hype window parameter in navigation links', () => {
    renderWithProviders(<NavigationRail />, '/?window=7D')

    const dashboardLink = screen.getByTestId('nav-demand-dashboard')
    expect(dashboardLink.getAttribute('href')).toBe('/?window=7D')

    const directoryLink = screen.getByTestId('nav-directory-explorer')
    expect(directoryLink.getAttribute('href')).toBe('/directory?window=7D')

    const releasesSubLink = screen.getByTestId('nav-sub-releases')
    expect(releasesSubLink.getAttribute('href')).toBe('/directory?window=7D&tab=releases')
  })

  it('exposes Primary navigation landmark and sets aria-current="page" on the active link', () => {
    const { unmount } = renderWithProviders(<NavigationRail />, '/')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByTestId('nav-demand-dashboard')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('nav-directory-explorer')).not.toHaveAttribute('aria-current')
    expect(screen.getByTestId('nav-sub-releases')).not.toHaveAttribute('aria-current')
    unmount()

    const dirView = renderWithProviders(<NavigationRail />, '/directory')
    expect(screen.getByTestId('nav-directory-explorer')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('nav-demand-dashboard')).not.toHaveAttribute('aria-current')
    dirView.unmount()

    const relView = renderWithProviders(<NavigationRail />, '/directory?tab=releases')
    expect(screen.getByTestId('nav-sub-releases')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('nav-directory-explorer')).not.toHaveAttribute('aria-current')
    relView.unmount()

    const albView = renderWithProviders(<NavigationRail />, '/directory?tab=albums')
    expect(screen.getByTestId('nav-sub-albums')).toHaveAttribute('aria-current', 'page')
    albView.unmount()

    renderWithProviders(<NavigationRail />, '/directory?tab=artists')
    expect(screen.getByTestId('nav-sub-artists')).toHaveAttribute('aria-current', 'page')
  })

  it('uses accessible nav-muted contrast token and visible focus-visible outlines', () => {
    renderWithProviders(<NavigationRail isOpen />, '/')

    expect(screen.getByText('r/vinylreleases LEDGER')).toHaveClass('text-nav-muted')
    expect(screen.getByText('INTELLIGENCE')).toHaveClass('text-nav-muted')
    expect(screen.getByTestId('rail-footer')).toHaveClass('text-nav-muted')
    expect(screen.getByTestId('nav-sub-releases')).toHaveClass('text-nav-muted')
    expect(screen.getByTestId('nav-sub-albums')).toHaveClass('text-nav-muted')
    expect(screen.getByTestId('nav-sub-artists')).toHaveClass('text-nav-muted')

    const interactiveIds = [
      'brand-header-link',
      'close-nav-button',
      'nav-demand-dashboard',
      'nav-directory-explorer',
      'nav-sub-releases',
      'nav-sub-albums',
      'nav-sub-artists',
    ]
    for (const id of interactiveIds) {
      expect(screen.getByTestId(id)).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-accent-primary'
      )
    }
  })
})

describe('TopBar', () => {
  it('renders search input and provenance indicator', async () => {
    renderWithProviders(<TopBar />)

    const searchInput = screen.getByTestId('global-search-input')
    expect(searchInput).toBeInTheDocument()

    expect(screen.getByTestId('freshness-indicator')).toHaveTextContent('SOURCE: r/vinylreleases')
  })

  it('shows clear button and clears search when clicked', () => {
    renderWithProviders(<TopBar />, '/directory?q=taylor')

    const searchInput = screen.getByTestId('global-search-input') as HTMLInputElement
    expect(searchInput.value).toBe('taylor')

    const clearBtn = screen.getByTestId('search-clear-button')
    fireEvent.click(clearBtn)
    expect(searchInput.value).toBe('')
  })
})

describe('App Routing', () => {
  it('renders DemandDashboard on default root path', () => {
    render(<App />)
    expect(screen.getByTestId('screen-demand-dashboard')).toBeInTheDocument()
  })
})

describe('Global Stylesheet Foundations', () => {
  it('defines nav-muted token, tabular-nums on .font-mono, and prefers-reduced-motion rules', () => {
    const indexCss = readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')
    expect(indexCss).toMatch(/--color-nav-muted:\s*#94949E/i)
    expect(indexCss).toMatch(/\.font-mono\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s)
    expect(indexCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(indexCss).toMatch(/\.animate-pulse[\s\S]*animation:\s*none\s*!important/)
    expect(indexCss).toMatch(/\.animate-spin[\s\S]*animation:\s*none\s*!important/)
    expect(indexCss).toMatch(/transform:\s*none\s*!important/)
  })
})
