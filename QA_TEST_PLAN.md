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
