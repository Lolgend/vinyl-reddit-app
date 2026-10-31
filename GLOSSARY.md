# Vinyl Demand & Intelligence Domain

Domain vocabulary for vinyl retail procurement intelligence, demand forecasting, community hype tracking, and release discography navigation based on `r/vinylreleases` data.

## Language

**Album**:
A canonical musical work derived by grouping physical releases sharing a normalized `(Combined Artist, album_title)` identity, with edition or anniversary descriptors stripped into `Variant`. Aggregates community demand metrics and engagement velocity across the deduplicated union of `Submission`s linked to any of its child `Release`s so multi-variant announcements are never double-counted.
_Avoid_: Title, record, LP, project

**Release**:
A distinct physical vinyl pressing or commercial edition of an `Album`, uniquely identified by `(combined_artist, album_title, variant, retailer_name)`. Aggregates community demand metrics solely from the `Submission`s linked to that specific pressing.
_Avoid_: Record, vinyl, drop, product, SKU

**Artist**:
An individual musical creator, performer, composer, or band contributing to a release. Multi-artist releases associate each contributing artist individually alongside a combined billing.
_Avoid_: Creator, musician, singer

**Combined Artist**:
The collaborative or split billing representation of multiple artists on a single release or album (e.g., `Converge / Dropdead` or `Kanye West & Ty Dolla $ign`).
_Avoid_: Dual artist, joint name, multi-band

**Variant**:
A specific physical pressing variation of a release, such as color pressing, vinyl weight (e.g., 180g), packaging type, or limited edition pressing count.
_Avoid_: Edition, colorway, version

**Retailer**:
The exclusive retail storefront, record store, webstore, or label issuing or distributing a specific release (e.g., `Rough Trade`, `Blood Records`, `Target`, `VMP`).
_Avoid_: Store, seller, merchant, vendor

**Submission**:
A raw community post imported from the `r/vinylreleases` subreddit representing an announcement, pre-order, or restock link.
_Avoid_: Post, thread, article, listing

**Submission Snapshot**:
A point-in-time timestamped observation of a submission's engagement metrics (`score`, `upvote_ratio`, `num_comments`, `captured_at`) used to construct time-series velocity curves.
_Avoid_: Metric check, poll log, vote record

**Hype Velocity**:
The window-scoped rate of change of composite community engagement (upvotes and weighted comments per hour) across an active `Hype Window`, aggregated across the deduplicated union of `Submission`s linked to a `Release`, `Album`, or `Artist`.
_Avoid_: Popularity speed, vote rate, hype momentum, peak hype velocity

**Hype Index**:
A normalized composite score ($0–100$) that balances `Hype Velocity`, cumulative window engagement, and upvote ratio with window-scaled freshness decay over time.
_Avoid_: Trending score, rank score, hotness

**Hype Window**:
A defined historical activity window (`24H`, `7D`, `1M` / `30D`) across which `Submission Snapshot` deltas and newly posted `Submission`s are evaluated to compute `Hype Velocity`, `Hype Index`, and stepped time-series trajectories across leaderboards, directory views, and entity detail screens.
_Avoid_: Timeframe, leader period, date range

**Last Seen**:
The timestamp of the most recent `Submission` mentioning an `Album`, `Release`, or `Artist` on `r/vinylreleases`, displayed at the top level of entity detail views to contextualize low or zero `Hype Index` readings when no recent window activity has occurred.
_Avoid_: Last scraped, last updated, last polled
