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
