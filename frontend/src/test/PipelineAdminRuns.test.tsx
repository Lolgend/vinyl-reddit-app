import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { PipelineAdmin } from '../pages/PipelineAdmin'
import type { AdminPipelineResponse, PipelineRunItem } from '../types/admin'

const BASE_NOW = '2026-11-27T12:00:00.000Z'

const SAMPLE_RUNS: PipelineRunItem[] = [
  {
    id: 981,
    stage: 'discovery_poll',
    outcome: 'success',
    started_at: '2026-11-27T11:55:00.000Z',
    completed_at: '2026-11-27T11:55:03.000Z',
    duration_ms: 3000,
    stats: { inserted: 4, updated: 12, skipped: 34 },
    error_message: null,
    host: 'scraper-host-01',
    pid: 12345,
  },
  {
    id: 980,
    stage: 'tracking_poll',
    outcome: 'error',
    started_at: '2026-11-27T11:50:00.000Z',
    completed_at: '2026-11-27T11:50:01.200Z',
    duration_ms: 1200,
    stats: null,
    error_message: 'Reddit HTTP 429 rate limited',
    host: 'scraper-host-01',
    pid: 12345,
  },
  {
    id: 979,
    stage: 'extraction_worker',
    outcome: 'success',
    started_at: '2026-11-27T11:48:00.000Z',
    completed_at: '2026-11-27T11:48:00.850Z',
    duration_ms: 850,
    stats: { extracted: 7 },
    error_message: null,
    host: 'scraper-host-01',
    pid: 12345,
  },
  {
    id: 978,
    stage: 'enrichment_worker',
    outcome: 'success',
    started_at: '2026-11-27T11:40:00.000Z',
    completed_at: '2026-11-27T11:40:06.500Z',
    duration_ms: 6500,
    stats: { enriched: 3 },
    error_message: null,
    host: 'scraper-host-01',
    pid: 12345,
  },
]

function makePayload(overrides: Partial<AdminPipelineResponse> = {}): AdminPipelineResponse {
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
    loops: [],
    extraction_queue: null,
    enrichment_queue: null,
    runs: SAMPLE_RUNS,
    ...overrides,
  }
}

function stubAdminFetch(responder: (url: string) => Response | Promise<Response>) {
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
      return Promise.resolve(responder(url))
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

function renderAdminApp() {
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
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="admin" element={<PipelineAdmin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Pipeline Admin — Recent Pipeline Runs Table (#45)', () => {
  it('renders Recent Pipeline Runs table with stage, outcome badges, timestamps, durations, throughput stats, and error summary', async () => {
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(makePayload()),
    }) as Response)

    renderAdminApp()

    const runsSection = await screen.findByTestId('pipeline-runs-table')
    expect(
      within(runsSection).getByRole('heading', { name: /Recent Pipeline Runs/i })
    ).toBeInTheDocument()

    const row981 = within(runsSection).getByTestId('pipeline-run-row-981')
    expect(row981).toHaveTextContent('Discovery Poll')
    expect(within(row981).getByTestId('run-outcome-badge')).toHaveTextContent(/Success/i)
    expect(within(row981).getByTestId('run-outcome-badge')).toHaveClass('bg-hype-high')
    expect(row981).toHaveTextContent('3.0s')
    expect(row981).toHaveTextContent('4 inserted · 12 updated · 34 skipped')

    const row980 = within(runsSection).getByTestId('pipeline-run-row-980')
    expect(row980).toHaveTextContent('Tracking Poll')
    expect(within(row980).getByTestId('run-outcome-badge')).toHaveTextContent(/Error/i)
    expect(within(row980).getByTestId('run-outcome-badge')).toHaveClass('bg-alert-coral')
    expect(row980).toHaveTextContent('1.2s')
    expect(row980).toHaveTextContent('Reddit HTTP 429 rate limited')

    const row979 = within(runsSection).getByTestId('pipeline-run-row-979')
    expect(row979).toHaveTextContent('Extraction')
    expect(row979).toHaveTextContent('850ms')
    expect(row979).toHaveTextContent('7 extracted')

    const row978 = within(runsSection).getByTestId('pipeline-run-row-978')
    expect(row978).toHaveTextContent('Enrichment')
    expect(row978).toHaveTextContent('6.5s')
    expect(row978).toHaveTextContent('3 enriched')
  })

  it('updates GET /api/v1/admin/pipeline query parameters and rendered rows when Stage and Outcome pills are selected', async () => {
    const requestedUrls: string[] = []
    stubAdminFetch((url) => {
      requestedUrls.push(url)
      const parsed = new URL(url, 'http://localhost')
      const stage = parsed.searchParams.get('run_stage')
      const outcome = parsed.searchParams.get('run_outcome')

      const filtered = SAMPLE_RUNS.filter((run) => {
        if (stage && run.stage !== stage) return false
        if (outcome && run.outcome !== outcome) return false
        return true
      })

      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(makePayload({ runs: filtered })),
      } as Response
    })

    renderAdminApp()

    const runsSection = await screen.findByTestId('pipeline-runs-table')
    expect(within(runsSection).getByTestId('pipeline-run-row-981')).toBeInTheDocument()
    expect(within(runsSection).getByTestId('pipeline-run-row-980')).toBeInTheDocument()

    // Select Stage = Tracking Poll
    const trackingPill = within(runsSection).getByTestId('runs-stage-pill-tracking_poll')
    fireEvent.click(trackingPill)
    expect(trackingPill).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      expect(requestedUrls.some((u) => u.includes('run_stage=tracking_poll'))).toBe(true)
    })
    await waitFor(() => {
      expect(within(runsSection).queryByTestId('pipeline-run-row-981')).not.toBeInTheDocument()
    })
    expect(within(runsSection).getByTestId('pipeline-run-row-980')).toBeInTheDocument()

    // Also select Outcome = Error -> both params sent
    const errorPill = within(runsSection).getByTestId('runs-outcome-pill-error')
    fireEvent.click(errorPill)
    expect(errorPill).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      expect(
        requestedUrls.some(
          (u) => u.includes('run_stage=tracking_poll') && u.includes('run_outcome=error')
        )
      ).toBe(true)
    })
    expect(within(runsSection).getByTestId('pipeline-run-row-980')).toBeInTheDocument()
    expect(within(runsSection).getByTestId('pipeline-runs-count')).toHaveTextContent('1 RUN')

    // Switch Stage back to All while keeping Outcome = Error
    fireEvent.click(within(runsSection).getByTestId('runs-stage-pill-all'))
    await waitFor(() => {
      expect(
        requestedUrls.some(
          (u) => !u.includes('run_stage=') && u.includes('run_outcome=error')
        )
      ).toBe(true)
    })
    expect(within(runsSection).getByTestId('pipeline-run-row-980')).toBeInTheDocument()
  })

  it('renders Neo-Brutalist empty state with Reset Filters CTA when active filters match 0 runs', async () => {
    const requestedUrls: string[] = []
    stubAdminFetch((url) => {
      requestedUrls.push(url)
      const parsed = new URL(url, 'http://localhost')
      const stage = parsed.searchParams.get('run_stage')
      const outcome = parsed.searchParams.get('run_outcome')

      const filtered = SAMPLE_RUNS.filter((run) => {
        if (stage && run.stage !== stage) return false
        if (outcome && run.outcome !== outcome) return false
        return true
      })

      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(makePayload({ runs: filtered })),
      } as Response
    })

    renderAdminApp()

    const runsSection = await screen.findByTestId('pipeline-runs-table')

    // Extraction + Error matches 0 rows in SAMPLE_RUNS
    fireEvent.click(within(runsSection).getByTestId('runs-stage-pill-extraction_worker'))
    fireEvent.click(within(runsSection).getByTestId('runs-outcome-pill-error'))

    const emptyFiltered = await within(runsSection).findByTestId('pipeline-runs-empty-filtered')
    expect(emptyFiltered).toHaveTextContent(/0 Matching Runs/i)
    expect(emptyFiltered).toHaveTextContent(/Stage: Extraction/i)
    expect(emptyFiltered).toHaveTextContent(/Outcome: Error/i)

    // Clicking Reset Filters restores unfiltered query and rows
    const resetBtn = within(emptyFiltered).getByTestId('pipeline-runs-reset-filters-btn')
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(within(runsSection).getByTestId('pipeline-run-row-981')).toBeInTheDocument()
    })
    expect(within(runsSection).getByTestId('runs-stage-pill-all')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(runsSection).getByTestId('runs-outcome-pill-all')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const lastUrl = requestedUrls[requestedUrls.length - 1]
    expect(lastUrl).not.toContain('run_stage=')
    expect(lastUrl).not.toContain('run_outcome=')
  })

  it('renders clean unavailable empty state when telemetry_available is false', async () => {
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          makePayload({
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
            runs: [],
          })
        ),
    }) as Response)

    renderAdminApp()

    const runsSection = await screen.findByTestId('pipeline-runs-table')
    const unavailableEmpty = within(runsSection).getByTestId('pipeline-runs-empty-unavailable')
    expect(unavailableEmpty).toHaveTextContent(/Pipeline Run History Unavailable/i)
    expect(
      within(runsSection).queryByTestId('pipeline-runs-reset-filters-btn')
    ).not.toBeInTheDocument()
  })

  it('renders clean empty state when telemetry is available but no runs are recorded yet', async () => {
    stubAdminFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(makePayload({ runs: [] })),
    }) as Response)

    renderAdminApp()

    const runsSection = await screen.findByTestId('pipeline-runs-table')
    expect(within(runsSection).getByTestId('pipeline-runs-empty-none')).toHaveTextContent(
      /No Pipeline Runs Recorded Yet/i
    )
  })
})
