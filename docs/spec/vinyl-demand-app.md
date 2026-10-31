# Technical Specification: Vinyl Demand Intelligence Full-Stack Web Application

## Problem Statement

Vinyl retail procurement buyers and independent record store managers operate under compressed distributor pre-order deadlines and tight allocation quotas. Over-ordering ties up scarce working capital in unsold inventory, while under-ordering misses breakout pressings and viral releases that sell out within hours. Today, retail buyers rely on manual, time-consuming scanning of subreddit threads (`r/vinylreleases`), distributor sell sheets, and subjective intuition. They lack an explainable, quantitative demand forecasting system that translates live community engagement velocity, post momentum, and variant discussions into clear stocking intelligence.

## Solution

A full-stack demand intelligence web application that transforms live `r/vinylreleases` data into an explainable, quantitative retail demand forecasting ledger. Built on a local two-tier architecture pairing a Vite + React 19 + TypeScript single-page application with a high-throughput Python FastAPI backend, the system executes strictly read-only queries against the existing PostgreSQL database populated by `reddit-scrape`. 

The solution delivers:
1. Canonical `Album` and `Artist` identity derivations with deterministic 16-character keys and deduplicated submission rollups.
2. A mathematical scoring engine computing `Hype Velocity`, a log-compressed `Hype Index` ($0–100$) with window-scaled freshness decay, and stepped LOCF time-series curves across $24\text{H}$, $7\text{D}$, and $1\text{M}$ windows.
3. Five reconciled Neo-Brutalist ledger screens (`Demand Dashboard`, `Directory Explorer`, `Album Detail`, `Release Detail`, `Artist Detail`) styled under `DESIGN.md` tokens with deterministic SVG groove monograms and zero external image dependencies.
4. A structured, compound REST API contract (`/api/v1`) with deep service boundaries and reactive URL parameter state synchronization.

---

## User Stories

### Demand Dashboard & Leaderboards
1. As a vinyl retail buyer, I want to view the top 5 trending Albums ranked by `Hype Index` on the Demand Dashboard, so that I can immediately identify the highest-demand catalog titles during weekly buying cycles.
2. As a vinyl retail buyer, I want to switch the Hype Window on the Top Albums leaderboard between $24\text{H}$, $7\text{D}$, and $1\text{M}$ independently, so that I can evaluate both immediate viral spikes and sustained monthly interest.
3. As a vinyl retail buyer, I want to view the top 5 trending physical Releases ranked by `Hype Index` on the Demand Dashboard, so that I can see which specific colorways or retailer exclusives are driving demand.
4. As a record store manager, I want to inspect a dedicated Newly Added Releases leaderboard displaying pressings discovered in the last 24 hours, so that I catch newly announced pre-orders before distributor allocations close.
5. As a vinyl retail buyer, I want each leaderboard card to maintain a uniform 5-row height with visual placeholder rows when fewer than 5 active items exist, so that the dashboard layout never shifts or collapses during quiet periods.
6. As a vinyl retail buyer, I want to browse a full-width Live Release Feed table on the dashboard showing recently active pressings with their variants, retailers, Hype Index, and Hype Velocity, so that I can scan all market activity in a single ledger view.
7. As a vinyl retail buyer, I want to filter the Live Release Feed by text query or sort it by Hype Index, Hype Velocity, or post recency, so that I can focus on the specific titles relevant to my store's genre profile.

### Directory Explorer & Catalog Navigation
8. As a vinyl retail buyer, I want to navigate between Releases, Albums, and Artists tabs in the Directory Explorer, so that I can investigate market demand at any level of the musical hierarchy.
9. As a vinyl retail buyer, I want to see live total entity counts in each directory tab header, so that I know the full breadth of the indexed catalog.
10. As a vinyl retail buyer, I want to toggle between a 3-column card Grid view and a 7-column Table view on the Releases tab, so that I can switch between visual scanning and dense data analysis.
11. As a vinyl retail buyer, I want to filter the Directory Explorer by Hype Index tiers (All, High, Moderate, Low), so that I can isolate top-tier breakouts from cooling releases.
12. As a vinyl retail buyer, I want to filter directory listings by specific Retailers (excluding undefined values), so that I can evaluate releases distributed by specific store partners or webstores.
13. As a record store manager, I want to view derived Albums in the directory showing child release counts, preview variants, and participating retailers, so that I can see all commercial configurations of a title in one place.
14. As a vinyl retail buyer, I want to browse Artists in the directory with their total catalog footprint segmented into Solo and Combined Album counts, so that I can gauge an artist's full commercial history.
15. As a vinyl retail buyer, I want paginated directory navigation with clear page indicators and previous/next controls, so that large catalog queries load smoothly and predictably.

### Album Detail & Pressing Share-of-Demand
16. As a vinyl retail buyer, I want an Album Detail view featuring a 4-cell hero KPI strip (`Hype Index`, `Hype Velocity`, `Reddit Demand`, and `Pressings & Provenance`), so that I can assess an album's market conviction at a glance.
17. As a vinyl retail buyer, I want to see a prominent `Last Seen` relative timestamp in the Album header, so that I know whether demand is live or historical when viewing titles outside the active window.
18. As a vinyl retail buyer, I want to view a stepped time-series chart of cumulative points and velocity with vertical markers indicating Reddit submission timestamps, so that I can see the exact moments that triggered demand surges.
19. As a vinyl retail buyer, I want to see a Child-Release Share-of-Demand breakdown card with horizontal percentage bars, so that I know which specific pressing variant collectors prefer before placing pre-orders.
20. As a record store manager, I want a 7-column Child Releases table on the Album Detail page comparing variants, retailers, demand shares, and individual velocities, so that I can allocate budget across multiple editions accurately.
21. As a vinyl retail buyer, I want to toggle the Hype Window on the Album Detail page and observe the hero KPIs, stepped chart, and child table recalculate synchronously, so that I can inspect trends over different timeframes.

### Release Detail & Reddit Provenance
22. As a vinyl retail buyer, I want a Release Detail view featuring a 4-cell hero KPI strip (`Hype Index`, `Hype Velocity`, `Submission Engagement`, and `Provenance Summary`), so that I can verify community engagement metrics for a specific pressing.
23. As a vinyl retail buyer, I want a Physical Specification card showing variant details, exclusive retailer, parent album link, and first/last seen dates, so that I have complete catalog provenance.
24. As a vinyl retail buyer, I want a stepped engagement curve tracking upvote and comment growth across the active window, so that I can inspect the velocity decay of the pressing.
25. As a vinyl retail buyer, I want a 6-column Reddit submission table listing linked posts with their `t3_...` IDs, scores, upvote ratios, comment counts, and direct Reddit links, so that I can review original community discussions and verify collector sentiment.

### Artist Detail & Discography Intelligence
26. As a vinyl retail buyer, I want an Artist Detail view featuring a 4-cell hero KPI strip (`Hype Index`, `Hype Velocity`, `Catalog Footprint`, and `Reddit Demand`), so that I can measure overall artist following and demand.
27. As a vinyl retail buyer, I want a Tracked Albums table clearly distinguishing Solo releases from Combined Artist collaborative appearances (e.g. split releases), so that I understand the context of each project.
28. As a vinyl retail buyer, I want a comprehensive Child Releases ledger on the Artist Detail page listing all physical pressings across their discography, so that I can identify recurring catalog demand.

### Navigation Shell & Global Search
29. As a vinyl retail buyer, I want a persistent 240px navigation rail providing one-click access to the Demand Dashboard and Directory Explorer, so that I can navigate the application efficiently.
30. As a vinyl retail buyer, I want a global search bar in the top workspace bar accessible via `[⌘K]`, so that I can instantly search for albums, releases, or artists from any screen.
31. As a vinyl retail buyer, I want typing in global search from the Directory Explorer to immediately filter directory records, so that I can search without unnecessary page transitions.
32. As a vinyl retail buyer, I want a top-bar database freshness indicator showing the latest snapshot timestamp (`SOURCE: r/vinylreleases · LAST SNAPSHOT: <rel_time>`), so that I can verify data recency before making buying decisions.
33. As a vinyl retail buyer, I want the active Hype Window parameter (`?window=24H|7D|1M`) preserved in the URL query string across all page navigations, so that my selected analysis timeframe stays consistent as I explore.

### System Safety, Data Integrity & Edge States
34. As a system architect, I want the backend to execute strictly read-only SQL queries with zero migrations or writes against scraper tables, so that the application never disrupts or corrupts the ingestion pipeline.
35. As a vinyl retail buyer, I want single-snapshot posts created within the active window to evaluate to non-zero launch velocity, so that brand-new drops appear immediately on leaderboards.
36. As a vinyl retail buyer, I want albums or releases with zero window activity to display an explainable `0 / 100` score and a flat baseline banner stating `NO NEW ACTIVITY IN <W> — LAST SEEN <REL_TIME>`, so that historical catalog items are not confused with broken data.
37. As a vinyl retail buyer, I want deterministic SVG monograms styled from entity metadata, so that every album, release, and artist has recognizable visual branding without relying on external image APIs.

---

## Implementation Decisions

### 1. Two-Tier Monorepo Architecture & Read-Only Invariants
- **Client Tier**: Vite + React 19 + TypeScript + Tailwind CSS implementing "The Neo-Brutalist Ledger" (`DESIGN.md`). Routing is managed via React Router v7 with URL query parameter synchronization. Server state is managed via TanStack Query v5 with 30s stale time and background revalidation.
- **Backend Tier**: Python 3.10+ managed via `uv`, running FastAPI on Uvicorn worker pools using Starlette's synchronous threadpool execution model.
- **Shared Data Tier**: PostgreSQL 16 + `pgvector` database populated by `../reddit-scrape`. The backend enforces read-only connection parameters:
  - `postgresql_readonly=True` on SQLAlchemy engine configuration.
  - `-c default_transaction_read_only=on` on connection arguments.
  - Zero Alembic migrations or DDL operations in the web application repository.
  - Local path dependency `reddit-scrape = { path = "../reddit-scrape" }` in `backend/pyproject.toml` reusing existing ORM declarations.

### 2. Canonical Entity Identity & Deduplicated Rollups
- **Album Identity Derivation**:
  - Derived dynamically by grouping physical `releases` sharing normalized `(combined_artist, album_title)`.
  - Normalization lowercases, collapses whitespace, and standardizes unicode dashes (`[\u2010-\u2015\u2212]` to `-`).
  - Canonical display casing is extracted deterministically from the earliest-ingested release in each group (`ORDER BY releases.created_at ASC, releases.id ASC LIMIT 1`).
  - URL routing and API keys use a deterministic 16-character SHA-256 hex string:
    ```python
    album_id = hashlib.sha256(f"{norm_artist}|{norm_album}".encode("utf-8")).hexdigest()[:16]
    ```
- **Artist Attribution (Solo vs. Combined)**:
  - An appearance is classified as `Solo` when `normalize_attribute(artists.name) == norm_artist` and the release has exactly 1 linked artist.
  - An appearance is classified as `Combined Artist` when `norm_artist` differs or multiple artists are linked in `release_artists` (e.g. split releases or collaborative projects).
  - Catalog totals cleanly segment into `solo_album_count` and `combined_album_count`.
- **Deduplicated Submission Rollups**:
  - All entity metrics (`submission_count`, total `score`, total `num_comments`, `Hype Velocity`, `Hype Index`) aggregate across the distinct union of release submissions (`WHERE submissions.is_release = TRUE`). Multi-variant announcements are counted exactly once.
- **Nullable Fallbacks**:
  - Unspecified variants render as `"Standard Pressing"` (bordered chip). Unspecified retailers render as `"Wide / Unspecified"` (subdued font). Null values are excluded from directory retailer filter chips.

### 3. Mathematical Scoring Engine & Aggregation Rules
- **Hype Windows**: Supported windows $W \in \{24\text{H}, 7\text{D}, 1\text{M}\}$ with half-life decay constants $\tau_W \in \{12.0\text{h}, 72.0\text{h}, 336.0\text{h}\}$ and chart bucket steps ($24 \times 1\text{h}$, $28 \times 6\text{h}$, $30 \times 1\text{d}$).
- **Composite Engagement Points**:
  $$E = \text{score} + 2 \cdot \text{num\_comments}$$
- **Origin Anchor for Single-Snapshot Posts**:
  - If a post was created inside window ($s.\text{created\_utc} \ge t_0$), anchor baseline to post origin $(E_{\text{base}} = 0, t_{\text{base}} = s.\text{created\_utc})$, guaranteeing immediate launch velocity for new releases with only 1 snapshot.
  - If created before window, anchor to latest snapshot at or before $t_0$.
- **Hype Velocity ($V_{\text{entity}}$)**:
  - Elapsed hours: $\Delta t_s = \max(0.25, (\text{NOW}() - t_{\text{base}})/3600.0)$ with a 15-minute floor measuring to $\text{NOW}()$ so dormant posts cool naturally.
  - Submission velocity: $v_s = \text{round}(\Delta E_s / \Delta t_s, 1)$.
  - Entity velocity: $V_{\text{entity}} = \text{round}(\sum_{s \in U} v_s, 1)$. Standardized under metric label `HYPE VELOCITY` (`+X.X pts/hr`).
- **Hype Index ($0–100$)**:
  - Raw signal: $h_s = (v_s + \Delta E_s / \tau_W) \cdot (0.5 + 0.5 \cdot r_s) \cdot 2^{-a_s / \tau_W}$ where $a_s$ is age in hours and $r_s$ is upvote ratio.
  - Cohort log-normalization with reference floor $H_{\text{floor}} = 25.0$:
    $$\text{HypeIndex} = \min\left(100, \text{round}\left(100.0 \cdot \frac{\ln(1.0 + H_{\text{entity}})}{\max\left(\max_e \ln(1.0 + H_e), \ln(1.0 + 25.0)\right)}\right)\right)$$
  - Tiers: High ($75–100$, Mint `#68D391`), Moderate ($40–74$, Amber `#ECC94B`), Low/Cooling ($0–39$, Ink `#646464`).
- **Stepped LOCF Time-Series Engine**:
  - Uniform $N+1$ boundaries generated via `generate_series`.
  - Values sampled using Last Observation Carried Forward (LOCF) semantics. Stepped velocity calculated per bucket interval.
- **Album Share-of-Demand**:
  - Calculated as percentage of total album engagement points: $\text{share}(r) = \text{round}(100.0 \cdot E_r / \sum E_j, 1)$ with uniform fallback ($100.0 / K$) when total points equal zero.

### 4. REST API Contract (`/api/v1`)
Compound REST endpoints structured under deep service seams:
- `GET /api/v1/dashboard?window={24H|7D|1M}`: Leaderboards (`top_albums`, `top_releases`, `newly_added`) and `live_feed` (7 columns).
- `GET /api/v1/directory/releases`: Paginated release directory with text filter, retailer facet, sorting, and grid/table support.
- `GET /api/v1/directory/albums`: Paginated album directory with release counts and retailer lists.
- `GET /api/v1/directory/artists`: Paginated artist directory with solo and combined catalog counts.
- `GET /api/v1/albums/{album_id}?window={24H|7D|1M}`: Compound album detail with hero KPIs, stepped LOCF chart, share-of-demand bars, and child release table.
- `GET /api/v1/releases/{release_id}?window={24H|7D|1M}`: Physical release specs, snapshot curve, and 6-column Reddit submission provenance table.
- `GET /api/v1/artists/{artist_id}?window={24H|7D|1M}`: Artist footprint, tracked albums matrix with Solo/Combined badges, and child releases table.
- `GET /api/v1/search?q={query}&limit=5`: Grouped typeahead results for albums, releases, and artists.

### 5. Frontend Visual Conventions & Design System
- **Design System Tokens (`DESIGN.md`)**:
  - Canvas: `#F7F3F0`, Nav Rail: `#0E0E10`, Cards: `#FFFFFF`, Hover: `#FAF7F5`.
  - Structural Ink: `#121212` with `1.5px solid` borders and hard geometric drop shadows (`2px 2px 0px #121212` buttons/inputs, `3px 3px 0px #121212` cards/modals). Zero blur gradients.
  - Typography: `Space Grotesk` (headings), `Inter` (body/UI), `JetBrains Mono` (metrics/tabular numerals).
- **Deterministic Groove Monograms**:
  - 2-character uppercase initials over a concentric SVG vinyl groove ring, deterministically styled by hashing the entity key modulo the palette (`#9B6DFF`, `#68D391`, `#ECC94B`, `#E5E0DA`, `#FFFFFF`).
- **Brutalist Edge States**:
  - Dash-padded placeholder rows maintaining 5-row leaderboard heights.
  - Zero-activity mono chart callout banners (`NO NEW ACTIVITY IN <W> — LAST SEEN <REL_TIME>`).
  - Empty search/filter cards (`0 MATCHING RECORDS` + `Reset Filters`).
  - Structural `#E5E0DA` pulse skeletons and `#F56565` Coral Alert banners with retry CTA.

---

## Testing Decisions

### What Makes a Good Test
Tests evaluate external behavior through public module interfaces, observing HTTP response payloads, database read-only invariants, and validated user-facing UI interactions rather than internal implementation details or private helpers:
- Testing at the highest seam possible to maximize test leverage and avoid brittle implementation coupling.
- Validating read-only transaction guarantees (ensuring write operations fail with explicit database errors).
- Verifying mathematical accuracy of points, origin anchors, velocity, decay, and normalization across all three Hype Windows.
- Ensuring UI components react correctly to URL query parameter changes, sorting, and keyboard navigation.

### Modules Tested & Testing Seams

1. **Primary Backend Seam: HTTP REST API Boundary (`/api/v1/*`)**
   - **Interface**: FastAPI router entrypoints executed via `httpx.AsyncClient` and Starlette `TestClient(app)` against a seeded read-only test database session.
   - **Scope**: Exercises route handlers, query parameter validation, serialization via Pydantic v2 schemas, deep domain services (`catalog`, `hype`, `timeseries`, `search`), SQL compilation, and read-only connection guarantees.
   - **Invariants**: Proves SELECT queries succeed, read-only transaction mode blocks writes, responses match schema contracts, and parameter validation rejects invalid windows.

2. **Primary Frontend Seam: Rendered Application & Network Boundary (`AppShell` & Screen Routes)**
   - **Interface**: React 19 pages (`DemandDashboard`, `DirectoryExplorer`, `AlbumDetail`, `ReleaseDetail`, `ArtistDetail`) rendered in a test runner (Vitest + React Testing Library) with network requests intercepted at the `fetch` boundary (MSW or query cache hydration), paired with Playwright browser verification via `playwright-cli`.
   - **Scope**: Exercises user interactions (window toggle switching, tab navigation, search input typing, sorting, table row clicks), URL query parameter synchronization (`?window=`, `?tab=`, `?q=`), and rendering of Neo-Brutalist tokens and SVGs.

3. **Supplementary Engine Seam: Pure Mathematical Scoring Functions**
   - **Interface**: Public functional interfaces in `backend.services.hype` and `backend.services.catalog`.
   - **Scope**: Verifies point calculations, single-snapshot baseline anchoring, decay curves, and SHA-256 `album_id` stability against known numerical test matrices.

### Prior Art
- Database integration test patterns in `reddit-scrape/tests/test_service.py`.
- Pydantic schema validation patterns in `reddit-scrape/tests/test_extraction.py`.
- Reconciled Neo-Brutalist visual mockups and design tokens in `DESIGN.md`.

---

## Out of Scope

1. **Unbacked Retail & Catalog Fields in Stitch**:
   - Price / MSRP (`$35–$72`, "Discogs Price Pulse").
   - Physical inventory counts and pressing run sizes (`"1 In Stock / 4 Sold Out"`, `"Ltd / ~25,000"`, `"28 SKUs"`, stock ratio bars).
   - UPC codes, Record Label / Imprint chips, First Released year, Discogs indexing status, and DMM / audiophile master badges.
   - Reddit submission `author` (`u/...`, dropped in scraper ADR 0001).
2. **Retired Event Classifications & Flags**:
   - `Release Event` badges (`NEW RELEASE`, `PRE-ORDER`, `RESTOCK`, `REPRESS`, `SOLD OUT`) and `submissions.flair` filter pills/chart callouts.
   - Catalog availability KPI cards (`ACTIVE AVAILABILITY`, `CATALOG AVAILABILITY`).
3. **Fabricated Telemetry & Marketing Chrome**:
   - Scraping cluster statistics (`"14 Scraping Clusters"`, `"42 DTC APIs"`).
   - Live websocket claims (`"LIVE WEBSOCKET"`, `"99.8% Accuracy"`, `"SHA-256 hash valid"`, `"Raw JSON Payload"`).
4. **Auth, User State & Export Functions**:
   - User profile accounts, logins, and roles.
   - Watchlists (`+ Track Release`, `+ Watch Album`), alerts, notification bells, and CSV exports (`Export Ledger`).
5. **Unbuilt Navigation Destinations**:
   - Standalone `Hype Board`, `Retailers`, `Watchlist Alerts`, `Docs / Reddit & API Feeds`, and `System Settings` pages. Primary navigation is scoped strictly to `Demand Dashboard` and `Directory Explorer`.
6. **External Image Fetching**:
   - Calling external APIs (Discogs, Spotify, MusicBrainz) or web scraping for album artwork. Artwork is replaced entirely by deterministic Neo-Brutalist monogram placeholders.
7. **Cloud Infrastructure & Deployment**:
   - Cloud provisioning, container orchestration, and remote deployment. The product is designed for local developer and workstation execution.

---

## Further Notes

- **Environment & Configuration**:
  - `DATABASE_URL`: Connection string resolving to the local PostgreSQL database populated by `reddit-scrape` (e.g. `postgresql+psycopg://postgres:password@localhost:5432/vinyl`).
  - `PYTHONUTF8=1`: Required on Windows environments to prevent character encoding issues with unicode dashes and international artist names.
- **Port Allocations**:
  - FastAPI backend runs on port `8000` (`http://127.0.0.1:8000`).
  - Vite dev server runs on port `5173` (`http://127.0.0.1:5173`) with reverse proxy configured for `/api` requests.
