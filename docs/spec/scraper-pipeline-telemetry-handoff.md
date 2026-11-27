# Implementation Spec: Pipeline Telemetry & Run History (`vinyl-reddit-scrape`)

> **Handoff target**: `vinyl-reddit-scrape` (installed as `reddit-scrape` by `vinyl-reddit-app`).
> **Originating ADR**: [ADR-0001: Pipeline Telemetry via Shared PostgreSQL Tables](../adr/0001-pipeline-telemetry-via-shared-db.md)
> **Shared Glossary**: [GLOSSARY.md — Pipeline Operations](../../GLOSSARY.md#pipeline-operations)

---

## 1. Objective

Extend `vinyl-reddit-scrape` to persist operational telemetry for its four background loops (`Discovery Poll`, `Tracking Poll`, `Extraction Queue` worker, `Enrichment Queue` worker) into the shared PostgreSQL database so `vinyl-reddit-app`'s strictly read-only `/admin` dashboard can display:

1. Whether the single active `Pipeline` process is **Online**, **Stopped**, or **Offline / Stale** (via a 30-second `Pipeline Heartbeat` and `host`/`pid` metadata).
2. The live status (`running`, `sleeping`, `error`, `stopped`, `disabled`), interval, last-run stats, latest error, and exact `next_run_at` timestamp for each loop.
3. A noise-filtered, 30-day retained `Pipeline Run` history log.

### Explicit Non-Goals
- **Do NOT alter existing `submissions`, `submission_snapshots`, `albums`, `releases`, `artists`, `album_artists`, or `submission_releases` schemas.** In particular, leave `submissions` without per-submission extraction error columns; extraction failures are surfaced via loop-level `last_error` and `pipeline_runs`.
- **Do NOT add an HTTP server, IPC socket, or remote control/trigger endpoint.** Communication with `vinyl-reddit-app` is strictly via PostgreSQL tables.
- **Do NOT implement multi-instance distributed locking.** Assume a single active `Pipeline` process (last-writer-wins with `host` and `pid` recorded for visibility).

---

## 2. Canonical Domain Vocabulary

Use these exact canonical terms in models, docstrings, logs, and tests:

| Term | Identifier (`loop_name`) | Meaning |
| :--- | :--- | :--- |
| **Pipeline** | — | End-to-end automated workflow (`PollerService`). |
| **Discovery Poll** | `discovery_poll` | Periodic fetch of `r/vinylreleases/new`. |
| **Tracking Poll** | `tracking_poll` | Periodic fetch of `r/vinylreleases/hot`. |
| **Extraction Queue** | `extraction_worker` | Worker draining unextracted release-eligible `submissions`. |
| **Enrichment Queue** | `enrichment_worker` | Worker draining pending/retryable `albums` via Discogs + web search. |
| **Pipeline Heartbeat** | — | 30s liveness timestamp written by the running `Pipeline` process. |
| **Pipeline Run** | — | An individual recorded execution in `pipeline_runs`. |

---

## 3. Shared PostgreSQL Schema Contract

Add three new SQLAlchemy ORM models to `reddit_scrape/models.py` (registered on `Base.metadata` so `init_db()` creates them automatically via `Base.metadata.create_all(engine)`) and export them in `reddit_scrape.models.__all__` so `vinyl-reddit-app` can import them directly.

### 3.1 Enums (exported from `reddit_scrape.models`)

Use the same Python 3.10-compatible `StrEnum` pattern already used by `EnrichmentState` in `reddit_scrape/models.py`:

- `PipelineProcessState`: `"running"`, `"stopped"`
- `PipelineRunMode`: `"continuous"`, `"once"`
- `PipelineLoopName`: `"discovery_poll"`, `"tracking_poll"`, `"extraction_worker"`, `"enrichment_worker"`
- `PipelineLoopStatus`: `"running"`, `"sleeping"`, `"error"`, `"stopped"`, `"disabled"`
- `PipelineRunStatus`: `"success"`, `"error"`

### 3.2 Table: `pipeline_process_status` (Model: `PipelineProcessStatus`)

Tracks the single active/last `Pipeline` process and its `Pipeline Heartbeat`.

| Column | PostgreSQL Type | Nullable | Default / Notes |
| :--- | :--- | :---: | :--- |
| `process_name` | `VARCHAR(64)` | NO | Primary Key, always `"default"` |
| `status` | `VARCHAR(32)` | NO | `"running"` \| `"stopped"` |
| `run_mode` | `VARCHAR(16)` | NO | `"continuous"` \| `"once"` |
| `host` | `VARCHAR(255)` | NO | `socket.gethostname()` |
| `pid` | `INTEGER` | NO | `os.getpid()` |
| `heartbeat_interval_seconds` | `INTEGER` | NO | `30` (configurable, default `30`) |
| `started_at` | `TIMESTAMPTZ` | NO | Process start UTC timestamp |
| `last_heartbeat_at` | `TIMESTAMPTZ` | NO | Updated every 30s while running & on shutdown |
| `stopped_at` | `TIMESTAMPTZ` | YES | `NULL` while running; set on clean exit / `--once` finish |
| `updated_at` | `TIMESTAMPTZ` | NO | `server_default=func.now()`, `onupdate=func.now()` |

**Consumer liveness rule (for context):** `vinyl-reddit-app` considers the process **Online** when `status == "running"` and `now - last_heartbeat_at <= 3 * heartbeat_interval_seconds` (90s for the 30s default), **Offline / Stale** when `status == "running"` and `now - last_heartbeat_at > 90s`, and **Stopped** when `status == "stopped"`.

### 3.3 Table: `pipeline_loop_states` (Model: `PipelineLoopState`)

Stores the latest state of each of the 4 loops (at most 4 rows total, upserted by `loop_name`).

| Column | PostgreSQL Type | Nullable | Default / Notes |
| :--- | :--- | :---: | :--- |
| `loop_name` | `VARCHAR(32)` | NO | Primary Key (`discovery_poll`, `tracking_poll`, `extraction_worker`, `enrichment_worker`) |
| `status` | `VARCHAR(32)` | NO | `"running"` \| `"sleeping"` \| `"error"` \| `"stopped"` \| `"disabled"` |
| `interval_seconds` | `INTEGER` | NO | Active cadence (`poll_interval_seconds`, `hot_poll_interval_seconds`, `2`, `enrichment_interval_seconds`) |
| `last_started_at` | `TIMESTAMPTZ` | YES | UTC start of most recent execution |
| `last_completed_at` | `TIMESTAMPTZ` | YES | UTC completion of most recent execution |
| `next_run_at` | `TIMESTAMPTZ` | YES | Scheduled next UTC execution time; `NULL` when `running`, `stopped`, `disabled`, or event-driven `extraction_worker` |
| `last_duration_ms` | `INTEGER` | YES | Execution duration in milliseconds (`>= 0`) |
| `last_run_stats` | `JSONB` | YES | Stage-specific throughput dictionary (see §3.5) |
| `last_error` | `TEXT` | YES | Error message from failed execution; reset to `NULL` on next success |
| `updated_at` | `TIMESTAMPTZ` | NO | `server_default=func.now()`, `onupdate=func.now()` |

### 3.4 Table: `pipeline_runs` (Model: `PipelineRun`)

Append-only historical log of `Pipeline Run` executions (30-day retention).

| Column | PostgreSQL Type | Nullable | Default / Notes |
| :--- | :--- | :---: | :--- |
| `id` | `BIGINT` | NO | Primary Key, autoincrement |
| `loop_name` | `VARCHAR(32)` | NO | One of `PipelineLoopName` |
| `status` | `VARCHAR(16)` | NO | `"success"` \| `"error"` |
| `started_at` | `TIMESTAMPTZ` | NO | UTC start of run |
| `completed_at` | `TIMESTAMPTZ` | NO | UTC end of run |
| `duration_ms` | `INTEGER` | NO | Elapsed wall-clock ms (`>= 0`) |
| `stats` | `JSONB` | YES | Stage-specific throughput dictionary (see §3.5) |
| `error_message` | `TEXT` | YES | Populated when `status == "error"`, `NULL` on success |
| `host` | `VARCHAR(255)` | YES | `socket.gethostname()` |
| `pid` | `INTEGER` | YES | `os.getpid()` |

**Required Indexes on `pipeline_runs`:**
- `idx_pipeline_runs_started_at` on `(started_at DESC)`
- `idx_pipeline_runs_loop_started` on `(loop_name, started_at DESC)`
- `idx_pipeline_runs_status_started` on `(status, started_at DESC)`

### 3.5 `stats` / `last_run_stats` JSONB Shapes

Keep keys deterministic so `vinyl-reddit-app` can render structured badges without parsing log strings:

- **`discovery_poll`**: `{"inserted": <int>, "updated": <int>, "skipped": <int>}`
- **`tracking_poll`**: `{"inserted": <int>, "updated": <int>, "skipped": <int>}`
- **`extraction_worker`**: `{"extracted": <int>}`
- **`enrichment_worker`**: `{"enriched": <int>}`

On unhandled error before stats are available, `stats` may be `NULL` (or partial stats if known).

---

## 4. Runtime Lifecycle & Instrumentation Requirements

Isolate telemetry persistence behind a dedicated module (e.g., `reddit_scrape/telemetry.py` with a `PipelineTelemetryRecorder` class taking `session_factory` and optional `clock`/`host`/`pid` dependencies for clean unit testing) and wire it into `PollerService` in `reddit_scrape/service.py`.

### 4.1 Defensive Failure Isolation (Hard Invariant)
- **Telemetry writes must NEVER crash or block the pipeline.** Wrap every telemetry DB write in a `try/except Exception` that logs a warning and returns cleanly, using short, isolated sessions (never sharing a session/transaction with `SubmissionIngester`, `ReleasePersistenceService`, or `CatalogEnrichmentService`).

### 4.2 Process Startup, Heartbeat & Shutdown
1. **Startup (`PollerService.run()`)**:
   - Upsert `pipeline_process_status` (`process_name="default"`): `status="running"`, `run_mode="continuous"`, `host`, `pid`, `heartbeat_interval_seconds=30`, `started_at=now`, `last_heartbeat_at=now`, `stopped_at=NULL`.
   - Seed/upsert all 4 rows in `pipeline_loop_states` with their active `interval_seconds`:
     - `discovery_poll`, `tracking_poll`: `status="sleeping"` (before initial poll starts).
     - `extraction_worker`: `status="sleeping"`, `interval_seconds=2`, `next_run_at=NULL`.
     - `enrichment_worker`: if `self.enrichment_service is None`, set `status="disabled"`, `next_run_at=NULL`; otherwise `status="sleeping"`, `next_run_at=now + enrichment_interval_seconds`.
   - Start a lightweight daemon thread (`PipelineHeartbeat`) that waits on `self._shutdown_event.wait(timeout=heartbeat_interval_seconds)` and updates `pipeline_process_status.last_heartbeat_at = now` every 30s. Using a dedicated thread ensures the heartbeat stays fresh even if a Reddit poll or LLM batch runs longer than 30s.
2. **Graceful Shutdown (`finally:` block in `PollerService.run()`)**:
   - Update `pipeline_process_status`: `status="stopped"`, `stopped_at=now`, `last_heartbeat_at=now`.
   - Update all non-disabled rows in `pipeline_loop_states`: `status="stopped"`, `next_run_at=NULL` (preserving `last_started_at`, `last_completed_at`, `last_duration_ms`, `last_run_stats`, and `last_error`).
3. **Single-Cycle Mode (`PollerService.run_once()`)**:
   - Upsert `pipeline_process_status` with `status="running"`, `run_mode="once"`, `started_at=now`, `last_heartbeat_at=now`, `stopped_at=NULL`.
   - Record each stage's run (`discovery_poll`, `tracking_poll`, `extraction_worker`, `enrichment_worker`) following the same noise rules (§4.4), with `next_run_at=NULL`.
   - In `finally:`, mark `pipeline_process_status` `status="stopped"`, `stopped_at=now`, `last_heartbeat_at=now` and non-disabled loop rows `status="stopped"`, `next_run_at=NULL`.

### 4.3 Per-Loop Transitions & Write-Storm Avoidance

1. **`discovery_poll` & `tracking_poll`** (in `PollerService.run()` initial cycle and scheduled loop):
   - **Before poll**: upsert loop row `status="running"`, `last_started_at=started_at`, `next_run_at=NULL`.
   - **On success**: upsert loop row `status="sleeping"`, `last_completed_at=completed_at`, `next_run_at=completed_at + timedelta(seconds=interval)`, `last_duration_ms`, `last_run_stats={"inserted": ..., "updated": ..., "skipped": ...}`, `last_error=NULL`. Append `pipeline_runs` row (`status="success"`).
   - **On exception**: upsert loop row `status="error"`, `last_completed_at=completed_at`, `next_run_at=completed_at + timedelta(seconds=interval)`, `last_duration_ms`, `last_error=str(exc)`. Append `pipeline_runs` row (`status="error"`, `error_message=str(exc)`).
   - **Timing alignment**: Base `last_new_poll` / `last_hot_poll` on the same completion clock used to compute `next_run_at` so the countdown in `/admin` matches when the next poll actually fires.

2. **`extraction_worker`** (event-driven + 2s fallback poll — **CRITICAL: avoid 2s DB write storm!**):
   - **Do NOT write to PostgreSQL on idle 2-second wakeups when there are 0 unextracted submissions.**
   - Keep `next_run_at=NULL` when sleeping (because extraction runs immediately when triggered by a poll or within 2s of new items appearing).
   - Only transition to `status="running"` once pending candidates are actually found (or when `process_unextracted_submissions` has work to execute).
   - **On completion with `extracted > 0`**: update loop row (`status="sleeping"`, `last_started_at`, `last_completed_at`, `last_duration_ms`, `last_run_stats={"extracted": extracted}`, `last_error=NULL`, `next_run_at=NULL`) and append a `pipeline_runs` row (`status="success"`).
   - **On unhandled exception** (or batch failure): update loop row (`status="error"`, `last_completed_at`, `last_error=str(exc)`, `next_run_at=NULL`) and append a `pipeline_runs` row (`status="error"`).
   - **Note on internal batch errors**: Currently `process_unextracted_submissions()` catches and logs individual batch exceptions without raising. Surface batch/submission error summaries into the extraction run outcome (e.g., record `error` if a batch failed or capture the last error string) so extraction stalls are visible on `/admin` instead of silently looking healthy!

3. **`enrichment_worker`** (60s default cadence + event trigger):
   - When `self.enrichment_service is None`: leave row at `status="disabled"`, `next_run_at=NULL`, no runs logged.
   - Before processing when queued work exists: set `status="running"`, `last_started_at=started_at`, `next_run_at=NULL`.
   - On completion with `enriched > 0`: set `status="sleeping"`, `last_completed_at`, `last_duration_ms`, `last_run_stats={"enriched": enriched}`, `last_error=NULL`, `next_run_at=completed_at + timedelta(seconds=enrichment_interval_seconds)`, and append `pipeline_runs` row (`status="success"`).
   - On idle wakeup (`enriched == 0`, no error): update `next_run_at = now + timedelta(seconds=enrichment_interval_seconds)` on `pipeline_loop_states` (keeps the countdown accurate at 1 lightweight row update per minute) and **do NOT insert a `pipeline_runs` row**.
   - On unhandled exception: set `status="error"`, `last_completed_at`, `last_error=str(exc)`, `next_run_at=completed_at + timedelta(seconds=enrichment_interval_seconds)`, and append `pipeline_runs` row (`status="error"`).

### 4.4 `Pipeline Run` Noise-Filtering Summary

| Loop | Log to `pipeline_runs` on 0 items? | Log on `> 0` items? | Log on error? |
| :--- | :---: | :---: | :---: |
| `discovery_poll` | **Yes** | **Yes** | **Yes** |
| `tracking_poll` | **Yes** | **Yes** | **Yes** |
| `extraction_worker` | **No** | **Yes** | **Yes** |
| `enrichment_worker` | **No** | **Yes** | **Yes** |

---

## 5. Retention & Pruning (30 Days)

Mirror the existing batched deletion pattern in `reddit_scrape/retention.py`:

1. Add `get_default_pipeline_run_retention_days() -> int`: reads `PIPELINE_RUN_RETENTION_DAYS`, falling back to `SNAPSHOT_RETENTION_DAYS`, falling back to `30`.
2. Add `purge_pipeline_runs(session_factory_or_session=None, retention_days=30, batch_size=5000, *, cutoff=None) -> int`: deletes `pipeline_runs` rows where `started_at < cutoff` in committed batches of `batch_size` until 0 remain.
3. **Automatic periodic pruning**: In `PollerService.run()`, invoke `purge_pipeline_runs()` once on startup and then once every 24 hours (defensively wrapped so errors only log a warning).
4. **CLI subcommand**: Add `reddit-scrape purge-pipeline-runs [--days N] [--batch-size N]` in `reddit_scrape/cli.py` (mirroring `purge-snapshots`).

---

## 6. Verification & Acceptance Criteria

Before handing back to `vinyl-reddit-app`:

1. **Schema & Exports**:
   - `init_db()` creates `pipeline_process_status`, `pipeline_loop_states`, and `pipeline_runs` with all required columns and indexes without affecting existing tables.
   - `PipelineProcessStatus`, `PipelineLoopState`, `PipelineRun`, and all 5 enums are exported from `reddit_scrape.models`.
2. **Lifecycle Tests**:
   - Continuous `run()` writes `status="running"` + `host`/`pid`, refreshes `last_heartbeat_at` on the heartbeat cadence, updates `next_run_at` accurately on `discovery_poll`, `tracking_poll`, and `enrichment_worker`, and transitions process + loops to `status="stopped"` with `next_run_at=NULL` on graceful shutdown.
   - `run_once()` records executed stages and exits cleanly with `status="stopped"` and `next_run_at=NULL`.
   - When `enrichment_service is None`, `enrichment_worker` state is `"disabled"` with `next_run_at=NULL`.
3. **Noise-Filtering & Error Tests**:
   - Idle `extraction_worker` wakeups perform **zero** DB writes and create **zero** `pipeline_runs` rows.
   - Idle `enrichment_worker` wakeups refresh `next_run_at` without creating `pipeline_runs` rows.
   - Poll cycles always create `pipeline_runs` rows even when `inserted=0, updated=0`.
   - Loop exceptions record `status="error"`, populate `last_error` / `error_message`, schedule the next retry timestamp (in continuous mode), and clear `last_error` on the next successful run.
   - Simulated telemetry DB failure logs a warning and does **not** abort polling, extraction, or enrichment.
4. **Retention Tests**:
   - `purge_pipeline_runs` deletes rows older than `retention_days` in chunks while preserving newer rows.
5. **Cross-Repo Sync Note**:
   - After merging in `vinyl-reddit-scrape`, `vinyl-reddit-app/backend` will refresh its local `reddit-scrape` dependency (`uv sync --reinstall-package reddit-scrape`) so it imports the new ORM models cleanly.
