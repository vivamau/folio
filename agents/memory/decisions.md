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
