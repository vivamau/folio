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
