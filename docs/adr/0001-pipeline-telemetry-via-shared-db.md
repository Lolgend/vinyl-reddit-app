---
status: accepted
---

# Pipeline Telemetry via Shared PostgreSQL Tables

To surface live `Pipeline` liveness, loop schedules (`next_run_at`), and `Pipeline Run` history on the unguarded `/admin` dashboard without coupling processes or weakening `vinyl-reddit-app`'s strictly read-only database boundary, `vinyl-reddit-scrape` will own and write operational telemetry tables in the shared PostgreSQL database, and `vinyl-reddit-app` will read them strictly read-only alongside existing `submissions` and `albums` queue state. The `/admin` dashboard remains strictly read-only observability with no write or trigger controls.

## Considered Options

- **Scraper-owned PostgreSQL telemetry tables (chosen)**: Preserves process decoupling and `vinyl-reddit-app`'s read-only SQLAlchemy invariant (`postgresql_readonly=True`), requires zero inter-service networking/ports, and delivers exact loop timers, heartbeats, and run history.
- **Read-only heuristics from `submission_snapshots`**: Requires no scraper changes, but cannot distinguish `Discovery Poll` (`/new`) from `Tracking Poll` (`/hot`), reflect custom CLI intervals, or detect a stopped or crashed `Pipeline`.
- **Direct HTTP/IPC status endpoint on `vinyl-reddit-scrape`**: Adds service-to-service network coupling, port management, and availability dependencies between two otherwise database-decoupled processes.

## Consequences

- Creates a cross-repo schema contract owned by `vinyl-reddit-scrape` (migrations/DDL live there) and consumed read-only by `vinyl-reddit-app` via the shared `reddit-scrape` package dependency.
- `vinyl-reddit-app` must degrade gracefully when telemetry tables are not yet migrated or empty, still displaying database-derived `Extraction Queue` and `Enrichment Queue` metrics.
- Assumes a single active `Pipeline` process (recording `host` and `pid` for transparency) with 30-day retention on `Pipeline Run` history.
