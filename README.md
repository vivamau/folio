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
- The supported currencies are EUR, USD, KES, GBP, CHF, CAD and AUD, all with two decimal minor units. EUR is the default, configurable with `DEFAULT_CURRENCY`. The live ledger does not combine currencies; monthly snapshots provide saved reference conversions.
- Legacy invoices without priced lines are shown as **Needs pricing**, excluded from summaries, and remain editable.
- This release records purchases and zero-priced items. Refunds, taxes as separate fields, receipt uploads and recurring expenses are outside its scope.

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

## Monthly snapshots

Open **Monthly summaries** to view an immutable picture of each completed month. The server checks every minute and captures the previous month after midnight in `MONTH_END_TIMEZONE` (default `Africa/Nairobi`). It saves a separate private snapshot for each user, including months with no expenses after tracking starts.

Each snapshot stores:

- Expense count, original totals by currency, and complete invoice/item details as they existed when captured.
- The same combined monthly spending expressed in every supported currency: EUR, USD, KES, GBP, CHF, CAD and AUD. These are alternative values of the same total; do not add them together.
- Historical exchange rates, their individual publication dates, the requested month-end date, capture/completion timestamps, and the provider URL.
- An explicit warning when legacy expenses lack prices. Those expenses remain in the snapshot but are excluded from totals.

Rates come from [Frankfurter v2](https://frankfurter.dev/), a free, no-key historical exchange-rate API. Only currency codes and dates are sent to it. The app requests month-end rates with EUR as the common base; for weekends/holidays it accepts earlier published rates up to ten days old and records those dates. Missing, future, invalid or older rates leave conversion pending rather than substituting current rates. Conversion uses exact decimal fractions and rounds the final total once per target currency to cents. Reference conversions are estimates, not the actual rate charged by your bank.

The expense picture is saved **before** fetching exchange rates. If the service is unavailable, conversion retries each hour without recapturing expenses. Rates are cached by month, and completed snapshots cannot be overwritten. Editing or deleting a live expense, shop or item never changes a saved snapshot.

The server must be running to capture at month-end. On restart it catches up from each user's earliest historical expense, or from the month tracking was enabled when there are no earlier expenses. It processes at most 24 missed months per user per pass and resumes on subsequent checks. Catch-up snapshots are labelled: they reflect the records available when the server returned, because changes made while it was offline cannot be reconstructed. Expenses added later to an already captured month do not alter its snapshot.

### Create a summary now

In **Monthly summaries**, click **Create summary**. Choose start/end dates (inclusive) and an optional title, then **Save summary**. The form defaults to this month through today. Future end dates are rejected. Any signed-in user can capture their own expenses without catalog-administration permission.

Ad hoc summaries are labelled separately and appear immediately after saving. Each uses reference rates for the selected end date and preserves the exact captured expenses. You can save the same date range again to capture a later version; earlier snapshots remain unchanged. Creating one does not replace an automatic monthly snapshot or advance the monthly schedule. Failed rate requests leave the saved picture pending for automatic retries.

Catalog managers can delete shops from **Shops & items** using the trash button. Deletion requires confirmation and is blocked if any user's expense references the shop. Saved expense summaries remain unchanged.

To remove an ad hoc report, open it in **Monthly summaries**, choose **Delete summary**, and confirm. Only its owner can delete it. Automatic monthly summaries and the original expenses are preserved.

**Spending over time** supports Monthly, Weekly and Daily views. Weekly periods run Monday–Sunday. The chart respects the active expense filters and currency, shows periods containing priced expenses, and scrolls horizontally for longer histories.

Open **Shops & items → View trends** beside an item for its purchase dashboard. Choose Monthly, Weekly or Daily, a currency and optional dates to compare quantity-weighted unit prices, quantities purchased and shops used. The dashboard uses only your expenses; missing prices are flagged and currencies remain separate.

Each shop also has **View trends** beneath its name. Its dashboard shows spending and quantities by month/week/day, expense and item counts, and a purchased-item breakdown with quantities and average unit prices. Currency/date filters apply to your own expenses only.

Categories have **View trends** too, showing personal spending and quantities over time, expense/item counts and an item breakdown. Mixed-category purchases contribute only the lines belonging to that category.

Manufacturers also offer **View trends**, with the same monthly/weekly/daily dashboard and filters, restricted to purchases of their assigned items.

Trend dashboards display **Monthly**, **Weekly** and **Daily** buttons under **Chart view**. Select one to regroup both charts and the period breakdown while retaining the current date and currency filters.

Manufacturer creation rejects existing names regardless of capitalization or surrounding whitespace. The form shows an error and keeps the entered name for correction.

Catalog managers can select **Change category** beside an item to reassign it or choose **Uncategorized**. Existing expenses and live category trends follow the new assignment; saved summaries retain their captured categories.
