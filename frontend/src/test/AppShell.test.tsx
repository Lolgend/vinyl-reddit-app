import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
