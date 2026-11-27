import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { PipelineAdmin } from '../pages/PipelineAdmin'
import type { AdminPipelineResponse } from '../types/admin'

const BASE_NOW = '2026-11-27T12:00:00.000Z'

function makeHealthyPayload(
  overrides: Partial<AdminPipelineResponse> = {}
): AdminPipelineResponse {
  return {
    server_time: BASE_NOW,
    telemetry_available: true,
    process: {
      effective_status: 'online',
      raw_status: 'running',
      run_mode: 'continuous',
      host: 'scraper-host-01',
      pid: 12345,
      heartbeat_interval_seconds: 30,
      stale_threshold_seconds: 90,
      started_at: '2026-11-27T10:00:00.000Z',
      last_heartbeat_at: '2026-11-27T11:59:45.000Z',
      stopped_at: null,
    },
    loops: [
      {
        loop_name: 'discovery_poll',
        status: 'sleeping',
        interval_seconds: 300,
        last_started_at: '2026-11-27T11:55:00.000Z',
        last_completed_at: '2026-11-27T11:55:03.000Z',
        next_run_at: '2026-11-27T12:04:32.000Z',
        last_duration_ms: 3000,
        last_run_stats: { inserted: 4, updated: 12, skipped: 34 },
        last_error: null,
      },
      {
        loop_name: 'tracking_poll',
        status: 'error',
        interval_seconds: 900,
        last_started_at: '2026-11-27T11:50:00.000Z',
        last_completed_at: '2026-11-27T11:50:04.000Z',
        next_run_at: '2026-11-27T12:00:45.000Z',
        last_duration_ms: 4120,
        last_run_stats: { inserted: 0, updated: 18, skipped: 2 },
        last_error: 'Reddit HTTP 429 rate limited',
      },
      {
        loop_name: 'extraction_worker',
        status: 'sleeping',
        interval_seconds: 2,
        last_started_at: '2026-11-27T11:59:10.000Z',
        last_completed_at: '2026-11-27T11:59:11.000Z',
        next_run_at: null,
        last_duration_ms: 850,
        last_run_stats: { extracted: 7 },
        last_error: null,
      },
      {
        loop_name: 'enrichment_worker',
        status: 'disabled',
        interval_seconds: 600,
        last_started_at: null,
        last_completed_at: null,
        next_run_at: null,
        last_duration_ms: null,
        last_run_stats: null,
        last_error: null,
      },
    ],
    extraction_queue: null,
    enrichment_queue: null,
    runs: [],
    ...overrides,
  }
}

function stubAdminFetch(
  adminResponder: (url: string) => Promise<Response> | Response
) {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'ok',
            database: 'connected',
            latest_snapshot_at: BASE_NOW,
          }),
      } as Response)
    }
    if (url.includes('/api/v1/admin/pipeline')) {
      return Promise.resolve(adminResponder(url))
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAdminApp(initialRoute = '/admin') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div data-testid="home-stub">Home</div>} />
            <Route path="admin" element={<PipelineAdmin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function setDocumentVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  setDocumentVisibility('visible')
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Pipeline Admin Shell, Navigation & Liveness (/admin)', () => {
  it('navigates from SYSTEM section in NavigationRail, sets aria-current="page", closes mobile drawer, and renders online liveness + 4 loop cards', async () => {
    const payload = makeHealthyPayload()
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }) as Response)

    renderAdminApp('/')

    const systemSection = screen.getByTestId('nav-system-section')
    expect(systemSection).toHaveTextContent('SYSTEM')

    // Open mobile drawer, click Pipeline Admin, confirm drawer closes and route activates
    const openBtn = screen.getByRole('button', { name: 'Open navigation menu' })
    const rail = screen.getByTestId('navigation-rail')
    fireEvent.click(openBtn)
    expect(rail).toHaveClass('translate-x-0')

    const adminLink = screen.getByTestId('nav-pipeline-admin')
    expect(adminLink).toHaveTextContent('Pipeline Admin')
    fireEvent.click(adminLink)

    expect(rail).toHaveClass('-translate-x-full')
    expect(adminLink).toHaveAttribute('aria-current', 'page')

    // Verify super-header, liveness badge, host/pid pill, and all 4 loop cards
    expect(await screen.findByTestId('screen-pipeline-admin')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /PIPELINE ADMIN/i })).toBeInTheDocument()
    expect(await screen.findByTestId('process-liveness-badge')).toHaveTextContent('ONLINE')
    expect(screen.getByTestId('process-host-pid')).toHaveTextContent('scraper-host-01')
    expect(screen.getByTestId('process-host-pid')).toHaveTextContent('12345')

    expect(screen.getByTestId('loop-card-discovery_poll')).toHaveTextContent('Discovery Poll')
    expect(screen.getByTestId('loop-card-discovery_poll')).toHaveTextContent('4 inserted')
    expect(screen.getByTestId('loop-card-discovery_poll')).toHaveTextContent('3.0s')

    expect(screen.getByTestId('loop-card-tracking_poll')).toHaveTextContent('Tracking Poll')
    expect(screen.getByTestId('loop-error-tracking_poll')).toHaveTextContent(
      'Reddit HTTP 429 rate limited'
    )

    expect(screen.getByTestId('loop-card-extraction_worker')).toHaveTextContent('Extraction Queue')
    expect(screen.getByTestId('loop-countdown-extraction_worker')).toHaveTextContent(
      'Event-driven'
    )
    expect(screen.getByTestId('loop-card-extraction_worker')).toHaveTextContent('7 extracted')

    expect(screen.getByTestId('loop-card-enrichment_worker')).toHaveTextContent('Enrichment Queue')
    expect(screen.getByTestId('loop-card-enrichment_worker')).toHaveTextContent('DISABLED')
    expect(screen.getByTestId('loop-countdown-enrichment_worker')).toHaveTextContent('—')
  })

  it('renders Offline / Stale liveness banner without negative countdowns', async () => {
    const payload = makeHealthyPayload({
      process: {
        effective_status: 'offline',
        raw_status: 'running',
        run_mode: 'continuous',
        host: 'scraper-host-01',
        pid: 9999,
        heartbeat_interval_seconds: 30,
        stale_threshold_seconds: 90,
        started_at: '2026-11-27T10:00:00.000Z',
        last_heartbeat_at: '2026-11-27T11:55:00.000Z',
        stopped_at: null,
      },
      loops: [
        {
          loop_name: 'discovery_poll',
          status: 'sleeping',
          interval_seconds: 300,
          last_started_at: '2026-11-27T11:50:00.000Z',
          last_completed_at: '2026-11-27T11:50:03.000Z',
          // Even if a stale past timestamp ever arrived, frontend must never render negative seconds
          next_run_at: '2026-11-27T11:55:03.000Z',
          last_duration_ms: 3000,
          last_run_stats: { inserted: 1, updated: 2, skipped: 3 },
          last_error: null,
        },
      ],
    })
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }) as Response)

    renderAdminApp('/admin')

    expect(await screen.findByTestId('process-liveness-badge')).toHaveTextContent('OFFLINE / STALE')
    expect(screen.getByTestId('process-stale-warning')).toHaveTextContent('> 90s')
    const countdown = screen.getByTestId('loop-countdown-discovery_poll')
    expect(countdown).toHaveTextContent('—')
    expect(countdown.textContent).not.toMatch(/-\d+s/)
  })

  it('renders Stopped liveness badge with stopped_at timestamp and no active countdown', async () => {
    const payload = makeHealthyPayload({
      process: {
        effective_status: 'stopped',
        raw_status: 'stopped',
        run_mode: 'once',
        host: 'scraper-host-01',
        pid: 5555,
        heartbeat_interval_seconds: 30,
        stale_threshold_seconds: 90,
        started_at: '2026-11-27T11:40:00.000Z',
        last_heartbeat_at: '2026-11-27T11:45:00.000Z',
        stopped_at: '2026-11-27T11:45:00.000Z',
      },
      loops: [
        {
          loop_name: 'discovery_poll',
          status: 'stopped',
          interval_seconds: 300,
          last_started_at: '2026-11-27T11:40:00.000Z',
          last_completed_at: '2026-11-27T11:40:04.000Z',
          next_run_at: null,
          last_duration_ms: 4000,
          last_run_stats: { inserted: 2, updated: 5, skipped: 10 },
          last_error: null,
        },
      ],
    })
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }) as Response)

    renderAdminApp('/admin')

    expect(await screen.findByTestId('process-liveness-badge')).toHaveTextContent('STOPPED')
    expect(screen.getByTestId('process-stopped-at')).toHaveTextContent('Stopped At:')
    expect(screen.getByTestId('loop-countdown-discovery_poll')).toHaveTextContent('—')
  })

  it('renders Telemetry Unavailable degraded notice cleanly when telemetry_available is false', async () => {
    const payload = makeHealthyPayload({
      telemetry_available: false,
      process: {
        effective_status: 'unavailable',
        raw_status: null,
        run_mode: null,
        host: null,
        pid: null,
        heartbeat_interval_seconds: null,
        stale_threshold_seconds: 90,
        started_at: null,
        last_heartbeat_at: null,
        stopped_at: null,
      },
      loops: [],
    })
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }) as Response)

    renderAdminApp('/admin')

    expect(await screen.findByTestId('process-liveness-badge')).toHaveTextContent(
      'TELEMETRY UNAVAILABLE'
    )
    expect(screen.getByTestId('telemetry-unavailable-banner')).toHaveTextContent(
      'Telemetry Unavailable'
    )
    expect(screen.queryByTestId('pipeline-loop-grid')).not.toBeInTheDocument()
  })

  it('ticks scheduled loop countdowns every 1 second and clamps to Due now without negative seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(BASE_NOW))

    const payload = makeHealthyPayload({
      loops: [
        {
          loop_name: 'discovery_poll',
          status: 'sleeping',
          interval_seconds: 300,
          last_started_at: '2026-11-27T11:55:00.000Z',
          last_completed_at: '2026-11-27T11:55:03.000Z',
          next_run_at: '2026-11-27T12:00:03.000Z',
          last_duration_ms: 3000,
          last_run_stats: { inserted: 1, updated: 0, skipped: 0 },
          last_error: null,
        },
        {
          loop_name: 'tracking_poll',
          status: 'running',
          interval_seconds: 900,
          last_started_at: '2026-11-27T11:59:59.000Z',
          last_completed_at: '2026-11-27T11:45:00.000Z',
          next_run_at: null,
          last_duration_ms: 2100,
          last_run_stats: { inserted: 0, updated: 10, skipped: 5 },
          last_error: null,
        },
      ],
    })
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }) as Response)

    renderAdminApp('/admin')

    await act(async () => {
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    const countdown = screen.getByTestId('loop-countdown-discovery_poll')
    expect(countdown).toHaveTextContent('3s')
    expect(screen.getByTestId('loop-countdown-tracking_poll')).toHaveTextContent('Running...')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(countdown).toHaveTextContent('2s')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(countdown).toHaveTextContent('1s')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(countdown).toHaveTextContent('Due now')

    // Advance 5 more seconds — must remain clamped at "Due now" and never go negative
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(countdown).toHaveTextContent('Due now')
    expect(countdown.textContent).not.toMatch(/-\d+s/)
  })

  it('auto-refreshes every 15 seconds while visible, pauses when tab is hidden, and supports manual Refresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(BASE_NOW))

    let adminCalls = 0
    stubAdminFetch(() => {
      adminCalls += 1
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeHealthyPayload()),
      } as Response
    })

    renderAdminApp('/admin')

    await act(async () => {
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(adminCalls).toBe(1)

    // Advance 15s while visible -> triggers 2nd poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(adminCalls).toBe(2)

    // Hide browser tab -> polling pauses for 30s
    await act(async () => {
      setDocumentVisibility('hidden')
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(adminCalls).toBe(2)

    // Manual Refresh button triggers immediate fetch
    const refreshBtn = screen.getByTestId('admin-refresh-btn')
    await act(async () => {
      fireEvent.click(refreshBtn)
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(adminCalls).toBe(3)
  })

  it('renders loading skeletons while pending and Coral error banner with Retry recovery', async () => {
    let resolveFirst!: (resp: Response) => void
    let attempt = 0

    stubAdminFetch(() => {
      attempt += 1
      if (attempt === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeHealthyPayload()),
      } as Response
    })

    renderAdminApp('/admin')

    // Skeleton visible while first request is in flight
    expect(screen.getByTestId('admin-loading-skeleton')).toBeInTheDocument()

    // First request fails with HTTP 500 -> Coral error banner renders
    await act(async () => {
      resolveFirst({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Internal error' }),
      } as Response)
    })

    const errorBanner = await screen.findByTestId('admin-error-banner')
    expect(errorBanner).toHaveAttribute('role', 'alert')
    expect(errorBanner).toHaveTextContent('Failed to load Pipeline Admin telemetry')

    // Clicking Retry recovers and displays ONLINE status
    fireEvent.click(screen.getByTestId('admin-retry-btn'))
    expect(await screen.findByTestId('process-liveness-badge')).toHaveTextContent('ONLINE')
    expect(screen.queryByTestId('admin-error-banner')).not.toBeInTheDocument()
  })
})
