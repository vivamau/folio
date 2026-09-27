# Progress

## Initial expense tracker complete — 2026-09-06

Folio is implemented and running locally at http://127.0.0.1:5173 (API at http://127.0.0.1:3001). Login uses the existing database accounts. Unknown credentials can be reset locally with `pnpm admin:password admin`.

Implemented secure cookie authentication, private invoice CRUD, shared catalog management, currency/date/text filtering, spending summaries and charts, responsive UI, migrations, backup, and documentation.

Verification:
- pnpm lint: passed.
- pnpm test:coverage: 34 tests passed across 6 suites.
- Coverage: statements 98.25%, branches 93.94%, functions 98.10%, lines 98.58%; all global thresholds exceed 85%.
- pnpm build: passed.
- pnpm test:e2e: 2 workflows passed, including mobile overflow and keyboard checks.
- pnpm audit: zero known vulnerabilities of any severity in the final dependency tree.
- Supplied database migrated successfully after creating backend/data/before-expense-tracker.sqlite.
- Original users, roles and catalog rows verified unchanged against the backup; foreign-key check passed.
- Desktop and mobile screenshots in artifacts/ use synthetic test data only.

No pending implementation work. EUR is the configurable default because the optional currency question was unanswered. Existing passwords were not changed.

## Catalog creator attribution

Added 003_catalog_creators.sql: user_id foreign keys on Shops, ItemTypes, Items and Manufactures. Backend derives creator from authenticated user, ignores spoofed IDs, and returns userId in creation/catalog responses. Existing records keep NULL creator; shared visibility and permissions preserved. Migration applied to running database; foreign-key check passed. Build and two browser workflows passed; coverage remains 98.25% statements and 93.94% branches.

## Expense visibility fix

Root cause: two existing KES expenses were excluded by the default EUR filter. Startup/login now choose a populated currency when the default is empty. Successful saves switch to the saved currency and clear search/date filters; saving from catalog opens Expenses. Existing expense records were not modified. TDD regressions reproduced EUR-vs-KES failures before implementation. Verified 40 tests, 3 browser workflows, lint and production build; coverage 98.09% statements, 93.71% branches. Regression includes save, Overview, Expenses and reload.

## Monthly summaries complete

Added Monthly summaries UI, private snapshot read APIs, immutable expense payloads, all-seven-currency conversions using free Frankfurter historical rates, saved rate dates/source, durable per-user month cursors, minute-based automatic scheduling, offline catch-up, and hourly conversion retries. Runs inside the application server. Default timezone Africa/Nairobi; first current-data snapshot due 1 October 2026 for September. Migration 004 applied and all three real-user cursors set to 2026-09; no live expenses were changed. Catch-up snapshots are labelled, not presented as exact reconstructions of downtime edits. README, deployment guide, OpenAPI and QA plan updated.

Verification: 55 unit/integration tests passed; coverage statements 98.18%, branches 93.52%, functions 98.11%, lines 98.67%. Production build and lint passed. Final dependency audit reports zero vulnerabilities. Browser regression covers archived source deletion, all seven currencies, reload/mobile, and fully visible sign-out control after adding a navigation item.

## Ad hoc summaries complete

Create summary is available in Monthly summaries, with optional title and inclusive start/end dates defaulting to month-to-date. Results open immediately, preserve all seven currency conversions and remain independent from scheduled summaries. Existing snapshots/cursors and live expenses preserved by migration 005. Verified 61 tests, 5 browser workflows, lint and production build. Coverage: statements 98.42%, branches 93.52%, functions 98.23%, lines 98.75%. No dependencies added or changed.

## Shop deletion complete

Catalog managers can confirm deletion from Shops & items. Backend checks all users’ live invoices within the delete transaction and returns 409 for referenced shops. Successful deletion refreshes the catalog. Verified 63 unit/integration tests, 6 browser workflows, lint and build; coverage 98.46% statements, 93.73% branches, 98.26% functions, 98.78% lines.

## Shop spending totals complete

Shops & items shows personal all-time totals below each shop name, separately by original currency. Empty shops and unpriced expenses have explicit labels; totals ignore ledger filters and refresh with invoice changes. Verified 65 tests, 7 browser workflows, lint and build. Coverage: statements 98.48%, branches 93.61%, functions 98.28%, lines 98.80%. Mobile screenshot: artifacts/shop-spending-mobile.png.

## Category spending totals complete

Category names now show personal all-time spending by currency, allocated from individual purchased item lines. Priced portions of incomplete expenses remain included; unpriced items are flagged. Reused shop display and lineTotal rounding. Verified 66 tests, 8 browser workflows, lint/build. Coverage: 98.50% statements, 93.78% branches, 98.29% functions, 98.81% lines.

## Ad hoc summary deletion complete

Owners can delete ready or rates-pending ad hoc reports from the detail view after confirmation. Atomic API deletion excludes automatic monthly snapshots and other owners. Expenses, monthly reports and cursors remain unchanged. Verified 68 tests, 9 browser workflows, lint/build and diff whitespace check. Global coverage: 98.55% statements, 93.43% branches, 98.34% functions, 98.85% lines.

## Spending chart intervals complete

Monthly/Weekly/Daily selector added to Spending over time. Weeks start Monday; grouping is timezone-stable and respects the filtered invoices/currency. All populated periods available with internal scrolling. Verified 70 tests, 10 browser workflows, lint/build; coverage 98.58% statements, 93.59% branches, 98.36% functions, 98.87% lines.

## Localhost CORS complete — 2026-09-08

Origin guard and CORS now accept HTTP/HTTPS localhost, 127.0.0.1 and [::1] on any port alongside APP_ORIGIN, including production. Credentialed responses echo accepted origins; malformed/lookalike origins remain blocked. Verified 71 tests, 10 browser workflows, lint/build/diff check; global coverage 98.59% statements, 93.64% branches, 98.38% functions, 98.88% lines.

## Item dashboards complete — 2026-09-11

Every item has View trends in Shops & items. Dashboard includes quantity-weighted unit price and quantity charts, shop breakdown and period/shop table, monthly/weekly/daily grouping, currency and inclusive date filters. Uses private invoice lines; missing prices flagged and quantities retained. Verified 74 tests, 11 browser workflows, lint/build/diff check; coverage 98.58% statements, 93.00% branches, 98.17% functions, 98.83% lines. Desktop/mobile screenshots in artifacts/item-dashboard-*.png.

## Item trends link placement

Moved View trends below each item name. Verified 74 tests, 11 browser workflows (including link position), lint and build.

## Expense item manufacturer labels

New/edit expense dropdowns show Item name (Manufacturer), with bare-name fallback. Verified 75 tests, 12 browser workflows, lint/build.

## Shop trends complete

View trends under each shop opens monthly/weekly/daily spending and quantity charts, expense/item counts, purchased-item breakdown and period table. Currency/date filters use private shop invoices. Verified 77 tests, 13 browser workflows, lint/build/diff checks; global coverage 98.52% statements, 93.23% branches, 97.86% functions, 98.76% lines. Mobile screenshot inspected.

## Category trends complete

Category View trends opens shared purchase dashboard with monthly/weekly/daily spending and quantity, date/currency filters, expense/item counts and per-item breakdown. Only matching category lines contribute, across shops. Verified 79 tests, 14 browser workflows, lint/build/diff checks. Coverage: 98.65% statements, 93.55% branches, 98.27% functions, 98.89% lines. Mobile screenshot inspected.

## Manufacturer trends complete

View trends beneath each manufacturer opens shared dashboard with spending/quantity, item breakdown, counts and monthly/weekly/daily plus date/currency controls. Only matching manufacturer items contribute. Verified 80 tests, 15 browser workflows, lint/build/diff checks. Coverage 98.66% statements, 93.66% branches, 98.29% functions, 98.90% lines. Mobile screenshot inspected.

## Catalog totals removed

Removed inline shop/category totals and spending subtitles from Shops & items. Trends and their totals remain available. Removed unused catalog aggregation/styles and replaced obsolete display assertions with absence checks. Verified 78 tests, 15 browser workflows, lint/build; coverage 98.62% statements, 93.50% branches, 98.26% functions, 98.88% lines.

## Compact trends spacing

Reduced shared View trends margin from 6px to 2px across all four catalog boxes. Verified 78 tests, 15 browser workflows, lint/build.

## Trends padding corrected

Removed inherited 7px vertical text-button padding from all catalog trend links, retaining 2px margin. Verified computed browser padding and mobile screenshot; 78 tests, 15 E2E workflows, lint/build passed.

## Visible chart interval buttons

Replaced trend View dropdown with explicit Monthly/Weekly/Daily pressed-state buttons across item, shop, category and manufacturer dashboards. Both charts and period table regroup while filters stay active. Verified 79 tests, 15 browser workflows, lint/build, mobile screenshot; coverage above 85% globally.

## Modal backdrop dismissal

Clicking outside dialogs now invokes their existing close action. Interior clicks do not dismiss; caller saving guards and focus restoration remain intact. Verified 80 tests, 16 browser workflows, lint/build.

## Manufacturer duplicate prevention

Creation rejects trimmed, case-insensitive, Unicode-normalized duplicates with 409 inside the insertion transaction. Existing records preserved, including nullable legacy names. Verified 82 tests, 17 browser workflows, lint/build; coverage 98.64% statements, 93.58% branches, 98.29% functions, 98.89% lines.

## Item category reassignment

Catalog managers can Change category beside an item, selecting an existing category or Uncategorized. Backend validates permission/item/category and updates only category and update date. Live expenses/trends reclassify; snapshots unchanged. Verified 84 tests, 18 browser workflows, lint/build; coverage 98.67% statements, 93.50% branches, 98.33% functions, 98.91% lines.

## Inline item actions complete

View trends | Change category now appears on one line below each item name. Non-managers see only View trends. Verified 84 tests, 18 browser workflows including alignment, lint and build.

## Saved summary breakdowns complete — 2026-09-16
Added item, category and shop breakdowns with quantities and original/seven-currency totals to existing and new saved reports. Values use frozen invoices and historical saved rates. Pending and empty reports are handled. Updated README, OpenAPI and QA plan.
Verification: lint and production build passed; all 87 unit/integration tests and 18 browser workflows passed. Coverage: statements 98.62%, branches 93.34%, functions 98.09%, lines 98.85%. Reviewed desktop screenshot; mobile overflow check passed. Earlier full runs had intermittent local HTTP response/parser failures at different test requests; isolated suite and final full run passed without weakening assertions. Git status unavailable because system Git requests Xcode license acceptance; no commits attempted.

## Item manufacturer comparison complete — 2026-09-18
Item details show manufacturer or Not specified. Separate comparison panel for same normalized item names across manufacturers shows weighted unit prices, quantities and signed differences from selected item. Shared date/currency filters and private invoice data are reused. No database changes. Red/green tests completed; lint/build passed, 89 unit/integration tests and 19 browser workflows passed. Coverage 98.64% statements, 93.35% branches, 98.14% functions, 98.87% lines. Mobile screenshot reviewed. Initial full run encountered the previously observed intermittent HTTP parser failure in unchanged snapshot tests; final full run passed.

## Summary CSV export complete — 2026-09-19
Added Export as CSV in saved report breakdowns. Downloads all three groupings with quantity and EUR/USD/KES/GBP/CHF/CAD/AUD columns using saved rates, regardless of selected tab/currency. Excel-compatible BOM and quoting, formula-name protection, pending-state disablement. Tests written and run red before implementation. Final validation: lint/build passed; 91 unit/integration tests, 19 browser workflows passed; actual downloaded CSV content verified. Coverage statements 98.67%, branches 93.33%, functions 98.18%, lines 98.89%. Initial backend run encountered socket failure; unchanged tests passed on full rerun.

## Overview category periods complete — 2026-09-26
Added independent Monthly/Weekly/Daily category interval and specific period selector, default All periods. Category amounts and share bars follow selection. Both overview panels now span full available width, category below time chart. Red/green test verified independent filters and Monday weeks. Lint/build, 92 unit/integration tests and 19 browser workflows passed; additional focused browser assertions verified selected totals and panel geometry. Coverage statements 98.68%, branches 93.39%, functions 98.20%, lines 98.90%.

## Summary breakdown sorting complete — 2026-09-27
Added ascending/descending sort buttons for item/category/shop name, quantity and selected-currency spending. Indicators and aria-sort expose state; source snapshot and CSV remain immutable. Original mixed-currency view requires selecting one currency for spending comparison. Red/green regression, lint, build and 93 unit/integration tests passed. Coverage 98.69% statements, 93.36% branches, 98.23% functions, 98.91% lines. Browser suite: 19 workflows passed, including sortable header assertions and CSV download.
