# Folio — Expense tracker

A React, Vite and Tailwind interface backed by Express and the supplied SQLite database at `backend/db/expsense.sqlite` (the original spelling is intentional).

## Run locally

Requires Node.js 20.19+ and pnpm. From the project directory:

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Open http://127.0.0.1:5173. Sign in with the existing `admin`, `reader1` or `guest1` account credentials. Existing passwords are never replaced automatically. If you do not know your password, run this locally in an interactive terminal:

```sh
pnpm admin:password admin
```

The command prompts without echoing the password. It updates only the named existing account and invalidates its existing sessions. Repeat for `reader1` or `guest1` if needed. No default password is embedded in the application. A newly created database requires `SEED_PASSWORD` (at least 12 characters) for its initial accounts; remove it after initial setup and set individual passwords.

## Record your first expense

1. Sign in as `admin` and open **Shops & items**.
2. Add a shop and an item. Categories and manufacturers are optional.
3. Select **Add expense**, choose the shop, date, currency and item, and enter quantity and unit price.
4. Add more lines if needed, then save. Edit or delete using the row actions.
5. Saving an expense selects its currency and clears search/date filters so it is visible. At sign-in, if your default currency has no entries, the app selects the most recent expense’s currency. Filter by date, currency or text. Overview shows totals, monthly spending and category breakdowns for the selection; Expenses shows the full ledger.

Every user has a private expense ledger. Catalog entries are shared; catalog writes require the database's `userrole_manageshops` permission. The tracker does not grant permissions based on client state. Existing unrelated role flags are preserved.

## Data model and migration

- `001_initial.sql` reproduces the existing schema with `IF NOT EXISTS`.
- `003_catalog_creators.sql` associates shops, categories (ItemTypes), items and manufacturers with their creator using `user_id REFERENCES Users(ID)`. The backend takes this from the authenticated session, ignoring client-supplied creator IDs. API catalog entries expose `userId`. Existing entries retain NULL because their creator is unknown; catalog sharing and permissions remain as before.
- `002_expense_amounts.sql` adds currency, notes, unit prices in integer cents, and fractional quantities. A migration ledger runs each numbered migration once, within a transaction.
- The first server startup makes a consistent SQLite snapshot at `backend/data/before-expense-tracker.sqlite` before applying migrations. Keep an independent backup for each database if changing `DB_PATH`; this automatic snapshot is not overwritten.
- Existing user and role rows are preserved. Empty tables alone trigger seeding.
- Invoice dates use Unix seconds at UTC midnight; new create/update timestamps use Unix milliseconds.
- Quantities support up to three decimal places. Line totals round half a cent upward using integer thousandths; invoice totals sum rounded line totals.
- The supported currencies are EUR, USD, KES, GBP, CHF, CAD and AUD, all with two decimal minor units. EUR is the default, configurable with `DEFAULT_CURRENCY`. No exchange rates or conversions are performed.
- Legacy invoices without priced lines are shown as **Needs pricing**, excluded from summaries, and remain editable.
- This release records purchases and zero-priced items. Refunds, taxes as separate fields, receipt uploads, recurring expenses and currency conversion are outside its scope.

## Verify

```sh
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit
```

Jest and Testing Library cover all application JavaScript, with an enforced minimum of 85% statements, branches, functions and lines. Supertest uses in-memory SQLite for route-to-database integration. Separate unit tests mock filesystem and native database dependencies. Playwright uses a disposable in-memory database and a real production build, including desktop and mobile checks. It never connects to the supplied database. Browser screenshots under `artifacts/` contain synthetic test data.

See `QA_TEST_PLAN.md` for regression scenarios, `backend/openapi.json` for the API contract, and `DEPLOYMENT.md` for production setup.
