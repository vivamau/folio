# Implementation

## 2026-09-06

- Added dependency manifest, lockfile, build/lint/Jest/Playwright configurations, and Node 20-compatible tooling.
- Wrote API, UI, and E2E tests before application modules; observed missing-module failures.
- Implemented promise-based sqlite3 adapter, serial transactions, migration ledger, empty-table-only seeding, and first-start backup.
- Implemented cookie login/logout/me, protected catalog creation/listing, private invoice CRUD/filtering, exact monetary validation, and safe API errors.
- Implemented Folio login, overview with totals/monthly/category charts, expense ledger, reusable catalog/expense forms, keyboard-accessible modal, and responsive styles.
- Added startup and interactive password administration utilities; verified password changes invalidate sessions.
- Added regression tests first for half-cent rounding; observed 57 instead of 58 cents, then fixed calculations in API and UI.
- Added native DB/filesystem mock unit tests and migration preservation tests against a copy of the supplied database.
- Browser-tested login, catalog creation, expense create/edit/reload/delete/logout, mobile layout, and modal keyboard behavior using a disposable database.
- Added README, deployment guide, OpenAPI contract, QA plan and synthetic-data preview screenshots.

## Catalog creator attribution

Added 003_catalog_creators.sql: user_id foreign keys on Shops, ItemTypes, Items and Manufactures. Backend derives creator from authenticated user, ignores spoofed IDs, and returns userId in creation/catalog responses. Existing records keep NULL creator; shared visibility and permissions preserved. Migration applied to running database; foreign-key check passed. Build and two browser workflows passed; coverage remains 98.25% statements and 93.94% branches.

## Expense visibility fix

Root cause: two existing KES expenses were excluded by the default EUR filter. Startup/login now choose a populated currency when the default is empty. Successful saves switch to the saved currency and clear search/date filters; saving from catalog opens Expenses. Existing expense records were not modified. TDD regressions reproduced EUR-vs-KES failures before implementation. Verified 40 tests, 3 browser workflows, lint and production build; coverage 98.09% statements, 93.71% branches. Regression includes save, Overview, Expenses and reload.

## Monthly snapshots

Implemented immutable per-user monthly expense snapshots, historical Frankfurter v2 FX conversion into EUR/USD/KES/GBP/CHF/CAD/AUD, stored reference and publication dates, and a Monthly summaries page. Scheduler checks every minute using Africa/Nairobi (configurable), durable cursors capture missing/empty months, frozen data precedes FX requests, retries hourly on failure, and rates cache per month. Closed snapshots retain details after live record edits/deletion. Catch-up capture is explicitly labelled as data available at the later capture time. Migration 004 is applied; live users have next_month 2026-09 and no closed snapshots yet. September closes on 1 October local time if the server is running. Free historical API successfully smoke-tested; no external expense/user data sent.

## Ad hoc summaries

Added Create summary date-range dialog with an optional title and current-month-to-date defaults. POST /api/snapshots takes the user from authentication, rejects invalid/future ranges, freezes data and attempts exact reference-date currency conversion immediately. Pending conversions use the existing retry scheduler. Multiple ad hoc captures can coexist for the same range; none alter monthly uniqueness or cursors. Migration 005 preserves monthly IDs/payloads/FX totals, moves the rate cache to exact reference-date keys, and enforces immutable metadata. Running database migrated with both original expenses and all three monthly cursors preserved. Documentation and QA plan updated.

## Shop deletion

Added DELETE /api/shops/:id with server-side catalog permission, positive-ID validation, existence check and transactional all-user invoice reference check. Added accessible trash action and confirmation/error/reload handling; documented API and QA scenarios. No schema or dependency change.

## Shop spending totals

Pass the existing authenticated invoice list into Catalog and aggregate once by shop/currency in integer cents. Render totals beneath names and pricing notices for incomplete records. Reuse money formatting, add wrapping mobile styles, and clarify catalog/footer scope. Tests cover sum, currencies, zero/missing prices, ignored filters, reload and account privacy.

## Category totals

Catalog maps item IDs to category IDs, sums rounded line totals by category/currency, and renders reusable Spending beneath shops and categories. No API or schema change. Regression covers mixed categories, multiple invoices, fractional amounts, zero/missing prices, reload, mobile layout and account isolation.

## Delete ad hoc summaries

Added DELETE /api/snapshots/:id with ID validation and atomic owner/kind predicate. UI offers confirmation, cancellation, loading state and retryable errors; successful removal clears the selected detail and removes its list entry. API docs, QA plan and README updated. No schema or dependencies changed.

## Chart intervals

Added tested spendingPeriods helper in format.js and interval state/select to Dashboard. Reused bar chart, added UTC date labels and horizontal overflow handling. Tests cover year-boundary weeks, mixed currencies, missing/zero amounts and mobile switching.

## Localhost CORS

Shared allowedOrigin predicate in createApp validates URL scheme, exact loopback hostname and canonical origin. Used by both early 403 guard and dynamic CORS callback. Preflights work before authentication; cookie/session settings preserved. Deployment guide and QA plan updated.

## Item purchase dashboards

Added ItemDashboard with tested itemHistory aggregation, internal catalog navigation and reusable UTC periodKey shared with the overview chart. Price averages weight unit prices by quantities; quantities summed as integer thousandths. Added filter styling and scrolling chart/table layouts; browser verification includes two shops, interval changes, date filtering and account privacy. No DB or dependencies changed.

- Catalog trends action moved from record actions into name column with 6px spacing. Browser regression checks vertical placement.

- ExpenseForm resolves manufacturerId against catalog manufacturers for option labels; values remain item IDs. Regression covers labels, fallback and browser selection.

## Shop trends

Extended the existing purchase dashboard with a shop mode and tested shopHistory aggregation. Reuses filters, charts, quantity/price arithmetic and period grouping. Catalog shop link opens scoped dashboard. QA/README updated, no schema/dependency changes.

## Category trends

Added categoryInvoices/categoryHistory helpers using current catalog item/category IDs and reusing grouped purchase aggregation. Dashboard and catalog navigation support category scope without API/schema changes. QA/README updated.

## Manufacturer trends

Generalized catalog invoice-line filtering to accept categoryId or manufacturerId. Reused grouped dashboard, added catalog manufacturer navigation and manufacturerHistory regression. No DB/dependency changes.

- Catalog no longer calculates or renders inline spending. Removed unused Spending component/styles; retained all dashboard navigation and invoices. Updated README and QA plan to reflect requested removal.

- Updated item-trends-link margin-top to 2px; browser regression checks the shared gap and continued navigation.

- item-trends-link now explicitly overrides padding to zero. Shared button styles elsewhere are preserved.

- Shared trend dashboard now uses an accessible Chart view button group; existing interval grouping reused. Updated interaction tests and QA/README.

- Modal backdrop click handler checks target equals currentTarget before invoking onClose; tests cover interior clicks, outside dismissal, no save and restored focus.

- Manufacturer POST compares normalized existing names inside BEGIN IMMEDIATE transaction. UI uses existing error handling and retains entered text. Added concurrency, legacy NULL and browser correction regressions; docs updated.

- Added PATCH /items/:id/category and ItemCategoryForm with current selection, clear option and existing error handling. App reloads catalog/invoices after success. QA, README and OpenAPI updated.

- Moved Change category into the item-name action group, with an aria-hidden separator and shared compact styling.
