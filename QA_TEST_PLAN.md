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

## Shop deletion
- As a catalog manager, delete an unused shop from Shops & items, confirm, and reload: it remains absent from the catalog and expense shop choices.
- Cancel the confirmation: the shop remains.
- Try deleting a shop referenced by your expense or another user's expense: show an explanatory error and retain the shop and all expenses. Remove the related expenses and retry: deletion succeeds.
- Read-only users see no shop deletion action; direct requests return 403. Signed-out requests return 401; invalid IDs return 400 and missing shops return 404.
- Historical frozen summaries retain their shop names after an unused live shop is deleted.

## Delete ad hoc summaries
- Open an ad hoc summary and select Delete summary. Keep summary or close the dialog: report remains. Confirm Delete permanently: report disappears from list and detail, including after reload.
- Delete both ready and rates-pending reports; subsequent scheduler runs must not recreate ad hoc reports.
- Verify failed deletion keeps the confirmation open and displays a retryable error.
- Another user cannot delete the report (404); unauthenticated requests return 401 and invalid IDs return 400. Automatic monthly reports have no delete action and are excluded by the endpoint (404).
- Original expenses, automatic monthly reports, and monthly schedule cursors remain unchanged.

## Spending over time intervals
- Monthly is the default. Switch to Weekly and Daily: bar totals regroup while spending cards and other filters remain unchanged.
- Weeks start Monday and include Sunday; verify weeks spanning months/years. Date grouping and labels must not shift with browser timezone.
- Sum multiple expenses in one period. Exclude other currencies and unpriced expenses; retain valid zero totals. Dates/periods with no expenses have no bar.
- Verify empty charts for each selection, selected date/search/currency filters, and mobile layout. Long histories scroll inside the chart without widening the page.

## Localhost CORS
- OPTIONS preflights and authenticated API requests accept HTTP/HTTPS localhost, 127.0.0.1 and [::1] on any port. Responses echo the origin, allow credentials, and vary by Origin.
- Configured APP_ORIGIN continues to work, including production. No-Origin requests remain supported; authentication is still required.
- Reject null, malformed, non-HTTP, path-bearing and lookalike-domain Origin values with 403.

## Item purchase dashboards
- Open View trends beside any item in Shops & items (including read-only accounts). Back to shops & items restores the catalog; unused items show an empty state.
- Monthly/Weekly/Daily charts show quantity-weighted average unit prices and quantities for the chosen currency. Monday-start weeks can span months/years. Date filters are inclusive and operate on recorded expense dates.
- An expense containing other items contributes only matching lines. Sum fractional quantities accurately; retain zero prices. Missing prices still contribute quantity, but are excluded from price/spend with a visible warning.
- Where you bought it lists each shop's quantity, weighted price and spending. Purchases by period lists the shops used in each month/week/day.
- Switch currency and dates, edit an expense and reopen/reload: results reflect the current personal ledger. Another account cannot see your purchase history.
- Verify both charts and tables on desktop/mobile; wide tables and long charts scroll internally without page overflow.
- Item catalog layout: View trends appears directly below its item name, remains keyboard accessible, and opens that item's dashboard.

## Expense item labels
- New/edit expense item selectors display Item name (Manufacturer) when assigned; unassigned items show only the item name. Select same-named items with different manufacturers and verify the intended item ID is saved.

## Shop trends
- View trends below a shop opens its personal dashboard, with monthly/weekly/daily spending and quantity charts, expense count and distinct-item count.
- Currency/date filters exclude other currencies, shops and out-of-range expenses. Monday weeks and inclusive dates match item trends.
- Items purchased shows quantities, weighted unit prices and spending per item. Period rows show spending and items bought in that period. Missing prices are flagged while quantities remain included.
- Empty shops/currencies have an empty state; Back returns to catalog. Verify mobile overflow, interval changes and account privacy.

## Category trends
- View trends under a category opens its monthly/weekly/daily dashboard with spending, quantities, expense count and distinct-item count.
- Mixed-category expenses contribute only matching item lines. Use category IDs, not names; ignore unassigned items. Expenses without matching lines are not counted.
- Verify weighted item unit prices, missing-price warnings, multiple shops, date/currency filters, empty categories and account privacy.
- Check mobile layout, interval switches and Back navigation; category amounts match the corresponding expense lines.

## Manufacturer trends
- View trends under each manufacturer opens its dashboard with spending/quantity charts, counts and an item breakdown.
- Mixed purchases contribute only items assigned to that manufacturer ID. Unassigned items and other manufacturers are excluded; missing prices are flagged.
- Verify Monthly/Weekly/Daily, currency/date filters, empty state, Back navigation, account privacy and mobile layout.

## Catalog totals removed
- Shops and Categories show names and View trends without spending totals, pricing notices or all-time spending subtitles. Addresses, management actions and trend dashboard totals remain available. Verify after reload and on mobile.
- Everyday essentials: all View trends links sit 2px below their names in Shops, Items, Categories and Manufacturers; links remain functional.
- View trends overrides the shared text-button padding to 0; verify the computed top padding is 0px and margin is 2px so inherited padding cannot reopen the name/link gap.

## Visible trend chart views
- Item, shop, category and manufacturer dashboards show Monthly/Weekly/Daily buttons under Chart view. Monthly starts selected; selecting another updates both charts and period rows, and exposes aria-pressed correctly.
- Currency and date filters remain active across interval changes. Verify keyboard access and mobile layout.

## Modal outside click
- Click the backdrop to dismiss an open modal without submitting; clicks on fields, content or empty space inside the dialog must not dismiss it.
- Verify focus returns to the opener and scrolling is restored. Existing saving guards, Escape and X-button behavior remain intact.

## Manufacturer duplicates
- Create a manufacturer, then retry the same name, different capitalization and surrounding whitespace: API returns 409 and the form shows A manufacturer with this name already exists without closing.
- Two simultaneous requests for equivalent names create exactly one record. Uniqueness applies to the shared catalog across creators.
- Correct the rejected name and save successfully. Existing manufacturers/items remain unchanged.

## Change item category
- Catalog managers select Change category beside an item. Current category is preselected; save a new category or Uncategorized, then reload to verify persistence.
- Existing expenses and category trends reflect the new assignment; saved snapshots retain their original labels. Name, manufacturer and creator remain unchanged.
- Reject unauthorized callers, invalid IDs and nonexistent categories without changes. Form errors remain visible; cancellation makes no update.
- Item actions appear inline as View trends | Change category beneath the name. The separator and category action appear only for catalog managers; both actions remain functional and compact on mobile.

## Saved report breakdowns
- Open existing monthly and newly created ad hoc reports; switch By item / By category / By shop. Verify names, quantities and totals against frozen expenses.
- Switch all seven currencies and original currencies; mixed source amounts remain separate in original mode.
- Edit/delete live purchases and rename/reassign catalog entries: saved breakdowns must remain unchanged.
- Verify pending conversions show original amounts and disabled currency control; empty/unpriced reports show clear empty states.
- Verify mobile controls and tables fit, keyboard controls work, and another user cannot access the report.

## Item manufacturer comparison
- Open item trends and verify manufacturer name, including Not specified for missing metadata.
- Create same-name items with distinct manufacturers; verify comparison box, weighted unit prices, quantities and signed differences from selected item.
- Verify case/whitespace matching, unrelated names excluded, and no comparison for a single manufacturer.
- Change currency/date range: both item history and comparison update. Missing prices show Unpriced/Not available, never a zero price. Purchases remain scoped to signed-in user.
- Verify comparison table scrolls within its panel on mobile.

## Summary CSV export
- Open a generated monthly/ad hoc summary, switch tab/currency and export CSV. Verify all item/category/shop rows are included and all seven currency columns match saved rates.
- Open in Excel or import as UTF-8 comma-separated data: verify numeric decimals, accents, commas, quotes and multiline names. Formula-like names must remain text.
- Verify pending reports disable export and empty ready reports export column headers. Confirm later live catalog edits do not alter saved export names.

## Overview category periods
Verify Monthly/Weekly/Daily category intervals and specific period selection, All periods totals, correct category shares, Monday week boundaries, currency changes and independent spending interval. Confirm both overview panels span the same full width, category below time chart, on desktop and mobile.

## Breakdown sorting
Click name, quantity and spent headers in all three summary tabs; verify ascending/descending indicators and numeric ordering (2 before 10). Change currency and verify spent order follows it. Original-currency mode requires a single currency before spending sorting. Check keyboard activation, empty tables, immutable source rows and existing CSV export.
