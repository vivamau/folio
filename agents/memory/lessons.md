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
