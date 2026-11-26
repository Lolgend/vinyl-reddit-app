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
- **Navigation Rail (`surface-nav`: `#0E0E10`)**: Deep void black sidebar hosting persistent navigation and quick-jump directory links.
- **Card & Panel Surfaces (`surface-card`: `#FFFFFF`)**: Pure optic white background for elevated cards, metric blocks, tables, and detail containers.
- **Row Hover & Alternating Tint (`surface-row-hover`: `#FAF7F5`)**: Subtle warm paper tint for interactive table row hover states and alternating rows.
- **Primary Structural Ink (`ink-primary`: `#121212`)**: Deep ink black used for all structural borders (`1.5px solid #121212`), primary headlines, editorial super-header rules (`3px solid #121212`), table headers, active filter pill fills, and hard drop shadows.
- **Secondary / Subdued Ink (`ink-secondary`: `#646464`)**: Used on light surfaces for timestamps, retailer subtitles, inactive metadata, and low/cooling `Hype Index` tiers.
- **Navigation Rail Muted Ink (`nav-muted` / `--color-nav-muted`: `#94949E`)**: Subdued ink reserved for secondary labels, section headers, and inactive sub-links on the `#0E0E10` navigation rail (6.3:1 contrast against `#0E0E10`, meeting WCAG 1.4.3 AA).
- **Hairline Divider (`border-hairline`: `#E5E0DA`)**: Warm stone neutral used for `1px solid` internal table row dividers and in-card list separators.

### Semantic Accents & `Hype Index` (0–100) Tiers
- **Primary Action Accent (`#9B6DFF`)**: Electric Lavender for primary CTA buttons, Share-of-Demand bars, chart area tint, and interactive triggers.
- **High Hype Tier (`Hype Index` 75–100 → Mint `#68D391`)**: Indicates top-tier community demand on leaderboards, KPI strips, and progress bars.
- **Moderate Hype Tier (`Hype Index` 40–74 → Amber `#ECC94B`)**: Signals steady medium community demand.
- **Low / Cooling Hype Tier (`Hype Index` 0–39 → Subdued Ink `#646464`)**: Indicates baseline or cooling `Engagement`.

---

## 3. Typography Hierarchy

1. **Space Grotesk (Headlines & Display)**:
   - Bold, geometric sans-serif that delivers editorial weight and punch to super-headers, page titles, `Album` names, and leaderboard headers.
   - `super-header`: `36px–48px` (`text-4xl sm:text-5xl`) / uppercase / `700` weight / `leading-none` / tight tracking (`tracking-tighter` on detail super-headers, `tracking-tight` on Directory active-category super-header), anchored by a `3px solid #121212` bottom rule.
   - `headline-xl`: `30px–32px` (`text-3xl`) / line-height `36px–38px` / `700` weight (entity masthead `H1`)
   - `headline-lg`: `24px` / line-height `30px` / `700` weight (also `20px–24px` `text-xl sm:text-2xl` `700` for equal-prominence `Album` / `Artist` hierarchy on `Release Detail`)
   - `headline-md`: `18px` / line-height `24px` / `600` or `700` weight
2. **Inter (Interface & Body Copy)**:
   - Neutral, ultra-legible typography for tables, lists, `Mention` titles, `Variant` descriptors, and `Retailer` names.
   - `body-lg`: `16px` / line-height `24px` / `400` weight
   - `body-md`: `14px` / line-height `20px` / `400` or `500` weight
   - `body-sm`: `12px` / line-height `16px` / `400` or `500` weight
3. **JetBrains Mono (Metrics, Numerics & Badges)**:
   - Fixed-width figures (`font-variant-numeric: tabular-nums`) for `Hype Index` (`0–100`), `Engagement` counts (votes, comments, mentions), rank badges (`#1`–`#5`), `Last Seen` badges, and timestamps.
   - `metric-hero`: `24px–28px` / line-height `32px` / `700` weight (top-level KPI stat callouts)
   - `label-mono-lg`: `20px` / line-height `24px` / `700` weight
   - `label-mono-md`: `13px` / line-height `18px` / `600` weight
   - `label-mono-sm`: `11px` / line-height `14px` / `500` or `600` weight

---

## 4. Desktop Grid, Navigation Shell & Spatial Architecture

- **Reference Viewports**: Desktop `1440px` and wide `1920px` frames, plus responsive mobile drawer support below `lg` (`< 1024px`).
- **Navigation Rail (`240px` fixed left sidebar on `lg+`, off-canvas drawer on mobile, `#0E0E10`)**:
  - Full viewport height, separated from the main workspace by a `1.5px solid #121212` right border.
  - **Brand Header**: Vinyl monogram mark + `VINYL DEMAND` (`Space Grotesk` `700`) + `NO MORE GUESSING` subtitle (`JetBrains Mono` `11px` `#94949E` / `--color-nav-muted`).
  - **Primary Navigation (`INTELLIGENCE`)**:
    1. `Demand Dashboard` (`/`)
    2. `Directory Explorer` (`/directory`) with indented quick-jump sub-links for `Releases` (`/directory?tab=releases`), `Albums` (`/directory?tab=albums`), and `Artists` (`/directory?tab=artists`).
  - **Source-Agnostic Chrome**: Zero source-specific rail footer, user profile tile, login button, or unbuilt navigation items.
- **Top Workspace Search & Freshness Bar (`64px` height, `1.5px solid #121212` bottom border)**:
  - Spans the top of the main workspace across all 5 screens.
  - **Left**: Mobile menu trigger below `lg` + Global Search Input (`Search releases, albums, artists, variants, retailers... [⌘K]` + `CLEAR`, `#FFFFFF` fill, `1.5px solid #121212`, `2px 2px 0px #121212` shadow). On `Directory Explorer`, binds directly to `?q=<query>` (eliminating duplicate search coupling). On `Demand Dashboard`, `Album Detail`, `Release Detail`, and `Artist Detail`, submitting routes to `/directory?q=<query>`.
  - **Right**: Factual database freshness indicator in `JetBrains Mono` (`11px`): `LAST UPDATED: <relative_time>` (or `SYNCING...` / `OFFLINE` from `/api/v1/health` `latest_snapshot_at`), with zero source badges, notification bells, watch/export buttons, or fabricated telemetry badges.
- **Main Workspace Canvas**: `max-w-[1600px]` centered fluid container on `#F7F3F0` canvas below the `64px` top bar (`p-4 sm:p-6 lg:p-8` outer workspace padding).
- **12-Column CSS Grid**:
  - Outer canvas padding: `16px` mobile, `24px` tablet, `32px` desktop (`p-4 sm:p-6 lg:p-8`)
  - Grid column & row gap: `20px`
  - Internal card padding: `20px` (or `16px` on 3-card Hero KPI strips, `24px` on entity mastheads)
- **Dashboard Top Row Allocation**: 3 equal-width intelligence cards (`grid-cols-1 xl:grid-cols-3 gap-5`) with uniform 5-row height and standardized `Hype Index` right-hand meters.
- **Full-Width Feed / Directory Tables**: Span all **12 columns** beneath the top intelligence row.

---

## 5. Borders, Radii, Brutalist Shadow Scale & Component Rules

### Border Weights & Corner Radii
- **`border-strong`**: `1.5px solid #121212` (all cards, modals, buttons, badges, inputs, active/inactive `Hype Window` filter pills, and table header bottom divider).
- **`border-subtle`**: `1px solid #E5E0DA` (internal table row dividers and in-card list item separators).
- **`radius-md`**: `6px` (cards, data tables, modals, panels, square `Album` / `Release` sleeve monograms).
- **`radius-sm`**: `4px` (buttons, inputs, badges, rank badges `#1`–`#5`).
- **`radius-pill`**: `9999px` (`Hype Window` toggle pills `24H` / `7D` / `1M`, filter chips, metadata pills, and circular `Artist` portrait monograms).

### Brutalist Hard-Offset Shadow Elevation Scale
- **`shadow-none`**: `0px 0px 0px #121212` (flat elements, table rows, and active/depressed button state via `translate(2px, 2px)`).
- **`shadow-sm`**: `2px 2px 0px #121212` (interactive buttons, dropdown triggers, active toggle pills).
- **`shadow-md`**: `3px 3px 0px #121212` (primary cards, metric containers, and button hover state via `translate(-1px, -1px)`).
- **`shadow-lg`**: `5px 5px 0px #121212` (drawers, modals, floating popovers).

### Core Component Specifications
- **Card Containers**: Background `#FFFFFF`, border `1.5px solid #121212`, `border-radius: 6px`, `box-shadow: 3px 3px 0px #121212`, padding `20px`.
- **Deterministic Neo-Brutalist Monogram Placeholders (`VinylMonogram`)**:
  - **Glyph Text**: 2-character uppercase initials derived from `album_title` (for `Album` and `Release` tiles) or `artists.name` (for `Artist` tiles) — first letters of the first two alphanumeric words, or first two characters of a single-word title/name, set in `Space Grotesk` `700` over a concentric vinyl groove SVG ring.
  - **Deterministic Surface Swatch**: Hash the entity key (`album_id`, `releases.id`, or `artists.id`) modulo the 5-color Neo-Brutalist surface palette (`#9B6DFF` Electric Lavender, `#68D391` Mint, `#ECC94B` Amber, `#E5E0DA` Warm Sand, `#FFFFFF` Optic White, all with `#121212` ink and `1.5px solid #121212` border).
  - **Framing Contrast (`shape`: `'circle' | 'square'`)**: `Artist` detail masthead uses `shape="circle"` (`rounded-full`) for clear portrait identity, whereas `Album` and `Release` detail mastheads—as well as `Album` row monograms on `Artist Detail`—use `shape="square"` (`rounded-[6px]`) for square vinyl record-sleeve framing around the concentric disc. Default `shape="circle"` is preserved for compact list/navigation thumbnails.
- **Nullable `Variant` & `Retailer` Fallbacks**:
  - `variant IS NULL`, empty, or `"Standard Pressing"` renders as `"Standard Pressing"` in subdued chips and triggers the `Release Detail` `H1` fallback (`{album_title} — Standard Pressing`).
  - `retailer_name IS NULL` renders as `"Wide / Unspecified"` (and is excluded from `Retailer` filter chips).
- **Interactive Buttons & `Hype Window` Toggle Pills**:
  - Primary Button: Background `#9B6DFF`, border `1.5px solid #121212`, `border-radius: 4px`, text `#121212` (bold), `box-shadow: 2px 2px 0px #121212`. Hover translates `-1px, -1px` with `3px 3px 0px #121212`; active press translates `+2px, +2px` with `0px 0px 0px #121212`.
  - `Hype Window` Pill Switcher (`24H` / `7D` / `1M`): `border-radius: 9999px`, `1.5px solid #121212`. Active pill uses `#121212` fill with `#FFFFFF` mono text; inactive pill uses `#FFFFFF` fill with `#121212` mono text.
- **Data Tables**:
  - Table header: `#F7F3F0` background with `1.5px solid #121212` bottom divider, uppercase `JetBrains Mono` column labels (`label-mono-sm`).
  - Table rows: `#FFFFFF` background with `1px solid #E5E0DA` horizontal dividers; hover state `#FAF7F5`.
- **Empty, Zero-Activity, Loading & Error States**:
  - **Zero Window Activity (`hype_index = 0`)**: Render `Hype Index` as `0 / 100` in the `Low / Cooling` tier (`#646464` Subdued Ink, empty `#E5E0DA` progress track). On `Activity Over Time` charts with zero activity in window `W`, render a flat `0` baseline curve with a plain-English mono banner: `NO NEW ACTIVITY IN <W> — LAST SEEN <REL_TIME>`.
  - **Partial Leaderboards (`< 5` active items in `W`)**: Render active rows `1..K` and pad remaining slots up to 5 with subdued dashed placeholder rows (`No additional active items in <W> window — switch to 7D or 1M`) to preserve the uniform 5-row card height.
  - **Empty Search / Filter State**: Full-width brutalist state card inside the table/grid container with `JetBrains Mono` heading `0 MATCHING RECORDS`, active filter summary, and a primary `Reset Filters` (`#9B6DFF`) CTA.
  - **Loading & Error States**: Structural brutalist skeleton blocks (`#E5E0DA` pulse fills inside `1.5px solid #121212` frames matching exact card/table heights, including 3-card KPI skeletons and super-header skeletons on detail pages) while loading; `#F56565` Coral Alert banner (`1.5px solid #121212`, `3px 3px 0px #121212` shadow) with `Retry` CTA on error.

---

## 6. Reconciled 5-Screen UI & Schema Specification

All 5 screens adhere strictly to the tokens above, using source-agnostic domain terminology (`Album`, `Release`, `Artist`, `Collaboration`, `Variant`, `Retailer`, `Mention`, `Hype Index`, `Hype Window`, `Engagement`, `Last Seen`) and omitting internal velocity metrics and source-specific platform branding.

### 6.1 `Demand Dashboard` (`/`)
- **Top Row — 3 Equal-Width Leaderboard Cards (5-Row Uniform Height, Uniform Right-Hand `Hype Index` Meter)**:
  All 3 cards share an identical right-hand `w-24` meter column displaying `<TierBadge />` (`0–100`) above a tier-colored `Hype Index` progress bar (`#68D391` high, `#ECC94B` moderate, `#646464` low) with zero velocity or score clutter:
  1. **Top Albums (`24H | 7D | 1M` independent switcher, default `24H`)**:
     - Line 1: Rank badge (`#1`–`#5`) + clickable `Combined Artist — Album` (`→ Album Detail`) on left; `Hype Index` meter (`TierBadge` + progress bar) on right.
     - Line 2: Deduplicated union subtitle (`N Mention(s) · M Release(s)`) on left.
  2. **Top Releases (`24H | 7D | 1M` independent switcher, default `24H`)**:
     - Line 1: Rank badge (`#1`–`#5`) + clickable `Combined Artist — Album` (`→ Release Detail`) on left; `Hype Index` meter (`TierBadge` + progress bar) on right.
     - Line 2: `Variant · Retailer` subtitle on left.
  3. **Newly Added Releases (fixed `LAST 24H` badge, ordered by `first_seen_at DESC`)**:
     - Line 1: Relative first-seen timestamp badge (`12m ago`) + clickable `Combined Artist — Album` (`→ Release Detail`) on left; `24H` `Hype Index` meter (`TierBadge` + progress bar) on right.
     - Line 2: `Variant · Retailer` subtitle on left.
- **Bottom Row — Full-Width 12-Column `Live Release Feed` (fixed `24H` window)**:
  - **Filter & Sort Bar**: Local inline table filter input (`Filter feed by artist, album, variant, retailer...`), `Hype Index` tier chips (`All`, `High 75–100`, `Mod 40–74`, `Low 0–39`), non-null `Retailer` selector, and `Sort` selector (`Hype Index ↓` default, `Votes ↓`, `Recency ↓`).
  - **6-Column Ledger Table**:
    1. `Release & Artist` (monogram + clickable `Album` title + `Combined Artist`)
    2. `Variant` (bordered chip, `"Standard Pressing"` fallback)
    3. `Retailer` (`"Wide / Unspecified"` fallback)
    4. `Hype Index` (`0–100` tier pill + inline progress bar)
    5. `Engagement` (`{score} votes · {num_comments} comments`)
    6. `Action / Posted` (`View ↗` → `Release Detail` + relative `posted_at`)

### 6.2 `Directory Explorer` (`/directory` — `Releases`, `Albums`, `Artists` Tabs)
- **Monochrome Editorial Super-Header & Segmented Tab Switcher**:
  - Explicitly adopts the editorial super-header pattern: `Directory Explorer` mono eyebrow (`11px` uppercase `tracking-widest`) above a large bold uppercase active-category `H1` (`RELEASES (N)`, `ALBUMS (M)`, or `ARTISTS (K)` in `Space Grotesk` `text-4xl sm:text-5xl`), paired with right-aligned pill tab buttons (`RELEASES (N)`, `ALBUMS (M)`, `ARTISTS (K)`) above a `3px solid #121212` bottom rule and a 1-line catalog-level explanation subtitle.
- **Shared Command & Filter Card (12 Columns)**:
  - Search input synced with `?q=` + shared `Hype Window` pill switcher (`24H | 7D | 1M`, default `24H`), `TIER` filter pills (`ALL`, `HIGH 75–100`, `MOD 40–74`, `LOW 0–39`), `SORT` selector (`Hype Index ↓` default, `Mentions ↓`, `Recently Added ↓`, `Pressing Count ↓` on `Albums`, `Albums ↓` on `Artists`, `Title / Name A–Z`), `CREDIT` filter pills on `Albums` & `Artists` (`ALL`, `SOLO`, `COLLABORATION`), non-null `Retailer` facet chips on `Releases` & `Albums`, and `Grid | Table` toggle on `Releases`.
- **Tab 1 — `Releases`**:
  - **Grid View (3×N cards, 4 cols each)**: Monogram + clickable `Album` title & `Combined Artist` header + tier-colored `TierBadge` (`0–100`) in top-right; `Variant` chip + `Retailer` label; metrics block with `Hype Index` tier progress bar and plain-English `Engagement` (`{score} votes · {num_comments} comments · {submission_count} mentions`); dual footer buttons (`VIEW RELEASE →` primary `#9B6DFF` + `ALBUM →` secondary `#FFFFFF`).
  - **Table View (6 Columns)**: `Album & Artist`, `Variant`, `Retailer`, `Hype Index` (`TierBadge` + progress bar), `Engagement` (`{score} votes · {num_comments} comments · {submission_count} mentions`), `Action` (`View Release →`).
- **Tab 2 — `Albums` (Full-Width 6-Column Table)**:
  1. `Album & Artist` (monogram + clickable `Album` title + `Combined Artist`)
  2. `Pressings` (`{release_count} Pressing(s)` badge + inline preview of up to 2 `Variant` names)
  3. `Retailers` (distinct non-null `Retailer` chips or `"Wide / Unspecified"`)
  4. `Engagement` (`{score} votes · {num_comments} comments · {submission_count} mentions`)
  5. `Hype Index` (`0–100` `TierBadge` + progress bar in active `W`)
  6. `Action` (`View Album →`)
- **Tab 3 — `Artists` (Full-Width 6-Column Table)**:
  1. `Artist` (monogram + canonical `artists.name` link)
  2. `Discography` (`{solo_album_count} Solo` · `{combined_album_count} Collaboration` badges)
  3. `Pressings` (`{release_count} Pressing(s)`)
  4. `Engagement` (`{score} votes · {num_comments} comments · {submission_count} mentions`)
  5. `Hype Index` (`0–100` `TierBadge` + progress bar in active `W`)
  6. `Action` (`View Artist →`)

### 6.3 Entity Detail Screens (`Album Detail`, `Release Detail`, `Artist Detail`)
- **Shared Editorial Super-Header, Monochrome Masthead & `Last Seen` Provenance (`EntityEditorialHeader`)**:
  - **Explicitly supersedes the prior "zero eyebrow above H1" rule**: Each entity detail page opens with a context back-link (`← Back to Directory` / `← Back to Album: <album_title> (N Releases)`), followed by a high-contrast monochrome super-header bar (`border-b-[3px] border-[#121212] pb-3`) displaying the bold uppercase entity type (`ALBUM`, `RELEASE`, or `ARTIST` in `Space Grotesk` `text-4xl sm:text-5xl tracking-tighter`) on the left—with **zero** secondary metadata text beside the super-header—and the right-aligned `Hype Window` pill switcher (`24H | 7D | 1M`, default `24H`).
  - Below the super-header rule sits a unified monochrome masthead card (`bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6`, zero per-entity accent colors) containing a `68px × 68px` `VinylMonogram` (`shape="square"` sleeve for `Album` and `Release`; `shape="circle"` portrait for `Artist`), the primary `H1` (`Space Grotesk` `30px` `text-3xl`), entity links, and a `LAST SEEN: <relative_time> (<YYYY-MM-DD>)` pill.
  - `Last Seen` is displayed exclusively at the top level of the 3 entity detail screens (masthead chip, `Album Detail` `Pressings` KPI card, `Release Detail` Physical Specifications card, and zero-activity chart callout) and never inside child comparison tables or dashboard/directory rows.
- **Shared `Activity Over Time` Chart (`ActivityOverTimeChart`, used on `Album Detail` & `Release Detail`)**:
  - Simplified single-curve cumulative `Engagement` line (`#121212`, `2.5px`) with subtle `#9B6DFF` (`10%` opacity) area fill over `24H` / `7D` / `1M` buckets—with **no** velocity bars or technical sampling jargon (`Stepped`, `Buckets`, or formula text).
  - Readable Y-axis label (`Engagement`) and numeric ticks (`0`, mid, max); readable X-axis local time/date ticks (`6 PM` / `12 AM` for `24H`; `Nov 20` for `7D`/`1M`) terminating in a bold right-aligned `NOW` tick.
  - Interactive hover and keyboard-focus interval hit targets displaying a dark floating tooltip with exact timestamp + cumulative engagement count, plus tidy staggered red `Mention` markers (`#F56565`) revealing `Mention` title and relative timestamp on hover/focus instead of colliding inline labels.
  - Plain-English legend (`Cumulative Engagement`, `Mention`) and zero-activity banner (`NO NEW ACTIVITY IN <W> — LAST SEEN <REL_TIME>`) over a flat `0` baseline when `!hasActivity`.
- **`Album Detail` (`/albums/:albumId`)**:
  - **Masthead**: `ALBUM` super-header, square sleeve `VinylMonogram`, `H1` (`album_title`), optional `Collaboration: <combined_artist>` subtitle when multi-artist, clickable `Artist` chips, and `LAST SEEN` chip.
  - **3-Card Hero KPI Strip (`grid-cols-1 sm:grid-cols-3`)**:
    1. `Hype Index` (`0–100` `TierBadge` + progress bar)
    2. `Engagement` (`{total_score} votes` + `{total_comments} comments · {submission_count} mention(s)`)
    3. `Pressings` (`{release_count} Pressing(s)` + `Last seen <rel_time>`)
  - **Middle Row (12 cols)**: 8-col **`Activity Over Time`** chart + 4-col **`Share of Demand`** card (`{share_percentage}%` horizontal bars and `{points} engagement` per pressing, zero normalization footnote).
  - **Bottom Row (12 cols) — 6-Column `All Pressings` Table**:
    `Variant`, `Retailer`, `Share of Demand`, `Hype Index`, `Engagement` (`{submission_count} mention(s) · {total_score} votes · {total_comments} comments`), `Action` (`View Release →`).
- **`Release Detail` (`/releases/:releaseId`)**:
  - **Masthead**: `RELEASE` super-header, square sleeve `VinylMonogram`, `H1` displaying the specific pressing `Variant` (or `{album_title} — Standard Pressing` when `variant` is null, blank, or `"Standard Pressing"`), paired directly below with clickable `Album` title and `Artist` at **equal visual prominence** (`font-grotesk font-bold text-xl sm:text-2xl`), plus `Retailer` chip and `LAST SEEN` chip.
  - **3-Card Hero KPI Strip (`grid-cols-1 sm:grid-cols-3`)**:
    1. `Hype Index` (`0–100` `TierBadge` + progress bar)
    2. `Engagement` (`{total_score} votes` + `{total_comments} comments · {submission_count} mention(s)`)
    3. `Retailer & First Seen` (`{retailer_name || 'Wide / Unspecified'}` + `First tracked <YYYY-MM-DD>`)
  - **Middle Row (12 cols)**: 5-col **`Physical Specifications`** card (`Artist`, `Parent Album`, `Variant`, `Retailer`, `First Seen`, `Last Seen` — zero internal UUID or derived-metadata footer) + 7-col **`Activity Over Time`** chart.
  - **Bottom Row (12 cols) — 5-Column `Source Mentions` Table**:
    `Mention Title` (clean `title` text without raw platform IDs), `Posted` (`created_utc` relative + date), `Votes` (`{latest_score} votes`), `Comments` (`{latest_num_comments} comments`), `Source Link` (`View Source ↗` to `url`).
- **`Artist Detail` (`/artists/:artistId`)**:
  - **Masthead**: `ARTIST` super-header, circular portrait `VinylMonogram` (`shape="circle"`), `H1` (`artist.name`), summary line (`{total_albums} Album(s) · {total_releases} Pressing(s)`), and `LAST SEEN` chip (zero internal artist ID badge).
  - **3-Card Hero KPI Strip (`grid-cols-1 sm:grid-cols-3`)**:
    1. `Hype Index` (`0–100` `TierBadge` + progress bar)
    2. `Engagement` (`{total_score} votes` + `{total_comments} comments · {submission_count} mention(s)`)
    3. `Discography` (`{total_albums} Album(s)` + `{solo_album_count} Solo · {combined_album_count} Collaboration · {total_releases} Pressing(s)`)
  - **Middle Row (12 cols) — 6-Column `Albums` Table**:
    `Album` (square sleeve `VinylMonogram` + `album_title` + `combined_artist`), `Credit` (`Solo` Mint badge vs. `Collaboration` neutral badge), `Pressings` (`{release_count} Pressing(s)`), `Engagement` (`{submission_count} mention(s) · {score} votes · {num_comments} comments`), `Hype Index` (`0–100`), `Action` (`View Album →`).
  - **Bottom Row (12 cols) — 6-Column `All Pressings` Table**:
    `Album` (clickable `album_title`), `Variant`, `Retailer`, `Engagement` (`{submission_count} mention(s) · {score} votes · {num_comments} comments`), `Hype Index` (`0–100`), `Action` (`View Release →`).
