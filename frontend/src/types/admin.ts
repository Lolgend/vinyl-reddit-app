export type EffectiveProcessStatus = 'online' | 'stopped' | 'offline' | 'unavailable'

export type LoopName =
  | 'discovery_poll'
  | 'tracking_poll'
  | 'extraction_worker'
  | 'enrichment_worker'

export type LoopStatus = 'running' | 'sleeping' | 'error' | 'stopped' | 'disabled'

export type RunOutcome = 'success' | 'error'

export type FailedEnrichmentState = 'due' | 'backoff' | 'exhausted'

export interface PipelineProcessInfo {
  effective_status: EffectiveProcessStatus
  raw_status: string | null
  run_mode: string | null
  host: string | null
  pid: number | null
  heartbeat_interval_seconds: number | null
  stale_threshold_seconds: number
  started_at: string | null
  last_heartbeat_at: string | null
  stopped_at: string | null
}

export interface PipelineLoopInfo {
  loop_name: LoopName
  status: LoopStatus
  interval_seconds: number
  last_started_at: string | null
  last_completed_at: string | null
  next_run_at: string | null
  last_duration_ms: number | null
  last_run_stats: Record<string, number> | null
  last_error: string | null
}

export interface PendingExtractionItem {
  id: string
  title: string
  flair: string | null
  url: string
  created_utc: string
  ingested_at: string
}

export interface ExtractionQueueStatus {
  pending: number
  extracted_releases: number
  filtered_non_releases: number
  total: number
  completion_pct: number
  oldest_pending_at: string | null
  pending_items: PendingExtractionItem[]
}

export interface FailedEnrichmentItem {
  album_id: string
  combined_artist: string
  album_title: string
  enrichment_attempts: number
  max_attempts: number
  enrichment_error: string | null
  last_enriched_at: string | null
  next_retry_at: string | null
  state: FailedEnrichmentState
}

export interface EnrichmentQueueStatus {
  pending: number
  matched: number
  partial_matched: number
  partial_matched_due: number
  not_found: number
  failed_due: number
  failed_backoff: number
  failed_exhausted: number
  failed_total: number
  total: number
  resolved_pct: number
  failed_items: FailedEnrichmentItem[]
}

export interface PipelineRunItem {
  id: number
  stage: LoopName
  outcome: RunOutcome
  started_at: string
  completed_at: string
  duration_ms: number
  stats: Record<string, number> | null
  error_message: string | null
  host: string | null
  pid: number | null
}

export interface AdminPipelineResponse {
  server_time: string
  telemetry_available: boolean
  process: PipelineProcessInfo
  loops: PipelineLoopInfo[]
  extraction_queue: ExtractionQueueStatus | null
  enrichment_queue: EnrichmentQueueStatus | null
  runs: PipelineRunItem[]
}

export interface AdminPipelineQueryParams {
  runStage?: LoopName | null
  runOutcome?: RunOutcome | null
  runLimit?: number
}
