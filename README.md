# Tune-In

**Vinyl demand intelligence ledger transforming live `r/vinylreleases` community momentum into quantitative retail procurement signals.**

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-Frontend-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

---

## Product Overview

Independent record store buyers and retail managers operate inside narrow distributor pre-order windows and strict allocation caps. Over-ordering locks capital into dead stock; under-ordering misses viral pressings that sell out within hours.

**Tune-In** replaces manual subreddit scrolling with an explainable, quantitative demand ledger powered by `r/vinylreleases` engagement snapshots. Rather than showing raw thread counts alone, it measures **how fast** interest is accelerating, **when** momentum starts to decay, and **which pressing variant** is capturing collector demand.

### Application Views

| Screen | Route | Purpose |
| :--- | :--- | :--- |
| **Demand Dashboard** | `/` · `/dashboard` | Top 5 Albums & Top 5 Releases leaderboards (independent `24H` / `7D` / `1M` switchers), `24H` Newly Added Releases, and filterable Live Release Feed. |
| **Directory Explorer** | `/directory` | Paginated catalog across `Releases` (Grid / Table toggle), `Albums`, and `Artists` tabs with search, Hype tier, retailer, attribution, and sort controls. |
| **Album Detail** | `/albums/:albumId` | Deduplicated album-level KPIs, stepped `LOCF` velocity chart with submission markers, variant `Share of Demand` bars, and child release matrix. |
| **Release Detail** | `/releases/:releaseId` | Physical pressing specs, snapshot engagement curve, and `r/vinylreleases` submission provenance table with direct thread links. |
| **Artist Detail** | `/artists/:artistId` | Catalog footprint split into `Solo` vs. `Combined` appearances, tracked albums matrix, and full discography release ledger. |

### Domain Hierarchy

All metrics and UI screens are anchored to a five-entity domain model (see [GLOSSARY.md](./GLOSSARY.md) for canonical definitions):

```text
Artist ──< Album ──< Release ──< Submission ──< SubmissionSnapshot
             │          │             │
             │          │             └── point-in-time (score, num_comments, upvote_ratio, captured_at)
             │          └── physical pressing: (variant, retailer_name)
             └── canonical musical work: aggregates deduplicated union of child Release Submissions
```

- **Album vs. Release**: Multiple colorways or retailer exclusives of the same record share one parent `Album`. An `Album` aggregates metrics over the **deduplicated union** of linked `Submission`s so multi-variant announcement posts are never double-counted.
- **Last Seen Provenance**: Entity detail headers surface the latest linked `Submission` timestamp (`Last Seen`) to distinguish cooling historical catalog items (`Hype Index = 0`) from active breakouts.

---

## Architecture & Read-Only Data Flow

Tune-In is a two-tier web application sitting strictly downstream of the companion ingestion pipeline, [Lolgend/vinyl-reddit-scrape](https://github.com/Lolgend/vinyl-reddit-scrape), which scrapes `r/vinylreleases`, resolves entities, and writes time-series snapshots into PostgreSQL.

```mermaid
flowchart LR
    Reddit["r/vinylreleases"] --> Scraper["vinyl-reddit-scrape<br/>(Ingestion &amp; Entity Resolution)"]
    Scraper --> DB[("PostgreSQL + pgvector<br/>Shared Data Tier")]
    DB -->|"Read-Only SQLAlchemy<br/>(postgresql_readonly=True)"| API["FastAPI Backend (/api/v1)<br/>catalog · hype · timeseries · search"]
    API -->|"REST JSON + TanStack Query"| UI["React 19 + TypeScript SPA<br/>(The Neo-Brutalist Ledger)"]
```

### Key Architectural Invariants

1. **Strictly Read-Only Database Boundary**: The backend SQLAlchemy engine ([`db.py`](./backend/src/backend/db.py)) enforces `execution_options={"postgresql_readonly": True}` and `-c default_transaction_read_only=on`. Tune-In performs zero schema migrations, DDL, or writes against scraper-owned tables.
2. **Shared ORM Reuse**: Rather than duplicating schema definitions, the backend imports persisted SQLAlchemy models directly from `reddit-scrape` via a local path dependency in [`backend/pyproject.toml`](./backend/pyproject.toml).
3. **Deep Service Seams**: Scoring (`hype.py`), stepped charting (`timeseries.py`), catalog attribution (`catalog.py`), and entity detail views are isolated in pure service modules behind thin FastAPI routers.

---

## Mathematical Scoring & Demand Engine

Every leaderboard rank, tier badge (`High` / `Moderate` / `Low`), stepped chart, and variant share bar is derived deterministically from `submission_snapshots` and `submissions` (`WHERE is_release = TRUE`).

### 1. Hype Window Parameterization

Calculations operate across three selectable windows $W \in \{24\text{H}, 7\text{D}, 1\text{M}\}$, each with a window-scaled freshness half-life $\tau_W$ and uniform time-series grid:

| Parameter | `24H` | `7D` | `1M` (`30D`) |
| :--- | :---: | :---: | :---: |
| **Window Duration ($D_W$)** | $24\text{ h}$ | $168\text{ h}$ | $720\text{ h}$ |
| **Cutoff Timestamp ($t_0$)** | $t_{\text{now}} - 24\text{ h}$ | $t_{\text{now}} - 168\text{ h}$ | $t_{\text{now}} - 720\text{ h}$ |
| **Freshness Half-Life ($\tau_W$)** | $12.0\text{ h}$ | $72.0\text{ h}$ ($3\text{ d}$) | $336.0\text{ h}$ ($14\text{ d}$) |
| **LOCF Chart Grid ($N \times w_{\text{hrs}}$)** | $24 \times 1\text{ h}$ | $28 \times 6\text{ h}$ | $30 \times 24\text{ h}$ |

---

### 2. Composite Engagement Points ($E$)

$$E = \text{score} + 2 \cdot \text{num\_comments}$$

- **Why this design**: Reddit upvotes reflect passive approval, whereas comments signal active buyer intent—variant comparisons, pressing quality questions, and sell-out alerts. Weighting comments at $2\times$ surfaces releases generating substantive collector discussion.

---

### 3. Window Baseline Anchoring & Net Gain ($\Delta E_s$)

For each release-eligible submission $s$, let $E_{\text{curr}}$ be the engagement points from its latest snapshot (falling back to `latest_score` and `latest_num_comments` if no snapshots exist). The baseline $(E_{\text{base}}, t_{\text{base}})$ depends on when the post was created relative to window cutoff $t_0$:

$$(E_{\text{base}}, t_{\text{base}}) = \begin{cases} (0,\; t_{\text{created}}) & \text{if } t_{\text{created}} \ge t_0 \quad \text{(created inside window)} \\ (E(S_{\text{anchor}}),\; t(S_{\text{anchor}})) & \text{if } t_{\text{created}} < t_0 \quad \text{(created before window)} \end{cases}$$

$$\Delta E_s = \max\left(0,\; E_{\text{curr}} - E_{\text{base}}\right)$$

- **Why this design**: Without the **origin anchor** $(0, t_{\text{created}})$ for posts created inside $W$, a brand-new pressing ingested with only one snapshot would evaluate to $\Delta E_s = 0$ and miss immediate launch hype until a second snapshot arrived.

---

### 4. Hype Velocity ($v_s$ & $V_{\text{entity}}$)

Elapsed hours $\Delta t_s$ are measured from $t_{\text{base}}$ to **$t_{\text{now}}$** with a **15-minute floor** ($0.25\text{ h}$):

$$\Delta t_s = \max\left(0.25,\; \frac{t_{\text{now}} - t_{\text{base}}}{3600}\right)$$

$$v_s = \begin{cases} \operatorname{round}\!\left(\dfrac{\Delta E_s}{\Delta t_s},\; 1\right) & \text{if } \Delta E_s > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

For any `Release`, `Album`, or `Artist`, velocity sums across the **deduplicated union** $U$ of linked submissions:

$$V_{\text{entity}} = \operatorname{round}\!\left(\sum_{s \in U} v_s,\; 1\right)$$

- **Why this design**:
  - The **$0.25\text{ h}$ floor** prevents a 2-minute-old post with a handful of upvotes from spiking toward extreme $\text{pts/hr}$ artifacts.
  - Measuring $\Delta t_s$ up to **$t_{\text{now}}$** (rather than the latest snapshot timestamp) ensures inactive threads cool naturally as time passes instead of remaining frozen at an old burst rate.

---

### 5. Raw Hype Signal ($h_s$) & Entity Raw Hype ($H_{\text{entity}}$)

If $v_s \le 0$ and $\Delta E_s \le 0$, then $h_s = 0$. Otherwise, with submission age $a_s = \max\!\left(0,\; \frac{t_{\text{now}} - t_{\text{created}}}{3600}\right)$ and clamped upvote ratio $r_s \in [0, 1]$ (default $1.0$ if null):

$$q_s = 0.5 + 0.5 \cdot r_s \in [0.5,\; 1.0]$$

$$h_s = \left(v_s + \frac{\Delta E_s}{\tau_W}\right) \cdot q_s \cdot 2^{-a_s / \tau_W}, \qquad H_{\text{entity}} = \sum_{s \in U} h_s$$

- **Why this design**:
  - **Velocity + Sustained Volume** ($v_s + \Delta E_s / \tau_W$): Both terms share $\text{pts/hr}$ units, rewarding immediate acceleration while preserving credit for large cumulative window gains.
  - **Soft Upvote Damping** ($q_s \in [0.5, 1.0]$): Controversial threads (e.g., `r = 0.50` yields $0.75\times$) are gently damped rather than erased, because polarizing drops still indicate demand.
  - **Window-Scaled Exponential Decay** ($2^{-a_s / \tau_W}$): Signal halves every $\tau_W$ hours so older discussions fade smoothly as fresh announcements arrive.

---

### 6. Cohort-Normalized Hype Index ($0\text{–}100$) & Tiers

Within each entity class (`Release`, `Album`, or `Artist`) and active window $W$, raw hype is log-compressed against the cohort maximum $H_{\max}$ with a constant reference floor $H_{\text{floor}} = 25.0$:

$$\text{HypeIndex} = \begin{cases} 0 & \text{if } H_{\text{entity}} \le 0 \\ \min\!\left(100,\; \max\!\left(0,\; \operatorname{round}\!\left(100 \cdot \dfrac{\ln(1 + H_{\text{entity}})}{\max\!\left(\ln(1 + H_{\max}),\; \ln(1 + 25.0)\right)}\right)\right)\right) & \text{if } H_{\text{entity}} > 0 \end{cases}$$

| Tier | Hype Index Range | Interpretation |
| :--- | :---: | :--- |
| **High** | `75 – 100` | Breakout community demand and rapid engagement velocity |
| **Moderate** | `40 – 74` | Steady collector traction within the active window |
| **Low / Cooling** | `0 – 39` | Minimal recent activity or decayed historical interest |

- **Why this design**:
  - **Log Compression** ($\ln(1 + H)$): Prevents one outlier viral post from compressing every other active pressing into single digits.
  - **Reference Floor** ($H_{\text{floor}} = 25.0$): Prevents quiet market days from normalizing a lukewarm `3.0` raw-hype post up to `100`.

---

### 7. Worked Numerical Example

Suppose we score a single-snapshot `r/vinylreleases` submission in the **`24H` window** ($\tau_{24\text{H}} = 12.0\text{ h}$) posted **$6.0\text{ hours}$ ago** with `score = 66`, `num_comments = 15`, and `upvote_ratio = 0.90`:

1. **Engagement Points**: $E_{\text{curr}} = 66 + 2(15) = 96$
2. **Baseline & Gain** (created inside `24H` window): $E_{\text{base}} = 0,\; \Delta E_s = 96 - 0 = 96$
3. **Hype Velocity**: $\Delta t_s = \max(0.25, 6.0) = 6.0\text{ h} \implies v_s = \operatorname{round}(96 / 6.0, 1) = \mathbf{16.0\text{ pts/hr}}$
4. **Raw Hype**:
   - Upvote quality: $q_s = 0.5 + 0.5(0.90) = 0.95$
   - Decay: $2^{-6.0 / 12.0} = 2^{-0.5} \approx 0.7071$
   - $h_s = \left(16.0 + \frac{96}{12.0}\right) \cdot 0.95 \cdot 0.7071 \approx \mathbf{16.1220}$
5. **Cohort Hype Index**:
   - **Active market** ($H_{\max} = 40.0 > 25.0$): $\operatorname{round}\!\left(100 \cdot \frac{\ln(17.1220)}{\ln(41.0)}\right) = \mathbf{76}$ (**High**)
   - **Why the floor matters**: If a quiet day's #1 post only reaches $H_{\max} = H_{\text{entity}} = 3.0$, dividing by $\ln(1 + 25.0)$ instead of $\ln(1 + 3.0)$ yields $\operatorname{round}\!\left(100 \cdot \frac{\ln(4.0)}{\ln(26.0)}\right) = \mathbf{43}$ (**Moderate**) rather than falsely awarding `100`.

---

### 8. Stepped LOCF Time-Series & Bucket Velocity

Detail charts (`Album Detail` and `Release Detail`) build $N + 1$ uniform timestamp boundaries $b_0, b_1, \dots, b_N$ ending at $t_{\text{now}}$ and sample cumulative points using **Last Observation Carried Forward (LOCF)**:

$$E(b_i) = \sum_{s \in U} E_s(b_i), \qquad v_{\text{bucket}}(i) = \operatorname{round}\!\left(\frac{\max\!\left(0,\; E(b_i) - E(b_{i-1})\right)}{w_{\text{hrs}}},\; 1\right)$$

- For each submission $s$ and boundary $b_i$: $E_s(b_i) = 0$ if $b_i < t_{\text{created}}$; otherwise the latest snapshot with `captured_at <= b_i`.
- **Why this design**: Scraper polling timestamps do not align to neat hour marks; `LOCF` produces clean stepped intervals of width $w_{\text{hrs}} \in \{1\text{h}, 6\text{h}, 24\text{h}\}$ without interpolating demand before a thread existed.

---

### 9. Child-Release Share of Demand

On `Album Detail`, commercial preference across $K$ child `Release`s is measured using cumulative engagement points $E_r = \sum_{s \in U(r)} \max(0, \text{latest\_score}_s + 2 \cdot \text{latest\_num\_comments}_s)$:

$$\operatorname{share}(r) = \begin{cases} \operatorname{round}\!\left(100 \cdot \dfrac{E_r}{\sum_{j=1}^{K} E_j},\; 1\right) & \text{if } \sum_{j=1}^{K} E_j > 0 \\ \operatorname{round}\!\left(\dfrac{100}{K},\; 1\right) & \text{otherwise} \end{cases}$$

Any rounding residual $100.0 - \sum_{j=1}^K \operatorname{share}(j)$ is applied to the highest-point release so shares always sum to exactly `100.0%`.

---

### 10. Deduplication, Attribution & Screen Rules

- **Deduplicated Union Rollups**: `Album` and `Artist` metrics evaluate over the distinct set of `submission_id`s across all child `Release`s—never summing duplicate references from multi-variant threads.
- **String Normalization** ([`catalog.py`](./backend/src/backend/services/catalog.py)): Maps Unicode dashes (`\u2010–\u2015`, `\u2212`) to ASCII `-`, collapses whitespace, and lowercases strings before comparisons.
- **Solo vs. Combined Artist Attribution**: Classified as `solo` when normalized `artists.name == albums.combined_artist` and only 1 artist is linked (or when unlinked and `combined_artist` contains no collaborative markers such as `/`, `&`, `and`, `feat.`, `ft.`, `with`, `vs.`, `x`); otherwise classified as `combined`.
- **Newly Added Releases Pinning**: The dashboard's *Newly Added Releases* card always filters `first_seen_at >= now - 24h` and scores within the **`24H` cohort**, independent of the active dashboard window.
- **Release Average Upvote Ratio**: `Release Detail` computes the arithmetic mean of non-null `latest_upvote_ratio` across linked submissions, rounded to `2` decimal places.

<details>
<summary>Edge-case &amp; fallback rules implemented in hype.py and timeseries.py</summary>

1. **Older posts without pre-$t_0$ snapshots** (`compute_submission_metrics`): When $t_{\text{created}} < t_0$ and no snapshot exists at or before $t_0$, the baseline falls back to the earliest snapshot inside $(t_0, \text{now}]$; if no snapshots exist at all, $E_{\text{base}} = E_{\text{curr}}$ so $\Delta E_s = 0$ and $v_s = 0.0$.
2. **Purged snapshots in LOCF curves** (`compute_locf_time_series`): If $b_i \ge t_{\text{created}}$ and snapshots exist only *after* $b_i$, $E_s(b_i) = 0$ (not yet observed). If zero snapshots exist in the database (e.g., retention purge), the latest submission `score + 2 * num_comments` is carried forward.
3. **Negative or zero signals**: Any $\Delta E_s \le 0$ clamps velocity to `0.0` and raw hype to `0.0`, guaranteeing `HypeIndex = 0`.
4. **Zero-total Share of Demand**: When an album has $K$ child releases with $0$ total engagement points, share falls back uniformly to `round(100.0 / K, 1)` before residual adjustment.

</details>

---

## REST API Reference (`/api/v1`)

Interactive OpenAPI / Swagger docs are available at `GET /docs` when the backend server is running.

| Endpoint | Query Parameters | Description |
| :--- | :--- | :--- |
| `GET /api/v1/health` | — | Database connectivity check and latest `submission_snapshots.captured_at` timestamp. |
| `GET /api/v1/dashboard` | `window` (`24H` \| `7D` \| `1M`) | Top 5 Albums, Top 5 Releases, `24H` Newly Added Releases, and Live Release Feed (up to 50 recent). |
| `GET /api/v1/directory/releases` | `window`, `q`, `tier`, `retailer`, `sort`, `order`, `page`, `page_size` | Paginated physical releases with variant/retailer facets and sorting. |
| `GET /api/v1/directory/albums` | `window`, `q`, `tier`, `retailer`, `attribution`, `sort`, `order`, `page`, `page_size` | Paginated canonical albums with child release counts, preview variants, and retailers. |
| `GET /api/v1/directory/artists` | `window`, `q`, `tier`, `attribution`, `sort`, `order`, `page`, `page_size` | Paginated artists with `solo_album_count` vs. `combined_album_count` footprints. |
| `GET /api/v1/directory/retailers` | — | Distinct non-null, non-empty retailer names sorted alphabetically. |
| `GET /api/v1/directory/counts` | — | Total catalog counts (`releases`, `albums`, `artists`) for directory tab badges. |
| `GET /api/v1/albums/{album_id}` | `window` (`24H` \| `7D` \| `1M`) | Album hero KPIs, stepped `LOCF` chart + event markers, `Share of Demand`, and child release matrix. |
| `GET /api/v1/releases/{release_id}` | `window` (`24H` \| `7D` \| `1M`) | Physical specs, parent album link, stepped snapshot curve, and `r/vinylreleases` submission provenance. |
| `GET /api/v1/artists/{artist_id}` | `window` (`24H` \| `7D` \| `1M`) | Artist hero KPIs, catalog footprint, tracked albums with `Solo`/`Combined` badges, and release ledger. |
| `GET /api/v1/search` | `q` (min 2 chars), `limit` (`1..50`) | Grouped substring typeahead search across albums, releases, and artists. |

---

## Project Structure & Documentation Map

Setup instructions, environment configuration, and verification commands live inside each tier's dedicated README:

```text
vinyl-reddit-app/
├── backend/
│   ├── README.md                    # Python/uv setup, .env config, run & test commands
│   ├── pyproject.toml               # Dependencies (FastAPI, SQLAlchemy, local reddit-scrape dep)
│   ├── src/backend/
│   │   ├── api/                     # Thin FastAPI routers (/api/v1)
│   │   ├── schemas/                 # Pydantic v2 response contracts
│   │   └── services/                # Scoring (hype.py), LOCF (timeseries.py), catalog, search, details
│   └── tests/                       # Pytest unit & read-only integration tests
├── frontend/
│   ├── README.md                    # Node/Vite setup, API proxy, build, lint & test commands
│   └── src/
│       ├── components/              # AppShell, NavigationRail, TopBar, TierBadge, VinylMonogram
│       ├── pages/                   # DemandDashboard, DirectoryExplorer, Album/Release/Artist Detail
│       ├── utils/                   # Deterministic SVG monograms, relative timestamps, UI tokens
│       └── test/                    # Vitest + React Testing Library specs
├── docs/
│   ├── PRD.md                       # Full product requirements & scoring design rationale
│   └── spec/vinyl-demand-app.md     # Technical specification & vertical implementation slices
├── DESIGN.md                        # "The Neo-Brutalist Ledger" visual tokens & 5-screen layout spec
├── GLOSSARY.md                      # Canonical domain vocabulary
├── PRODUCT.md                       # Product positioning, principles & scope boundaries
└── AGENTS.md                        # Repository workflow & tooling conventions
```

### Reference Documentation

- [backend/README.md](./backend/README.md) — Backend environment setup, read-only database configuration, and test/lint commands.
- [frontend/README.md](./frontend/README.md) — Frontend dev server, production build, Oxlint, and Vitest instructions.
- [GLOSSARY.md](./GLOSSARY.md) — Canonical definitions for `Album`, `Release`, `Artist`, `Combined Artist`, `Hype Velocity`, `Hype Index`, and `Last Seen`.
- [DESIGN.md](./DESIGN.md) — Neo-Brutalist Ledger color tokens, typography hierarchy, and component specifications.
- [PRODUCT.md](./PRODUCT.md) — Product purpose, operating context, and honest provenance principles.
- [docs/PRD.md](./docs/PRD.md) & [docs/spec/vinyl-demand-app.md](./docs/spec/vinyl-demand-app.md) — Detailed product & technical specifications.
