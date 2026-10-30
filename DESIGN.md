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
- **Hairline Divider (`border-hairline`: `#E5E0DA`)**: Warm stone neutral used for `1px solid` internal table row dividers, in-card list separators, and the `Repress` badge fill.

### Semantic Accents & `Hype Index` (0–100) Tiers
- **Primary Action Accent (`#9B6DFF`)**: Electric Lavender for primary CTA buttons, watchlist triggers, and `New Release` badges.
- **High Hype Tier (`Hype Index` 75–100 → Mint `#68D391`)**: Indicates top-tier community demand and engagement velocity on leaderboards and progress bars.
- **Moderate Hype Tier (`Hype Index` 40–74 → Amber `#ECC94B`)**: Signals steady medium demand velocity or restock watch momentum.
- **Low / Cooling Hype Tier (`Hype Index` 0–39 → Subdued Ink `#646464`)**: Indicates baseline or cooling engagement (reserving Coral `#F56565` strictly for depletion/sell-out alerts).

### Canonical `Release Event` Badge Tokens
All five canonical `Release Event` categories from `GLOSSARY.md` use `border-strong` (`1.5px solid #121212`), `radius-sm` (`4px`), uppercase `JetBrains Mono` (`label-mono-sm`), and `#121212` text:
- **`NEW RELEASE`**: Electric Lavender fill (`#9B6DFF`), `#121212` text, `1.5px solid #121212` border.
- **`PRE-ORDER`**: Mint fill (`#68D391`), `#121212` text, `1.5px solid #121212` border.
- **`RESTOCK`**: Amber fill (`#ECC94B`), `#121212` text, `1.5px solid #121212` border.
- **`REPRESS`**: Warm Sand fill (`#E5E0DA`), `#121212` text, `1.5px solid #121212` border.
- **`SOLD OUT`**: Coral Alert fill (`#F56565`), `#121212` text, `1.5px solid #121212` border.

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

## 4. Desktop Grid & Spatial Architecture

- **Reference Viewport**: `1440px` desktop frame.
- **Navigation Rail**: Fixed `240px` left sidebar (`#0E0E10`), full viewport height, separated from the main workspace by a `1.5px solid #121212` right border.
- **Main Workspace**: `1200px` fluid/remaining width on `#F7F3F0` canvas.
- **12-Column CSS Grid**:
  - Outer canvas padding: `32px` (top, right, bottom, left)
  - Grid column & row gap: `20px`
  - Internal card padding: `20px`
- **Dashboard Top Row Allocation**: 3 equal-width intelligence cards each spanning **4 columns** (`1:1:1` ratio) with uniform 5-row height.
- **Full-Width Feed / Directory Tables**: Span all **12 columns** beneath the top intelligence row.

---

## 5. Borders, Radii, Brutalist Shadow Scale & Component Rules

### Border Weights & Corner Radii
- **`border-strong`**: `1.5px solid #121212` (all cards, modals, buttons, `Release Event` badges, inputs, active/inactive `Hype Window` filter pills, and table header bottom divider).
- **`border-subtle`**: `1px solid #E5E0DA` (internal table row dividers and in-card list item separators).
- **`radius-md`**: `6px` (cards, data tables, modals, panels).
- **`radius-sm`**: `4px` (buttons, inputs, `Release Event` badges, rank badges `#1`–`#5`).
- **`radius-pill`**: `9999px` (`Hype Window` toggle pills `24H` / `7D` / `1M` and filter chips).

### Brutalist Hard-Offset Shadow Elevation Scale
- **`shadow-none`**: `0px 0px 0px #121212` (flat elements, table rows, and active/depressed button state via `translate(2px, 2px)`).
- **`shadow-sm`**: `2px 2px 0px #121212` (interactive buttons, dropdown triggers, active toggle pills).
- **`shadow-md`**: `3px 3px 0px #121212` (primary cards, metric containers, and button hover state via `translate(-1px, -1px)`).
- **`shadow-lg`**: `5px 5px 0px #121212` (drawers, modals, floating popovers).

### Core Component Specifications
- **Card Containers**: Background `#FFFFFF`, border `1.5px solid #121212`, `border-radius: 6px`, `box-shadow: 3px 3px 0px #121212`, padding `20px`.
- **Top Row Leaderboard Cards (3-Card 4-Column Layout)**:
  1. **Top Albums**: Ranked `#1`–`#5` canonical `Album`s by `Hype Index` (`0–100`) with an independent in-card `Hype Window` pill switcher (`24H` | `7D` | `1M`), `Combined Artist` — `Album` title, deduplicated `Submission` count badge, and tier-colored `Hype Index` bar (`#68D391` / `#ECC94B` / `#646464`).
  2. **Top Releases**: Ranked `#1`–`#5` physical `Release` pressings by `Hype Index` (`0–100`) with an independent in-card `Hype Window` pill switcher (`24H` | `7D` | `1M`), `Variant` + `Retailer` subtitle, `Release Event` badge, and `Hype Velocity` (`+Δ/hr`).
  3. **Newly Added Releases**: 5 most recently ingested `Release`s ordered by first-seen `Submission` timestamp (`created_utc` DESC) with relative timestamp badge (`12m ago`), `Variant` + `Retailer`, `Release Event` badge, and initial `score` / `num_comments` velocity. No `Hype Window` toggle.
- **Interactive Buttons & `Hype Window` Toggle Pills**:
  - Primary Button: Background `#9B6DFF`, border `1.5px solid #121212`, `border-radius: 4px`, text `#121212` (bold), `box-shadow: 2px 2px 0px #121212`. Hover translates `-1px, -1px` with `3px 3px 0px #121212`; active press translates `+2px, +2px` with `0px 0px 0px #121212`.
  - `Hype Window` Pill Switcher (`24H` / `7D` / `1M`): `border-radius: 9999px`, `1.5px solid #121212`. Active pill uses `#121212` fill with `#FFFFFF` mono text; inactive pill uses `#FFFFFF` fill with `#121212` mono text.
- **Data Tables**:
  - Table header: `#F7F3F0` background with `1.5px solid #121212` bottom divider, uppercase `JetBrains Mono` column labels (`label-mono-sm`).
  - Table rows: `#FFFFFF` background with `1px solid #E5E0DA` horizontal dividers; hover state `#FAF7F5`.
