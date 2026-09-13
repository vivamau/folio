# Decisions

## 2026-09-06 — Initial Folio application

- Build React/Vite/JavaScript/Tailwind, Express and sqlite3 around the supplied `backend/db/expsense.sqlite`; retain the original filename and all original tables.
- Baseline schema in 001; additive price/quantity/currency/notes migration in 002, guarded by a transactional migration ledger.
- Back up the database with SQLite VACUUM INTO before the first migration. Preserve all existing users and roles.
- Record expenses as invoices with item lines. Store unit prices as integer cents and quantities up to three decimals; round each line using integer thousandths.
- Default to EUR pending the optional user currency preference. Support seven two-decimal currencies and never combine currencies or imply exchange-rate conversion.
- Private per-user ledgers with shared catalog. Backend enforces ownership and catalog-management permission on every operation.
- Use HttpOnly cookie JWTs, strict Origin/CORS, production Secure cookies, login rate limiting, and password-change session invalidation.
- No automatic password replacement. Supply an interactive local password-reset command; seed only empty tables with an explicit environment password.
- Use a warm ledger-inspired interface named Folio. Keep source files below 1000 lines.
- User's explicit build request authorizes proceeding past the startup protocol's confirmation question.

## Catalog creator attribution

Added 003_catalog_creators.sql: user_id foreign keys on Shops, ItemTypes, Items and Manufactures. Backend derives creator from authenticated user, ignores spoofed IDs, and returns userId in creation/catalog responses. Existing records keep NULL creator; shared visibility and permissions preserved. Migration applied to running database; foreign-key check passed. Build and two browser workflows passed; coverage remains 98.25% statements and 93.94% branches.

## Expense visibility fix

Root cause: two existing KES expenses were excluded by the default EUR filter. Startup/login now choose a populated currency when the default is empty. Successful saves switch to the saved currency and clear search/date filters; saving from catalog opens Expenses. Existing expense records were not modified. TDD regressions reproduced EUR-vs-KES failures before implementation. Verified 40 tests, 3 browser workflows, lint and production build; coverage 98.09% statements, 93.71% branches. Regression includes save, Overview, Expenses and reload.

## Monthly snapshots

Implemented immutable per-user monthly expense snapshots, historical Frankfurter v2 FX conversion into EUR/USD/KES/GBP/CHF/CAD/AUD, stored reference and publication dates, and a Monthly summaries page. Scheduler checks every minute using Africa/Nairobi (configurable), durable cursors capture missing/empty months, frozen data precedes FX requests, retries hourly on failure, and rates cache per month. Closed snapshots retain details after live record edits/deletion. Catch-up capture is explicitly labelled as data available at the later capture time. Migration 004 is applied; live users have next_month 2026-09 and no closed snapshots yet. September closes on 1 October local time if the server is running. Free historical API successfully smoke-tested; no external expense/user data sent.

## Ad hoc summaries

Added Create summary date-range dialog with an optional title and current-month-to-date defaults. POST /api/snapshots takes the user from authentication, rejects invalid/future ranges, freezes data and attempts exact reference-date currency conversion immediately. Pending conversions use the existing retry scheduler. Multiple ad hoc captures can coexist for the same range; none alter monthly uniqueness or cursors. Migration 005 preserves monthly IDs/payloads/FX totals, moves the rate cache to exact reference-date keys, and enforces immutable metadata. Running database migrated with both original expenses and all three monthly cursors preserved. Documentation and QA plan updated.

- Shop deletion uses existing catalog-management permission. Any live invoice reference blocks deletion, regardless of invoice owner; frozen summary payloads remain independent. Check and deletion share a write transaction.

- Shop totals represent the signed-in user’s all-time expenses, grouped by original currency. Shared catalog access does not grant access to other users’ spending. Unknown prices are flagged, not silently treated as complete zero totals.

- Allocate category totals from purchased item lines using current catalog category IDs, not category names or whole invoice totals. Keep original currencies and personal all-time scope consistent with shops.

- Interpret cancelling a saved ad hoc report as deleting that snapshot only. Automatic monthly summaries are excluded from the deletion endpoint; missing, foreign-owned and monthly IDs return 404. Pending FX conversion updates cannot recreate a deleted record.

- Weekly buckets use Monday–Sunday, monthly uses calendar months, daily uses recorded expense dates. Show all populated periods rather than silently truncating history; retain the current expense filters and currency.

- Per user request, accept any HTTP/HTTPS port on localhost/127.0.0.1/[::1] in every environment while retaining APP_ORIGIN. No wildcard origin response; unrelated hosts still denied.

- Item dashboards use only the signed-in user’s live invoice lines. Currency selection applies to quantities as well as prices; weeks start Monday. Weighted averages exclude missing prices while quantities include all matching lines. Shops are identified by ID, not name.

- Keep View trends as an accessible button beneath the name because it changes the current catalog view.

- Omit parentheses when no manufacturer is assigned; do not alter persisted item names.

- Shop trends chart total spending rather than a blended unit price across unrelated items. Weighted unit prices remain per-item in the breakdown; partially unpriced lines contribute quantities and are visibly flagged.

- Category trends match catalog totals: only matching lines count, even in mixed-category invoices; currency/date filters remain personal. Empty unrelated invoices do not inflate expense counts.

- Manufacturer trends use current item manufacturer IDs and personal invoice lines, matching category behavior. Unassigned items are excluded.

- Remove totals only from catalog shop/category entries; all trend dashboards retain analytics.

- Use the same 2px name-to-link spacing for shops, items, categories and manufacturers.

- Override only catalog trends padding, retaining the 2px name/link margin and other button styles.

- Expose existing month/week/day choices directly instead of hiding them in a dropdown. Monthly remains the default.

- Reuse existing onClose so outside clicks follow the same per-modal rules as Escape and X.

- Manufacturer uniqueness applies across the shared catalog. Preserve legacy duplicates and references rather than silently merge them; prevent new equivalents through the application insertion path.

- Use existing catalog-manager authorization for category reassignment; preserve creator, item name and manufacturer. Explicit null clears category.

- Display item actions inline while retaining catalog permissions and 2px name-to-actions spacing.
