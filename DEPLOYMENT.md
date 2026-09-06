# Deployment guide

## Runtime

Use Node.js 20.19+ as specified by this project. Install dependencies with `pnpm install --frozen-lockfile`, run `pnpm lint`, `pnpm test:coverage`, `pnpm build`, and `pnpm test:e2e`. Audit dependencies with `pnpm audit`; do not deploy with High or Critical findings.

The process binds to `127.0.0.1:3001` by default. Put an HTTPS reverse proxy in front of it. The Express server serves the built React application and API from the same origin.

## Configuration

Copy `.env.example` to `.env`. Set:

- `NODE_ENV=production`
- `PORT=3001`
- `APP_ORIGIN=https://your-expenses-host.example` (exact origin, without a trailing slash)
- `JWT_SECRET` to a cryptographically random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `DB_PATH` only when moving the supplied database; an absolute path is recommended.
- `DEFAULT_CURRENCY=EUR` or another supported currency.
- `SEED_PASSWORD` only for initializing an empty Users table. Use at least 12 characters, then remove it and reset each user's password individually.

Restrict `.env` and database file access to the service account. The `backend/data` directory must exist and be writable. The database's parent directory must also be writable for SQLite journal files. Never expose either directory as public static content.

Start with `pnpm start` under your service manager. Configure the proxy to forward the original Origin header. Production session cookies are HttpOnly, Secure, SameSite=Lax, Path=/, and expire in two hours. JWTs never appear in response bodies or browser storage. Login is rate-limited. Origin checks use a strict allowlist of one configured application origin. With no trusted-proxy configuration, rate limiting behind a reverse proxy uses its IP, so the 30-attempt / 15-minute limit is shared across clients.

## Migration and backup

Before an upgrade, stop application writes and take a SQLite backup. On first startup the server takes a consistent snapshot into `backend/data/before-expense-tracker.sqlite`; it never overwrites that snapshot. If operating a different database via `DB_PATH`, make a separate backup before startup. Migrations are tracked in `SchemaMigrations` and each is transactional. Do not manually remove migration ledger entries. Existing Users and UserRoles are not reseeded.

To restore, stop the service, replace the database with your known-good backup, and deploy the matching application version before starting. Keep an ongoing backup policy; the initial automatic snapshot is not a recurring backup.

## Local account administration

Run `pnpm admin:password admin` from the project directory with the same `DB_PATH` configuration. The password prompt is hidden; the command does not create users. Password changes invalidate existing sessions for that account. Existing accounts can maintain separate expense ledgers; the initial catalog-management permission belongs to `admin`.

In development, omitting JWT_SECRET generates an in-memory secret; restarting the server signs users out. Production refuses to start without a sufficiently long configured secret.

## Automatic month-end snapshots

Keep the Node service running continuously under your service manager. The built-in scheduler starts after database initialization, checks immediately and every minute, and drains in-flight work on graceful shutdown. No OS cron job, Codex automation, account or API key is required. Set `MONTH_END_TIMEZONE` to a valid IANA timezone before startup; the default is `Africa/Nairobi`. Keep this setting stable once snapshots exist.

Allow outbound HTTPS to `api.frankfurter.dev`. Each historical request has a ten-second timeout. FX outages do not stop the API: invoice data is frozen first, and pending conversions retry hourly. Existing cached month-end rates are reused across users. Completed snapshots and their original contents are immutable; `MonthlySnapshotCursors` records progress durably, including empty months. Do not edit snapshot tables or cursor state by hand.

When the process is offline at month-end, the next start catches up. Such snapshots explicitly identify the later capture and contain data as it exists then; they are not a reconstruction of edits made during downtime. Initial history starts at the earliest recorded expense per user (or the installation month for users without earlier expenses). Missed history is processed in bounded batches, and all later months—including empty ones—are captured automatically. Monitor server logs for `Monthly snapshot job failed` (storage/job errors) and the Monthly summaries page for rates pending.

Back up the whole SQLite database: snapshot content, FX cache, and scheduler cursors live there alongside the expense ledger. Restoring only live invoices will lose the frozen historical pictures.

Migration `005_ad_hoc_summaries.sql` preserves existing monthly snapshot IDs/content while allowing multiple independent ad hoc captures. Monthly uniqueness is enforced by a partial index; ad hoc captures never change cursors. The historical-rate cache is now `SnapshotExchangeRates`, keyed by the exact reference date, and existing monthly cached rates are migrated. Immediate creation attempts a rate lookup before responding; the existing hourly retry job also handles pending ad hoc summaries.
