"""Pydantic v2 response schemas for the Pipeline Admin (/admin) endpoint."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

EffectiveProcessStatus = Literal["online", "stopped", "offline", "unavailable"]
LoopName = Literal[
    "discovery_poll",
    "tracking_poll",
    "extraction_worker",
    "enrichment_worker",
]
LoopStatus = Literal["running", "sleeping", "error", "stopped", "disabled"]
RunOutcome = Literal["success", "error"]
FailedEnrichmentState = Literal["due", "backoff", "exhausted"]


class PipelineProcessInfo(BaseModel):
    effective_status: EffectiveProcessStatus
    raw_status: str | None = None
    run_mode: str | None = None
    host: str | None = None
    pid: int | None = None
    heartbeat_interval_seconds: int | None = None
    stale_threshold_seconds: int = 90
    started_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    stopped_at: datetime | None = None


class PipelineLoopInfo(BaseModel):
    loop_name: LoopName
    status: LoopStatus
    interval_seconds: int
    last_started_at: datetime | None = None
    last_completed_at: datetime | None = None
    next_run_at: datetime | None = None
    last_duration_ms: int | None = None
    last_run_stats: dict[str, int] | None = None
    last_error: str | None = None


class PendingExtractionItem(BaseModel):
    id: str
    title: str
    flair: str | None = None
    url: str
    created_utc: datetime
    ingested_at: datetime


class ExtractionQueueStatus(BaseModel):
    pending: int
    extracted_releases: int
    filtered_non_releases: int
    total: int
    completion_pct: float
    oldest_pending_at: datetime | None = None
    pending_items: list[PendingExtractionItem] = Field(default_factory=list)


class FailedEnrichmentItem(BaseModel):
    album_id: str
    combined_artist: str
    album_title: str
    enrichment_attempts: int
    max_attempts: int = 5
    enrichment_error: str | None = None
    last_enriched_at: datetime | None = None
    next_retry_at: datetime | None = None
    state: FailedEnrichmentState


class EnrichmentQueueStatus(BaseModel):
    pending: int
    matched: int
    partial_matched: int
    partial_matched_due: int
    not_found: int
    failed_due: int
    failed_backoff: int
    failed_exhausted: int
    failed_total: int
    total: int
    resolved_pct: float
    failed_items: list[FailedEnrichmentItem] = Field(default_factory=list)


class PipelineRunItem(BaseModel):
    id: int
    stage: LoopName
    outcome: RunOutcome
    started_at: datetime
    completed_at: datetime
    duration_ms: int
    stats: dict[str, int] | None = None
    error_message: str | None = None
    host: str | None = None
    pid: int | None = None


class AdminPipelineResponse(BaseModel):
    server_time: datetime
    telemetry_available: bool
    process: PipelineProcessInfo
    loops: list[PipelineLoopInfo] = Field(default_factory=list)
    extraction_queue: ExtractionQueueStatus | None = None
    enrichment_queue: EnrichmentQueueStatus | None = None
    runs: list[PipelineRunItem] = Field(default_factory=list)
