# Expense tracker regression plan

Run `pnpm lint`, `pnpm test:coverage`, `pnpm build`, and `pnpm test:e2e`.

- Migrate a copy of the supplied database twice; preserve users, roles, and existing records.
- Sign in with valid credentials; reject invalid credentials and expired sessions. Verify HttpOnly, SameSite and production Secure cookies.
- Reject unauthenticated API access and writes from unapproved origins.
- Reader accounts cannot maintain catalog entries; every user only reads and modifies their own expenses.
- Add shops, categories, manufacturers, and items; reject blank names and invalid foreign keys.
- Create multi-line expenses with fractional quantities, exact prices, notes and supported currencies.
- Reject impossible dates, negative prices, empty lines, invalid relationships and excessive values without partial writes.
- Edit an expense; verify recalculated totals and persistence after refresh.
- Delete with confirmation; cancel leaves data intact; deletion also removes invoice lines.
- Search by shop, note or item; filter date range and currency. Never sum different currencies.
- Verify empty states, network errors, keyboard focus, mobile layout, and modal focus restoration.
- Run browser workflow against a disposable database, never the supplied database.

- Verify all four catalog creation endpoints store the signed-in user in user_id, ignore spoofed creator IDs, expose userId, and reject invalid foreign keys. Migrating legacy entries must preserve them with NULL creators.

- Save a KES expense while viewing EUR with active search/date filters: switch to KES, clear hiding filters, and show the saved expense. On login/reload, use a populated currency if the configured default has no entries. Verify both Overview and Expenses without combining currencies.

## Monthly snapshots

- Simulate Nairobi month rollover, leap February and December; exclude the current month's expenses.
- Verify exactly one snapshot per user/month, even with concurrent job calls and repeated starts.
- Verify missed and empty months are captured, clearly marking catch-up captures.
- Verify all seven currency totals combine original currencies correctly and round decimal half cents upward once per target total.
- Mock missing/invalid/future/stale FX data and network errors: preserve the expense picture immediately, retry after an hour, and never substitute current rates.
- Verify historical rate dates and source are stored and visible; reuse the same saved rates for a month.
- Edit/delete live expenses and rename shops/items after capture: saved details and totals remain unchanged.
- Verify incomplete legacy expenses remain visible, are excluded from totals, and have an explicit warning.
- Reject unauthorized access and access to another user's summary; no update/delete snapshot API exists.
- Stop the scheduler during a job: drain before closing the database and stop further ticks.
- Browser-test Monthly summaries with a deleted original expense, all currency cards, reload, and mobile width.

## Ad hoc summaries

- Create a current-month/date-range summary without waiting for month-end; show it immediately with all seven currency totals.
- Reject reversed, impossible or future dates. Ignore client-supplied user IDs and snapshot kinds.
- Save the same range twice: retain separate immutable pictures. Keep automatic monthly creation and cursor state independent.
- Use the selected end date as the historical FX reference/cache key; do not reuse another date's rates from the same month.
- Preserve captured expenses through FX outages, later changes and retries.
- Migrate existing monthly IDs, frozen contents, saved totals and cached rates without changes.
- Verify optional titles, cancellation, validation errors, save progress, reload and mobile layout.
