# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19 + TypeScript + Tailwind CSS frontend paired with a Python (`uv`) HTTP API backend reading from the PostgreSQL + `pgvector` database populated by `..\reddit-scrape`.

## Users

Vinyl retailers and record store buyers deciding which upcoming releases, reissues, and restocks to procure and in what quantities. They work under tight distributor pre-order deadlines and allocation windows, where over-ordering ties up capital in dead stock and under-ordering misses high-demand pressings.

## Product Purpose

Helps vinyl retailers predict release demand and discover high-conviction titles to stock by translating Reddit community activity into procurement intelligence. Success means buyers spot breakout releases early, size orders with evidence rather than guesswork, and act before limited pressings or allocations sell out.

## Positioning

Standalone web product that turns live Reddit vinyl community signals—post velocity, upvote and comment momentum, variant discussions, and sell-out mentions in communities like `r/VinylReleases` and `r/vinyl`—into retailer-focused demand forecasting and procurement recommendations, rather than serving collectors managing personal catalogs or relying solely on lagging historical sales data.

## Operating Context

Retail buyers review distributor sheets, label announcements, and restock alerts across dozens or hundreds of weekly titles. Instead of manually refreshing subreddits and threads to gauge collector appetite, they use the product during buying cycles to scan release momentum, evaluate demand scores for upcoming and restocked pressings, and receive watchlist or digest alerts when high-signal releases spike.

## Capabilities and Constraints

- **Subreddit hype & velocity tracking:** Monitors activity across vinyl communities (such as `r/VinylReleases` and `r/vinyl`), capturing post volume, engagement velocity, comment sentiment, and sell-out mentions.
- **Release demand scoring & procurement recommendations:** Aggregates community momentum into clear demand signals for upcoming releases, reissues, and restocked pressings to guide stocking decisions.
- **Watchlists, alerts, and digest feeds:** Notifies buyers and store owners when tracked artists, labels, or high-signal releases spike in community activity.
- **Open / undecided product facts:** Final product brand name (beyond the working repo name `vinyl-reddit-app`), Reddit API / ingestion architecture, external catalog integrations (such as Discogs or distributor feeds, not currently confirmed), pricing model, and alert delivery channels remain open decisions.

## Evidence on Hand

Greenfield repository with no application scaffold, sample release datasets, brand assets, or live Reddit data pipelines yet. Future work must not fabricate retailer testimonials, store logos, historical forecast accuracy benchmarks, pricing tiers, or live partner integrations.

## Product Principles

1. **Signal over chatter:** Distill raw subreddit threads and comment volume into actionable buying velocity and demand indicators a retailer can evaluate in seconds.
2. **Explainable demand scores:** Always show the underlying community evidence (thread velocity, engagement spikes, sell-out mentions, recency) behind a procurement recommendation so buyers can trust and verify the call.
3. **Built for buying workflows:** Organize views around the decisions retailers actually make—what is spiking right now, what upcoming pre-orders warrant deeper stock, and what watched releases just moved.
4. **Honest data provenance:** Clearly distinguish live or observed community metrics from estimates, and never invent market proof or historical performance.
