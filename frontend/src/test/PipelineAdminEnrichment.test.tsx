import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { PipelineAdmin } from '../pages/PipelineAdmin'
import type { AdminPipelineResponse, EnrichmentQueueStatus } from '../types/admin'

const BASE_NOW = '2026-11-27T12:00:00.000Z'

function makeEnrichmentQueue(
  overrides: Partial<EnrichmentQueueStatus> = {}
): EnrichmentQueueStatus {
  return {
    pending: 10,
    matched: 210,
    partial_matched: 35,
    partial_matched_due: 6,
    not_found: 40,
    failed_due: 2,
    failed_backoff: 3,
    failed_exhausted: 4,
    failed_total: 9,
    total: 304,
    resolved_pct: 93.8,
    failed_items: [
      {
        album_id: '11111111-2222-3333-4444-555555555555',
        combined_artist: 'Radiohead',
        album_title: 'In Rainbows',
        enrichment_attempts: 5,
        max_attempts: 5,
        enrichment_error: 'Discogs API 429 Too Many Requests',
        last_enriched_at: '2026-11-27T11:00:00.000Z',
        next_retry_at: null,
        state: 'exhausted',
      },
      {
        album_id: '22222222-3333-4444-5555-666666666666',
        combined_artist: 'Portishead',
        album_title: 'Dummy',
        enrichment_attempts: 2,
        max_attempts: 5,
        enrichment_error: 'Upstream 502 Bad Gateway',
        last_enriched_at: '2026-11-27T11:45:00.000Z',
        next_retry_at: '2026-11-27T11:55:00.000Z',
        state: 'due',
      },
      {
        album_id: '33333333-4444-5555-6666-777777777777',
        combined_artist: 'Massive Attack',
        album_title: 'Mezzanine',
        enrichment_attempts: 3,
        max_attempts: 5,
        enrichment_error: 'Read timeout after 10s',
        last_enriched_at: '2026-11-27T11:50:00.000Z',
        next_retry_at: '2026-11-27T12:10:00.000Z',
        state: 'backoff',
      },
    ],
    ...overrides,
  }
}

function makeAdminPayload(
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
    extraction_queue: null,
    enrichment_queue: makeEnrichmentQueue(),
    runs: [],
    ...overrides,
  }
}

function stubAdminFetch(payload: AdminPipelineResponse) {
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
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response)
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

function AlbumDetailStub() {
  const { albumId } = useParams()
  return <div data-testid="album-detail-stub">Album Detail: {albumId}</div>
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
            <Route path="admin" element={<PipelineAdmin />} />
            <Route path="albums/:albumId" element={<AlbumDetailStub />} />
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

describe('Pipeline Admin Enrichment Queue & Failed Albums Inspector (#44)', () => {
  it('renders Enrichment Queue summary card with 5-segment stacked bar, resolution %, counts, and breakdown callouts', async () => {
    stubAdminFetch(makeAdminPayload())

    renderAdminApp('/admin')

    const card = await screen.findByTestId('enrichment-queue-card')
    expect(card).toHaveTextContent('Enrichment Queue')
    expect(screen.getByTestId('enrichment-resolved-pct')).toHaveTextContent('93.8%')

    // 5-segment Neo-Brutalist stacked progress bar with semantic tokens & smooth transitions
    expect(screen.getByTestId('enrichment-bar-matched')).toHaveClass(
      'bg-hype-high',
      'transition-all',
      'duration-300'
    )
    expect(screen.getByTestId('enrichment-bar-partial')).toHaveClass(
      'bg-accent-primary',
      'transition-all',
      'duration-300'
    )
    expect(screen.getByTestId('enrichment-bar-not-found')).toHaveClass(
      'bg-accent-sand',
      'transition-all',
      'duration-300'
    )
    expect(screen.getByTestId('enrichment-bar-pending')).toHaveClass(
      'bg-hype-moderate',
      'transition-all',
      'duration-300'
    )
    expect(screen.getByTestId('enrichment-bar-failed')).toHaveClass(
      'bg-alert-coral',
      'transition-all',
      'duration-300'
    )

    // Exact segment counts
    expect(screen.getByTestId('enrichment-count-matched')).toHaveTextContent('210')
    expect(screen.getByTestId('enrichment-count-partial')).toHaveTextContent('35')
    expect(screen.getByTestId('enrichment-count-not-found')).toHaveTextContent('40')
    expect(screen.getByTestId('enrichment-count-pending')).toHaveTextContent('10')
    expect(screen.getByTestId('enrichment-count-failed')).toHaveTextContent('9')

    // Actionable breakdown callouts
    expect(screen.getByTestId('enrichment-callout-due')).toHaveTextContent('Due Now')
    expect(screen.getByTestId('enrichment-callout-due')).toHaveTextContent('2')
    expect(screen.getByTestId('enrichment-callout-backoff')).toHaveTextContent('In Backoff')
    expect(screen.getByTestId('enrichment-callout-backoff')).toHaveTextContent('3')
    expect(screen.getByTestId('enrichment-callout-exhausted')).toHaveTextContent('Exhausted')
    expect(screen.getByTestId('enrichment-callout-exhausted')).toHaveTextContent('4')
    expect(screen.getByTestId('enrichment-callout-partial-due')).toHaveTextContent(
      'Partial Matched Due'
    )
    expect(screen.getByTestId('enrichment-callout-partial-due')).toHaveTextContent('6')
  })

  it('renders Failed & Exhausted Enrichments table with /albums/:albumId links, N/5 badges, errors, and Exhausted vs next retry states', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(BASE_NOW))
    stubAdminFetch(makeAdminPayload())

    renderAdminApp('/admin')

    await act(async () => {
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    const table = screen.getByTestId('failed-enrichments-table')
    expect(table).toHaveTextContent('Failed & Exhausted Enrichments')

    // Exhausted row (5/5)
    const exhaustedRow = screen.getByTestId(
      'failed-enrichment-row-11111111-2222-3333-4444-555555555555'
    )
    expect(exhaustedRow).toHaveTextContent('In Rainbows')
    expect(exhaustedRow).toHaveTextContent('Radiohead')
    expect(exhaustedRow).toHaveTextContent('5/5')
    expect(exhaustedRow).toHaveTextContent('Discogs API 429 Too Many Requests')
    expect(
      screen.getByTestId('failed-enrichment-state-11111111-2222-3333-4444-555555555555')
    ).toHaveTextContent(/EXHAUSTED/i)

    // Due row (2/5)
    const dueRow = screen.getByTestId(
      'failed-enrichment-row-22222222-3333-4444-5555-666666666666'
    )
    expect(dueRow).toHaveTextContent('Dummy')
    expect(dueRow).toHaveTextContent('Portishead')
    expect(dueRow).toHaveTextContent('2/5')
    expect(dueRow).toHaveTextContent('Upstream 502 Bad Gateway')
    expect(
      screen.getByTestId('failed-enrichment-state-22222222-3333-4444-5555-666666666666')
    ).toHaveTextContent(/DUE NOW/i)

    // Backoff row (3/5) showing remaining retry countdown & computed retry timestamp
    const backoffRow = screen.getByTestId(
      'failed-enrichment-row-33333333-4444-5555-6666-777777777777'
    )
    expect(backoffRow).toHaveTextContent('Mezzanine')
    expect(backoffRow).toHaveTextContent('Massive Attack')
    expect(backoffRow).toHaveTextContent('3/5')
    expect(backoffRow).toHaveTextContent('Read timeout after 10s')
    const backoffRetryCell = screen.getByTestId(
      'failed-enrichment-state-33333333-4444-5555-6666-777777777777'
    )
    expect(backoffRetryCell).toHaveTextContent('10m 00s')

    // Clicking an album link navigates to /albums/:albumId
    const albumLink = screen.getByRole('link', { name: /In Rainbows/i })
    expect(albumLink).toHaveAttribute(
      'href',
      '/albums/11111111-2222-3333-4444-555555555555'
    )
    fireEvent.click(albumLink)
    expect(screen.getByTestId('album-detail-stub')).toHaveTextContent(
      'Album Detail: 11111111-2222-3333-4444-555555555555'
    )
  })

  it('renders 0 FAILED ENRICHMENTS empty state when there are no failed albums', async () => {
    stubAdminFetch(
      makeAdminPayload({
        enrichment_queue: makeEnrichmentQueue({
          failed_due: 0,
          failed_backoff: 0,
          failed_exhausted: 0,
          failed_total: 0,
          total: 295,
          resolved_pct: 96.6,
          failed_items: [],
        }),
      })
    )

    renderAdminApp('/admin')

    const emptyState = await screen.findByTestId('failed-enrichments-empty')
    expect(emptyState).toHaveTextContent('0 FAILED ENRICHMENTS')
  })

  it('keeps Enrichment Queue card and Failed Enrichments table visible when telemetry is unavailable', async () => {
    stubAdminFetch(
      makeAdminPayload({
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
    )

    renderAdminApp('/admin')

    expect(await screen.findByTestId('telemetry-unavailable-banner')).toBeInTheDocument()
    expect(screen.getByTestId('enrichment-queue-card')).toBeInTheDocument()
    expect(screen.getByTestId('enrichment-resolved-pct')).toHaveTextContent('93.8%')
    expect(screen.getByTestId('failed-enrichments-table')).toBeInTheDocument()
    expect(
      screen.getByTestId('failed-enrichment-row-11111111-2222-3333-4444-555555555555')
    ).toHaveTextContent('In Rainbows')
  })

  it('truncates long enrichment_error messages with an accessible per-row Show more / Show less toggle', async () => {
    const longError =
      'Discogs API HTTP 503 Service Unavailable during release lookup for master 987654321: upstream gateway timed out after 30000ms while fetching tracklist and format metadata for pressing.'
    const shortError = 'Discogs API 429 Too Many Requests'

    stubAdminFetch(
      makeAdminPayload({
        enrichment_queue: makeEnrichmentQueue({
          failed_items: [
            {
              album_id: 'long-err-album-id',
              combined_artist: 'Boards of Canada',
              album_title: 'Geogaddi',
              enrichment_attempts: 5,
              max_attempts: 5,
              enrichment_error: longError,
              last_enriched_at: '2026-11-27T11:00:00.000Z',
              next_retry_at: null,
              state: 'exhausted',
            },
            {
              album_id: 'short-err-album-id',
              combined_artist: 'Radiohead',
              album_title: 'Kid A',
              enrichment_attempts: 2,
              max_attempts: 5,
              enrichment_error: shortError,
              last_enriched_at: '2026-11-27T11:45:00.000Z',
              next_retry_at: '2026-11-27T11:55:00.000Z',
              state: 'due',
            },
          ],
        }),
      })
    )

    renderAdminApp('/admin')

    const longErrorEl = await screen.findByTestId('failed-enrichment-error-long-err-album-id')
    const toggleBtn = screen.getByTestId('failed-enrichment-toggle-long-err-album-id')

    // Initially truncated with ellipsis and Show more button
    expect(longErrorEl.textContent).not.toBe(longError)
    expect(longErrorEl.textContent?.endsWith('…')).toBe(true)
    expect(toggleBtn).toHaveTextContent('Show more')
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    // Short error renders in full without a toggle button
    expect(screen.getByTestId('failed-enrichment-error-short-err-album-id')).toHaveTextContent(
      shortError
    )
    expect(
      screen.queryByTestId('failed-enrichment-toggle-short-err-album-id')
    ).not.toBeInTheDocument()

    // Clicking Show more expands full error
    fireEvent.click(toggleBtn)
    expect(longErrorEl).toHaveTextContent(longError)
    expect(toggleBtn).toHaveTextContent('Show less')
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    // Clicking Show less collapses back to truncated preview
    fireEvent.click(toggleBtn)
    expect(longErrorEl.textContent).not.toBe(longError)
    expect(longErrorEl.textContent?.endsWith('…')).toBe(true)
    expect(toggleBtn).toHaveTextContent('Show more')
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
  })
})
