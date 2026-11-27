# Vinyl Demand & Intelligence Domain

Domain vocabulary for source-agnostic vinyl retail procurement intelligence, demand forecasting, community hype tracking, and release discography navigation.

## Language

**Album**:
A canonical musical work derived by grouping physical releases sharing a normalized `(Combined Artist, album_title)` identity, with edition or anniversary descriptors stripped into `Variant`. Aggregates community demand metrics across the deduplicated union of `Mention`s linked to any of its child `Release`s so multi-variant announcements are never double-counted.
_Avoid_: Title, record, LP, project

**Release**:
A distinct physical vinyl pressing or commercial edition of an `Album`, uniquely identified by `(combined_artist, album_title, variant, retailer_name)`. Aggregates community demand metrics solely from the `Mention`s linked to that specific pressing.
_Avoid_: Record, vinyl, drop, product, SKU

**Artist**:
An individual musical creator, performer, composer, or band contributing to a release. Multi-artist releases associate each contributing artist individually alongside a combined billing.
_Avoid_: Creator, musician, singer

**Combined Artist**:
The collaborative or split billing representation of multiple artists on a single release or album (e.g., `Converge / Dropdead` or `Kanye West & Ty Dolla $ign`); surfaced in the UI under the `Collaboration` credit label.
_Avoid_: Dual artist, joint name, multi-band

**Variant**:
A specific physical pressing variation of a release, such as color pressing, vinyl weight (e.g., 180g), packaging type, or limited edition pressing count.
_Avoid_: Edition, colorway, version

**Retailer**:
The exclusive retail storefront, record store, webstore, or label issuing or distributing a specific release (e.g., `Rough Trade`, `Blood Records`, `Target`, `VMP`).
_Avoid_: Store, seller, merchant, vendor

**Mention**:
A tracked community post, forum thread, article, or listing from any supported source representing an announcement, pre-order, discussion, or restock reference for a `Release`.
_Avoid_: Submission, post, thread, article, listing

**Mention Snapshot**:
A point-in-time timestamped observation of a `Mention`'s engagement metrics (`score`, `upvote_ratio`, `num_comments`, `captured_at`) used to construct activity time series and internal velocity calculations.
_Avoid_: Metric check, poll log, vote record, submission snapshot

**Hype Velocity**:
Internal scoring signal measuring the window-scoped rate of change of composite community engagement across an active `Hype Window`, aggregated across the deduplicated union of `Mention`s linked to a `Release`, `Album`, or `Artist`. Used as an input to `Hype Index` and not displayed directly in the UI.
_Avoid_: Popularity speed, vote rate, hype momentum, peak hype velocity

**Hype Index**:
A normalized composite score ($0–100$) that balances internal `Hype Velocity`, cumulative window engagement, and sentiment/ratio signals with window-scaled freshness decay over time.
_Avoid_: Trending score, rank score, hotness

**Hype Window**:
A defined historical activity window (`24H`, `7D`, `1M` / `30D`) across which `Mention Snapshot` deltas and newly tracked `Mention`s are evaluated to compute `Hype Index` and activity curves across leaderboards, directory views, and entity detail screens.
_Avoid_: Timeframe, leader period, date range

**Engagement**:
Observed community activity around an `Album`, `Release`, or `Artist`—such as votes, comments, and mention volume—presented alongside `Hype Index` as concrete demand evidence.
_Avoid_: Reddit Demand, Statistics, Submission Metrics, Telemetry

**Last Seen**:
The timestamp of the most recent tracked community mention referencing an `Album`, `Release`, or `Artist`, displayed at the top level of entity detail views to contextualize low or zero `Hype Index` readings when no recent window activity has occurred.
_Avoid_: Last scraped, last updated, last polled, last snapshot

## Pipeline Operations

Canonical operational vocabulary for internal monitoring screens and cross-repo pipeline contracts. Buyer-facing screens remain strictly source-agnostic and use the domain terms above.

**Pipeline**:
The end-to-end automated background workflow that discovers community posts, extracts structured catalog entities, and reconciles external discography metadata.
_Avoid_: Ingestion pipeline, scraper loop

**Discovery Poll**:
A periodic fetch of newly posted community announcements to discover unrecorded mentions and capture initial engagement observations.
_Avoid_: New loop, scrape job

**Tracking Poll**:
A periodic fetch of active community threads to refresh engagement metrics, status tags, and point-in-time observations.
_Avoid_: Hot loop, refresh job

**Extraction Queue**:
Release-eligible community posts waiting to be parsed into `Album`, `Release`, and `Artist` catalog records.
_Avoid_: Parse queue, LLM backlog

**Enrichment Queue**:
Catalog `Album` records waiting for or retrying external discography matching and metadata reconciliation.
_Avoid_: Discogs backlog, matching queue

**Pipeline Heartbeat**:
A periodic liveness signal emitted by a running `Pipeline` process to distinguish an active or sleeping worker from a crashed or stopped one.
_Avoid_: Ping, keepalive

**Pipeline Run**:
An individual execution of a `Pipeline` loop recording its start and completion timestamps, outcome, throughput counts, and any failure details.
_Avoid_: Job log, cycle history, batch record
