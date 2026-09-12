# Lessons learned

## 2026-09-06

- Inspect SQLite schema and record counts before building; this schema had no amount or currency fields.
- JavaScript decimal multiplication can round `0.575 * 100` down incorrectly. Convert quantities to integer thousandths before computing line totals. Regression tests cover API, summary, and form.
- Explicit accessible labels on selects give consistent browser and Testing Library behavior.
- An absolutely positioned sr-only table label can escape a static scroll container and expand page width. A positioned scroll container fixes it without hiding overflow globally.
- Await the actual server listening event before resolving startup; otherwise readiness and test lifecycle can race.
- Node 20 requires compatible major versions of Babel and build tooling. Audit the resolved lockfile, not only direct dependencies.
- pnpm native dependency scripts need explicit allowBuilds entries. Do not install independent dependency sets concurrently because pnpm rewrites workspace build policy.
- Disable Watchman in Jest within this filesystem sandbox; Supertest and browser servers need approved local-port execution.
- Disable animations for visual screenshots to capture the final rendered state.

- Creator attribution must come from the authenticated backend user. Do not guess creators for legacy rows or accept IDs from the request body.

- When a saved record appears missing, inspect persisted currency and active filters first. A default currency must not make a populated ledger appear empty on startup.

- Month-end FX outages must not postpone freezing the expense records: capture first, convert the frozen data later, and persist retry/cursor state. Keep original currency totals and source dates so conversions are reproducible.
- Clearly identify catch-up snapshots; the database cannot reconstruct edits made while the app was offline.

- Ad hoc summary rates must be cached by the exact range end date, not just by month; otherwise partial-month and month-end captures can share incorrect rates.
- Browser fixture API calls must await completed sign-in before using its session cookies.

- Expense creation fixtures must use the API’s decimal-string unitPrice field; unitPriceCents is a response field.

- Currency formatting may already contain the currency code (KES); avoid duplicating it when adding explicit currency labels. Catalog totals must describe their own scope rather than inherit the ledger’s selected currency footer.

- An invoice with an unpriced line can still contribute its priced lines to category totals. Count missing item prices separately to expose incomplete totals.

- Snapshot deletion must scope by both owner and ad_hoc kind in the SQL mutation itself. Existing pending conversion updates affect only remaining rows, so no scheduler cancellation state is needed.

- Parse date-only ledger values at UTC midnight and use UTC date arithmetic/formatting so browser timezone and daylight-saving changes do not move chart buckets.

- Updating CORS alone is insufficient when a separate Origin guard runs first: both layers must share the same predicate.

- Filter controls outside a form need explicit styling; inspect mobile screenshots for label/input collisions even when overflow tests pass.

- Browser fixtures should create required shops rather than depend on earlier test execution.

- Filter category lines before grouping purchases so mixed-category invoice totals and unrelated quantities cannot leak into trends.

- For visual spacing, inspect inherited padding and line boxes as well as margins; text-button had 7px vertical padding despite a 2px margin.
