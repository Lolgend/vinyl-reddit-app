import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { PipelineAdmin } from '../pages/PipelineAdmin'
import type { AdminPipelineResponse, ExtractionQueueStatus } from '../types/admin'

const BASE_NOW = '2026-11-27T12:00:00.000Z'

function makeExtractionQueue(
  overrides: Partial<ExtractionQueueStatus> = {}
): ExtractionQueueStatus {
  return {
    pending: 3,
    extracted_releases: 412,
    filtered_non_releases: 85,
    total: 500,
    completion_pct: 99.4,
    oldest_pending_at: '2026-11-27T11:42:00.000Z',
    pending_items: [
      {
        id: 't3_old1',
        title: '[PRE-ORDER] Radiohead - In Rainbows (Limited Color Vinyl)',
        flair: 'PRE-ORDER',
        url: 'https://reddit.com/r/vinylreleases/comments/old1',
        created_utc: '2026-11-27T11:42:00.000Z',
        ingested_at: '2026-11-27T11:43:00.000Z',
      },
      {
        id: 't3_mid2',
        title: 'Khruangbin - A LA SALA (Indie Exclusive)',
        flair: null,
        url: 'https://reddit.com/r/vinylreleases/comments/mid2',
        created_utc: '2026-11-27T11:51:00.000Z',
        ingested_at: '2026-11-27T11:52:00.000Z',
      },
      {
        id: 't3_new3',
        title: 'Fontaines D.C. - Romance (Rough Trade Exclusive)',
        flair: 'RESTOCK',
        url: 'https://reddit.com/r/vinylreleases/comments/new3',
        created_utc: '2026-11-27T11:58:00.000Z',
        ingested_at: '2026-11-27T11:59:00.000Z',
      },
    ],
    ...overrides,
  }
}

function makePayload(
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
    loops: [],
    extraction_queue: makeExtractionQueue(),
    enrichment_queue: null,
    runs: [],
    ...overrides,
  }
}

function stubFetch(payload: AdminPipelineResponse) {
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
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAdmin() {
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

describe('Pipeline Admin Extraction Queue (#43)', () => {
  it('renders Extraction Queue summary card with 3-segment stacked progress bar, legend counts, completion pct, and queue lag', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(BASE_NOW))

    stubFetch(makePayload())
    renderAdmin()

    const card = await screen.findByTestId('extraction-queue-card')
    expect(card).toHaveTextContent('Extraction Queue')
    expect(card).toHaveTextContent('99.4%')
    expect(card).toHaveTextContent('500')

    const extractedSeg = within(card).getByTestId('extraction-bar-extracted')
    const filteredSeg = within(card).getByTestId('extraction-bar-filtered')
    const pendingSeg = within(card).getByTestId('extraction-bar-pending')

    expect(extractedSeg).toHaveClass('bg-hype-high')
    expect(filteredSeg).toHaveClass('bg-accent-sand')
    expect(pendingSeg).toHaveClass('bg-hype-moderate')
    expect(extractedSeg.style.width).toBe('82.4%')
    expect(filteredSeg.style.width).toBe('17%')
    expect(pendingSeg.style.width).toBe('0.6%')

    const legend = within(card).getByTestId('extraction-queue-legend')
    expect(legend).toHaveTextContent('Extracted Releases')
    expect(legend).toHaveTextContent('412')
    expect(legend).toHaveTextContent('Filtered Non-Releases')
    expect(legend).toHaveTextContent('85')
    expect(legend).toHaveTextContent('Pending')
    expect(legend).toHaveTextContent('3')

    const lag = within(card).getByTestId('extraction-queue-lag')
    expect(lag).toHaveTextContent('18m')
  })

  it('renders inspectable Pending Extractions table with title, flair, posted timestamp, waiting duration, and overflow count', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(BASE_NOW))

    stubFetch(
      makePayload({
        extraction_queue: makeExtractionQueue({
          pending: 42,
          total: 539,
          completion_pct: 92.2,
        }),
      })
    )
    renderAdmin()

    const tableSection = await screen.findByTestId('pending-extractions-table')
    expect(tableSection).toHaveTextContent('Pending Extractions')
    expect(tableSection).toHaveTextContent('42 PENDING')
    expect(tableSection).toHaveTextContent('Showing oldest 3 of 42 pending')

    const rows = within(tableSection).getAllByTestId('pending-extraction-row')
    expect(rows).toHaveLength(3)

    // Row 0: oldest pending item with flair & external link
    expect(rows[0]).toHaveTextContent(
      '[PRE-ORDER] Radiohead - In Rainbows (Limited Color Vinyl)'
    )
    expect(rows[0]).toHaveTextContent('PRE-ORDER')
    expect(rows[0]).toHaveTextContent('18m ago')
    expect(rows[0]).toHaveTextContent('18m')
    const link = within(rows[0]).getByRole('link', {
      name: /Radiohead - In Rainbows/i,
    })
    expect(link).toHaveAttribute(
      'href',
      'https://reddit.com/r/vinylreleases/comments/old1'
    )
    expect(link).toHaveAttribute('target', '_blank')

    // Row 1: null flair renders clean dash fallback
    expect(rows[1]).toHaveTextContent('Khruangbin - A LA SALA (Indie Exclusive)')
    expect(rows[1]).toHaveTextContent('—')
    expect(rows[1]).toHaveTextContent('9m')

    // Row 2: newest pending item
    expect(rows[2]).toHaveTextContent('Fontaines D.C. - Romance (Rough Trade Exclusive)')
    expect(rows[2]).toHaveTextContent('RESTOCK')
    expect(rows[2]).toHaveTextContent('2m')
  })

  it('renders 0 PENDING EXTRACTIONS empty state and clear footer when queue has no pending items', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(BASE_NOW))

    stubFetch(
      makePayload({
        extraction_queue: makeExtractionQueue({
          pending: 0,
          extracted_releases: 412,
          filtered_non_releases: 88,
          total: 500,
          completion_pct: 100.0,
          oldest_pending_at: null,
          pending_items: [],
        }),
      })
    )
    renderAdmin()

    const card = await screen.findByTestId('extraction-queue-card')
    expect(card).toHaveTextContent('100.0%')
    expect(within(card).queryByTestId('extraction-queue-lag')).not.toBeInTheDocument()
    expect(within(card).getByTestId('extraction-queue-clear')).toBeInTheDocument()

    const tableSection = screen.getByTestId('pending-extractions-table')
    expect(tableSection).toHaveTextContent('0 PENDING')
    expect(within(tableSection).getByTestId('pending-extractions-empty')).toHaveTextContent(
      '0 PENDING EXTRACTIONS'
    )
    expect(within(tableSection).queryAllByTestId('pending-extraction-row')).toHaveLength(0)
  })

  it('keeps Extraction Queue card and Pending Extractions table rendered when telemetry_available is false', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(BASE_NOW))

    stubFetch(
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
        loops: [],
        extraction_queue: makeExtractionQueue(),
      })
    )
    renderAdmin()

    expect(await screen.findByTestId('telemetry-unavailable-banner')).toHaveTextContent(
      'Telemetry Unavailable'
    )
    expect(screen.getByTestId('extraction-queue-card')).toHaveTextContent('99.4%')
    const tableSection = screen.getByTestId('pending-extractions-table')
    expect(within(tableSection).getAllByTestId('pending-extraction-row')).toHaveLength(3)
  })
})
