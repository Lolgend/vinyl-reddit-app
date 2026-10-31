# Neo-Brutalist Design System: Vinyl Demand Intelligence

## 1. Creative North Star & Brand Aesthetic

**Creative North Star: "The Neo-Brutalist Ledger"**

The design system blends high-density retail market analytics with the bold, graphic tactility of neo-brutalism. Drawing direct visual inspiration from the reference interface, it pairs a pitch-black navigation rail with an inviting, warm off-white canvas, razor-sharp structural outlines, hard offset box-shadows, solid black pill filters, and vibrant electric status accents.

The interface prioritizes scanability, high data density, and clear demand signals for vinyl buyers and retail store owners:
- **No blurry gradients or floating fuzzy shadows.** Visual depth is achieved through stark tonal contrast and a 4-step hard offset geometric shadow scale (`0px`, `2px`, `3px`, `5px` in `#121212`).
- **Heavy structural discipline.** Every card, table, header block, badge, button, and modal is bounded by a crisp `1.5px solid #121212` border (`border-strong`), with `1px solid #E5E0DA` (`border-subtle`) reserved strictly for internal table row and list item dividers.
- **Graphic punch.** Active filters and selections use pitch-black fills (`#121212`) with stark white typography, accented by vivid electric lavender (`#9B6DFF`), mint green (`#68D391`), amber (`#ECC94B`), warm sand (`#E5E0DA`), and coral alert (`#F56565`).

---

## 2. Color Palette & Tonal Hierarchy

### Surfaces & Structural Ink
- **Canvas Background (`surface-canvas`: `#F7F3F0`)**: Warm brutalist paper tone. Gives the workspace an organic editorial feel while keeping eye fatigue low during long buying cycles.
- **Navigation Rail (`surface-nav`: `#0E0E10`)**: Deep void black sidebar hosting persistent navigation, live signal counts, and workspace settings.
- **Card & Panel Surfaces (`surface-card`: `#FFFFFF`)**: Pure optic white background for elevated cards, metric blocks, tables, and detail containers.
- **Row Hover & Alternating Tint (`surface-row-hover`: `#FAF7F5`)**: Subtle warm paper tint for interactive table row hover states and alternating rows.
- **Primary Structural Ink (`ink-primary`: `#121212`)**: Deep ink black used for all structural borders (`1.5px solid #121212`), primary headlines, table headers, active filter pill fills, and hard drop shadows.
- **Secondary / Subdued Ink (`ink-secondary`: `#646464`)**: Used for timestamps, retailer subtitles, inactive metadata, and low/cooling `Hype Index` tiers.
- **Hairline Divider (`border-hairline`: `#E5E0DA`)**: Warm stone neutral used for `1px solid` internal table row dividers and in-card list separators.

### Semantic Accents & `Hype Index` (0–100) Tiers
- **Primary Action Accent (`#9B6DFF`)**: Electric Lavender for primary CTA buttons and interactive triggers.
- **High Hype Tier (`Hype Index` 75–100 → Mint `#68D391`)**: Indicates top-tier community demand and engagement velocity on leaderboards and progress bars.
- **Moderate Hype Tier (`Hype Index` 40–74 → Amber `#ECC94B`)**: Signals steady medium demand velocity.
- **Low / Cooling Hype Tier (`Hype Index` 0–39 → Subdued Ink `#646464`)**: Indicates baseline or cooling engagement.

---

## 3. Typography Hierarchy

1. **Space Grotesk (Headlines & Display)**:
   - Bold, geometric sans-serif that delivers editorial weight and punch to page titles, `Album` names, and leaderboard headers.
   - `headline-xl`: `32px` / line-height `38px` / `700` weight
   - `headline-lg`: `24px` / line-height `30px` / `700` weight
   - `headline-md`: `18px` / line-height `24px` / `600` weight
2. **Inter (Interface & Body Copy)**:
   - Neutral, ultra-legible typography for tables, lists, `Submission` titles, `Variant` descriptors, and `Retailer` names.
   - `body-lg`: `16px` / line-height `24px` / `400` weight
   - `body-md`: `14px` / line-height `20px` / `400` or `500` weight
   - `body-sm`: `12px` / line-height `16px` / `400` or `500` weight
3. **JetBrains Mono (Metrics, Numerics & Badges)**:
   - Fixed-width figures (`font-variant-numeric: tabular-nums`) for `Hype Index` (`0–100`), `Hype Velocity` (`+Δ/hr`), upvote ratios (`98%`), comment counts, rank badges (`#1`–`#5`), and timestamps.
   - `metric-hero`: `28px` / line-height `32px` / `700` weight (top-level KPI stat callouts)
   - `label-mono-lg`: `20px` / line-height `24px` / `700` weight
   - `label-mono-md`: `13px` / line-height `18px` / `600` weight
   - `label-mono-sm`: `11px` / line-height `14px` / `500` weight

---

## 4. Desktop Grid, Navigation Shell & Spatial Architecture

- **Reference Viewport**: `1440px` desktop frame.
- **Navigation Rail (`240px` fixed left sidebar, `#0E0E10`)**:
  - Full viewport height, separated from the main workspace by a `1.5px solid #121212` right border.
  - **Brand Header**: Vinyl monogram mark + `VINYL DEMAND` (`Space Grotesk` `700`) + `r/vinylreleases LEDGER` subtitle (`JetBrains Mono` `11px` `#646464`).
  - **Primary Navigation (`INTELLIGENCE`)**:
    1. `Demand Dashboard` (`/`)
    2. `Directory Explorer` (`/directory`) with indented quick-jump sub-links for `Releases` (`/directory?tab=releases`), `Albums` (`/directory?tab=albums`), and `Artists` (`/directory?tab=artists`).
  - **Rail Footer (Factual Provenance Only)**: Displays `SOURCE: r/vinylreleases` in `JetBrains Mono` (`11px` `#646464`) with no user profile tile, login button, or unbuilt navigation items.
- **Top Workspace Search & Provenance Bar (`64px` height, `1.5px solid #121212` bottom border)**:
  - Spans the top of the `1200px` main workspace across all 5 screens.
  - **Left**: Global Search Input (`Search releases, albums, artists, variants, retailers... [⌘K]` + `CLEAR`, `#FFFFFF` fill, `1.5px solid #121212`, `2px 2px 0px #121212` shadow). On `Directory Explorer`, binds directly to `?q=<query>` (eliminating any duplicate search input inside the directory filter card). On `Demand Dashboard`, `Album Detail`, `Release Detail`, and `Artist Detail`, submitting routes to `/directory?q=<query>`.
  - **Right**: Factual database freshness indicator in `JetBrains Mono` (`11px`): `SOURCE: r/vinylreleases · LAST SNAPSHOT: <relative_time>` (from `MAX(submission_snapshots.captured_at)`), with zero notification bells, watch/export buttons, or fabricated telemetry badges.
- **Main Workspace Canvas**: `1200px` fluid/remaining width on `#F7F3F0` canvas below the `64px` top bar.
- **12-Column CSS Grid**:
  - Outer canvas padding: `32px` (top, right, bottom, left)
  - Grid column & row gap: `20px`
  - Internal card padding: `20px`
- **Dashboard Top Row Allocation**: 3 equal-width intelligence cards each spanning **4 columns** (`1:1:1` ratio) with uniform 5-row height.
- **Full-Width Feed / Directory Tables**: Span all **12 columns** beneath the top intelligence row.

---

## 5. Borders, Radii, Brutalist Shadow Scale & Component Rules

### Border Weights & Corner Radii
- **`border-strong`**: `1.5px solid #121212` (all cards, modals, buttons, badges, inputs, active/inactive `Hype Window` filter pills, and table header bottom divider).
- **`border-subtle`**: `1px solid #E5E0DA` (internal table row dividers and in-card list item separators).
- **`radius-md`**: `6px` (cards, data tables, modals, panels).
- **`radius-sm`**: `4px` (buttons, inputs, badges, rank badges `#1`–`#5`).
- **`radius-pill`**: `9999px` (`Hype Window` toggle pills `24H` / `7D` / `1M` and filter chips).

### Brutalist Hard-Offset Shadow Elevation Scale
- **`shadow-none`**: `0px 0px 0px #121212` (flat elements, table rows, and active/depressed button state via `translate(2px, 2px)`).
- **`shadow-sm`**: `2px 2px 0px #121212` (interactive buttons, dropdown triggers, active toggle pills).
- **`shadow-md`**: `3px 3px 0px #121212` (primary cards, metric containers, and button hover state via `translate(-1px, -1px)`).
- **`shadow-lg`**: `5px 5px 0px #121212` (drawers, modals, floating popovers).

### Core Component Specifications
- **Card Containers**: Background `#FFFFFF`, border `1.5px solid #121212`, `border-radius: 6px`, `box-shadow: 3px 3px 0px #121212`, padding `20px`.
- **Deterministic Neo-Brutalist Monogram Placeholders**:
  - **Glyph Text**: 2-character uppercase initials derived from `album_title` (for `Album` and `Release` tiles) or `artists.name` (for `Artist` tiles) — first letters of the first two alphanumeric words, or first two characters of a single-word title/name, set in `Space Grotesk` `700` over a concentric vinyl groove SVG ring.
  - **Deterministic Surface Swatch**: Hash the entity key (`album_id`, `releases.id`, or `artists.id`) modulo the 5-color Neo-Brutalist surface palette (`#9B6DFF` Electric Lavender, `#68D391` Mint, `#ECC94B` Amber, `#E5E0DA` Warm Sand, `#FFFFFF` Optic White, all with `#121212` ink and `1.5px solid #121212` border).
- **Nullable `Variant` & `Retailer` Fallbacks**:
  - `variant IS NULL` renders as a subdued chip reading `"Standard Pressing"`.
  - `retailer_name IS NULL` renders as `"Wide / Unspecified"` (and is excluded from `Retailer` filter chips).
- **Interactive Buttons & `Hype Window` Toggle Pills**:
  - Primary Button: Background `#9B6DFF`, border `1.5px solid #121212`, `border-radius: 4px`, text `#121212` (bold), `box-shadow: 2px 2px 0px #121212`. Hover translates `-1px, -1px` with `3px 3px 0px #121212`; active press translates `+2px, +2px` with `0px 0px 0px #121212`.
  - `Hype Window` Pill Switcher (`24H` / `7D` / `1M`): `border-radius: 9999px`, `1.5px solid #121212`. Active pill uses `#121212` fill with `#FFFFFF` mono text; inactive pill uses `#FFFFFF` fill with `#121212` mono text.
- **Data Tables**:
  - Table header: `#F7F3F0` background with `1.5px solid #121212` bottom divider, uppercase `JetBrains Mono` column labels (`label-mono-sm`).
  - Table rows: `#FFFFFF` background with `1px solid #E5E0DA` horizontal dividers; hover state `#FAF7F5`.
- **Empty, Zero-Activity, Loading & Error States**:
  - **Zero Window Activity (`hype_index = 0`, `hype_velocity = 0.0`)**: Render `Hype Index` as `0 / 100` in the `Low / Cooling` tier (`#646464` Subdued Ink, empty `#E5E0DA` progress track) and `Hype Velocity` as `0.0 pts/hr` (`#646464`). On entity detail time-series charts with zero activity in window `W`, render the flat LOCF baseline curve with a mono banner: `NO NEW ACTIVITY IN <W> — LAST SEEN <REL_TIME>`.
  - **Partial Leaderboards (`< 5` active items in `W`)**: Render active rows `1..K` and pad remaining slots up to 5 with subdued dashed placeholder rows (`No additional active items in <W> window — switch to 7D or 1M`) to preserve the uniform 5-row card height.
  - **Empty Search / Filter State**: Full-width brutalist state card inside the table/grid container with `JetBrains Mono` heading `0 MATCHING RECORDS`, active filter summary, and a primary `Reset Filters` (`#9B6DFF`) CTA.
  - **Loading & Error States**: Structural brutalist skeleton blocks (`#E5E0DA` pulse fills inside `1.5px solid #121212` frames matching exact card/table heights) while loading; `#F56565` Coral Alert banner (`1.5px solid #121212`, `3px 3px 0px #121212` shadow) with `Retry` CTA on error.

---

## 6. Reconciled 5-Screen UI & Schema Specification

All 5 screens adhere strictly to the tokens above (normalizing all Stitch Family 2 `#FF6B6B` coral accents, `Plus Jakarta Sans` typography, `4px` shadows, and square `24h/7d/30d/All` buttons to `DESIGN.md` tokens, and omitting retired `Release Event`, `submissions.flair`, catalog availability cards, and unbacked retail fields).

### 6.1 `Demand Dashboard` (`/`)
- **Top Row — 3 Equal-Width 4-Column Leaderboard Cards (5-Row Uniform Height)**:
  1. **Top Albums (`24H | 7D | 1M` independent switcher, default `24H`)**:
     - Line 1: Rank badge (`#1`–`#5`) + clickable `Combined Artist — Album` (`→ Album Detail`) on left; tier-colored `Hype Index` badge (`0–100`) on right.
     - Line 2: Deduplicated union subtitle (`N Submissions · M Releases`) on left; `Hype Velocity` (`+X.X pts/hr`) + tier-colored `Hype Index` progress bar on right.
  2. **Top Releases (`24H | 7D | 1M` independent switcher, default `24H`)**:
     - Line 1: Rank badge (`#1`–`#5`) + clickable `Combined Artist — Album` (`→ Release Detail`) on left; tier-colored `Hype Index` badge (`0–100`) on right.
     - Line 2: `Variant · Retailer` subtitle on left; `Hype Velocity` (`+X.X pts/hr`) on right.
  3. **Newly Added Releases (fixed `24H` window, ordered by `MIN(s.created_utc) DESC`)**:
     - Line 1: Relative first-seen timestamp badge (`12m ago`) + clickable `Combined Artist — Album` (`→ Release Detail`) on left; tier-colored `24H` `Hype Index` badge (`0–100`) on right.
     - Line 2: `Variant · Retailer` subtitle on left; latest `Submission` score and `24H` velocity (`score pts · +X.X/hr`) on right.
- **Bottom Row — Full-Width 12-Column `Live Release Feed` (fixed `24H` window)**:
  - **Filter & Sort Bar**: Local inline table filter input (`Filter feed by artist, album, variant, retailer...`), `Hype Index` tier chips (`All`, `High 75–100`, `Mod 40–74`, `Low 0–39`), non-null `Retailer` filter chips/dropdown, and `Sort` selector (`Hype Index ↓` default, `Hype Velocity ↓`, `Newest ↓`, `Upvotes ↓`).
  - **7-Column Ledger Table**:
    1. `Combined Artist & Album` (monogram + clickable `Album` title + clickable `Artist` link(s))
    2. `Variant` (bordered chip, `"Standard Pressing"` fallback)
    3. `Retailer` (`"Wide / Unspecified"` fallback)
    4. `Hype Index` (`0–100` tier pill + inline progress bar)
    5. `Hype Velocity` (`+X.X pts/hr`)
    6. `Submission Metrics` (`score` pts · `num_comments` comments · `submission_count` posts)
    7. `Action` (`View Release →`)

### 6.2 `Directory Explorer` (`/directory` — `Releases`, `Albums`, `Artists` Tabs)
- **Header & Segmented Entity Switcher**: `Directory Explorer` (`headline-xl`, no eyebrow pill) + segmented brutalist tab buttons with live counts: `Releases (N)`, `Albums (M)`, `Artists (K)`.
- **Shared Command & Filter Card (12 Columns)**:
  - Governed by the top workspace search bar (`?q=`) + shared `Hype Window` pill switcher (`24H | 7D | 1M`, default `24H`), `Hype Index` tier filter chips (`All`, `High 75–100`, `Mod 40–74`, `Low 0–39`), non-null `Retailer` facet chips (shown on `Releases` and `Albums` tabs), `Sort` selector (`Hype Index ↓` default, `Hype Velocity ↓`, `Submissions ↓`, `Newest ↓`, `Title/Name A–Z`), and `Grid | Table` toggle on the `Releases` tab.
- **Tab 1 — `Releases`**:
  - **Grid View (3×N cards, 4 cols each)**: Monogram + clickable `Combined Artist` & `Album` header + tier-colored `Hype Index` badge (`0–100`) in top-right; `Variant` chip + `Retailer` label; metrics block with window `Hype Velocity` (`+X.X pts/hr`), `Hype Index` bar, and `Submission` stats (`score` pts · `num_comments` comments · `submission_count` posts); dual footer buttons (`View Release →` primary `#9B6DFF` + `Album (M Releases)` secondary `#FFFFFF`).
  - **Table View (7 Columns)**: Matches the 7-column `Live Release Feed` schema (`Combined Artist & Album`, `Variant`, `Retailer`, `Hype Index`, `Hype Velocity`, `Submission Metrics`, `Action`).
- **Tab 2 — `Albums` (Full-Width 7-Column Table)**:
  1. `Album & Combined Artist` (monogram + clickable `Album` title + clickable `Artist` link(s))
  2. `Child Releases` (`release_count` badge + inline preview of up to 2 `Variant` names)
  3. `Retailers` (distinct non-null `Retailer` chips or `"Wide / Unspecified"`)
  4. `Submissions` (deduplicated union `submission_count` posts · total `score` pts · `num_comments` comments)
  5. `Hype Velocity` (`+X.X pts/hr` in active `W`)
  6. `Hype Index` (`0–100` tier badge + bar in active `W`)
  7. `Action` (`View Album →`)
- **Tab 3 — `Artists` (Full-Width 7-Column Table)**:
  1. `Artist` (monogram + canonical `artists.name`)
  2. `Tracked Albums` (`album_count` total: `solo_album_count` Solo · `combined_album_count` Combined badge)
  3. `Child Releases` (`release_count` total pressings)
  4. `Submissions` (deduplicated union `submission_count` posts · total `score` pts · `num_comments` comments)
  5. `Hype Velocity` (`+X.X pts/hr` in active `W`)
  6. `Hype Index` (`0–100` tier badge + bar in active `W`)
  7. `Action` (`View Artist →`)

### 6.3 Entity Detail Screens (`Album Detail`, `Release Detail`, `Artist Detail`)
- **Shared Top-Level Detail Header & `Last Seen` Provenance**:
  - Context back-link (`← Back to Directory` / `← Back to Album: <album_title> (N Releases)`), `64px × 64px` deterministic monogram block, direct `H1` (`Space Grotesk` `32px`, zero eyebrow above `H1`), clickable entity relationship chips + top-level **`LAST SEEN: <relative_time> (<YYYY-MM-DD>)`** chip (`MAX(submissions.created_utc)` across the entity's linked release submissions) below `H1`, and a right-aligned page-level `Hype Window` pill switcher (`24H | 7D | 1M`, default `24H`).
  - `Last Seen` is displayed exclusively at the top level of the 3 entity detail screens (in the hero metadata strip, 4th Hero KPI card, and zero-activity chart callout) and never inside child comparison tables or dashboard/directory rows.
- **`Album Detail` (`/albums/:albumId`)**:
  - **4-Cell Hero KPI Strip**:
    1. `HYPE INDEX` (`0–100` tier badge + bar in `W`)
    2. `HYPE VELOCITY` (`+X.X pts/hr` in `W`)
    3. `REDDIT DEMAND` (`+ΔE` window pts · total `score` upvotes · `num_comments` comments)
    4. `PRESSINGS & PROVENANCE` (`release_count` Child `Release`s · `submission_count` Deduplicated `Submission`s · `Last Seen: <rel_time>`)
  - **Middle Row (12 cols)**: 8-col **Stepped `Hype Velocity` & Cumulative Points Chart** (`bucket_velocity_pts_per_hr` + cumulative `E(b_i)` across `24H`/`7D`/`1M` buckets, with vertical dashed markers for linked `Submission` `created_utc` timestamps) + 4-col **Child-`Release` Share-of-Demand Card** (`share(r)%` horizontal bars).
  - **Bottom Row (12 cols) — 7-Column Child `Release`s & `Variant` Comparison Matrix**:
    `Variant`, `Retailer`, `Share of Demand` (`share(r)%`), `Submissions` (`submission_count` · `score` pts · `num_comments` comments), `Hype Velocity` (`+X.X pts/hr`), `Hype Index` (`0–100`), `Action` (`View Release →`).
- **`Release Detail` (`/releases/:releaseId`)**:
  - **4-Cell Hero KPI Strip**:
    1. `HYPE INDEX` (`0–100` tier badge + bar in `W`)
    2. `HYPE VELOCITY` (`+X.X pts/hr` in `W`)
    3. `SUBMISSION ENGAGEMENT` (total `score` upvotes · `upvote_ratio%` · total `num_comments` comments)
    4. `PROVENANCE SUMMARY` (`submission_count` Linked `Submission`s · `Last Seen: <rel_time>` · `First Seen: <date>`)
  - **Middle Row (12 cols)**: 5-col **Physical `Release` Specification Card** (`Combined Artist` with links to each `Artist` in `release_artists`, `Parent Album` with `View Album (N Releases) →`, `Variant`, `Retailer`, `First Seen` date, `Last Seen` date, `Linked Submissions` count) + 7-col **Stepped `Submission Snapshot` Velocity & Engagement Chart** (`bucket_velocity_pts_per_hr` + cumulative `score` & `num_comments` over `24H`/`7D`/`1M`).
  - **Bottom Row (12 cols) — 6-Column `r/vinylreleases` `Submission` Provenance Table**:
    `Submission Title & ID` (`t3_...` mono badge + full `submissions.title`), `Posted` (`created_utc` relative + UTC timestamp), `Score & Upvote Ratio` (`latest_score` pts · `latest_upvote_ratio%`), `Comments` (`latest_num_comments`), `Window Velocity` (`+v_s pts/hr` in active `W`), `Source Link` (`Reddit ↗` to `submissions.url`).
- **`Artist Detail` (`/artists/:artistId`)**:
  - **4-Cell Hero KPI Strip**:
    1. `HYPE INDEX` (`0–100` tier badge + bar in `W`)
    2. `HYPE VELOCITY` (`+X.X pts/hr` in `W`)
    3. `CATALOG FOOTPRINT` (`album_count` `Album`s: `solo_album_count` Solo / `combined_album_count` Combined · `release_count` `Release`s)
    4. `REDDIT DEMAND` (`submission_count` Deduplicated `Submission`s · total `score` upvotes · `num_comments` comments · `Last Seen: <rel_time>`)
  - **Middle Row (12 cols) — 7-Column Tracked `Album`s & `Combined Artist` Appearances Matrix**:
    `Album` (monogram + `album_title`), `Billing Attribution` (`Solo` badge vs. `Combined: <combined_artist>` badge), `Child Releases` (`release_count`), `Submissions` (`submission_count` · `score` pts · `num_comments` comments), `Hype Velocity` (`+X.X pts/hr`), `Hype Index` (`0–100`), `Action` (`View Album →`).
  - **Bottom Row (12 cols) — 7-Column Child `Release`s Ledger**:
    `Parent Album` (clickable `album_title`), `Variant`, `Retailer`, `Submissions` (`submission_count` · `score` pts · `num_comments` comments), `Hype Velocity` (`+X.X pts/hr`), `Hype Index` (`0–100`), `Action` (`View Release →`).
