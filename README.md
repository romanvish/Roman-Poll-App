# Roman Poll App

A private weekly college football Top 25 poll for friends. The app uses Next.js 16 App Router, TypeScript, Neon PostgreSQL, Prisma 7 migrations, Better Auth with Google OAuth, Zod, Tailwind, shadcn/ui, and dnd-kit. Production hosting targets Vercel Hobby.

The app includes approval-based sign-in, profiles, admin user and season controls, CFBD team/game sync, weekly ballots, poll aggregation and publication, public results, rankings JSON, and full season archive export/import. Published editions include searchable ballots, shareable comparisons, weekly superlatives, and voter profiles with historical insight. Imported legacy data stays separate from authenticated users and provider team IDs while appearing in the public archive, voter, and team-history pages.

`Roman-Poll/` is read-only reference material. Voter portraits and available team logos are copied into this app's `public/` assets. The legacy bundle builder reads the reference data and writes only to the ignored `.tmp/` directory.

## Local setup (PowerShell)

Install Node.js **24.x**, npm, and Docker Desktop with Linux containers. Google Chrome is needed only for browser smoke checks.

~~~powershell
Copy-Item .env.example .env
npm ci
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
~~~

Open http://localhost:3000. The seed creates a 2026 season, 32 illustrative FBS teams, three fictional approved voters, and three sample ballots. These demo accounts have no Google provider account or session. The public home page stays empty until an admin publishes a poll or imports the legacy archive.

Inspect the local database with Prisma Studio:

~~~powershell
npm run db:studio
~~~

Compose runs PostgreSQL 17 on `127.0.0.1:54329`, with a persistent volume and health check. The local connection strings in `.env.example` match Compose. To stop and resume without deleting local data, run `docker compose stop`, then `docker compose up -d --wait`.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env` or expose server credentials through a `NEXT_PUBLIC_` variable. Values are validated when their subsystem is used, so public builds do not require Google or CFBD credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | App queries; use Neon’s pooled connection URL in production. |
| `DIRECT_URL` | Direct Neon URL for Prisma migrations and Studio. |
| `BETTER_AUTH_SECRET` | Session signing secret, at least 32 characters. |
| `BETTER_AUTH_URL` | App origin, with no path. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `ADMIN_EMAILS` | Comma-separated emails bootstrapped as approved admins at first account creation. |
| `CRON_SECRET` | At least 32 characters; secures scheduled `/api/sync` requests. |
| `GAME_API_KEY` | CFBD bearer token, used only by server-side sync. |
| `GAME_API_BASE_URL` | CFBD API origin; defaults to `https://api.collegefootballdata.com`. |
| `STATIC_SITE_ORIGIN` | Origin allowed to read rankings JSON. |

Add these authorized redirect URIs to the Google OAuth client: local `http://localhost:3000/api/auth/callback/google` and production `https://your-app-domain.example/api/auth/callback/google`. Set `BETTER_AUTH_URL` to the corresponding app origin. Generate a secret locally with PowerShell:

~~~powershell
$authBytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
[Convert]::ToBase64String($authBytes)
~~~

Copy the output into the local or hosting environment. Do not put it in a tracked file.

## Bootstrap the first admin

1. Configure Google OAuth and set the `BETTER_AUTH_*` and `GOOGLE_*` values.
2. Set `ADMIN_EMAILS` to your Google account email before its first sign-in.
3. Sign in. A newly created matching account becomes an approved admin; other new accounts start pending.
4. Open **Users** in the admin area to approve friends. Disabling a user revokes sessions. The last approved admin cannot be disabled or demoted.

The bootstrap applies when Better Auth creates the user. It does not promote an account that already exists.

## Migrations and fixtures

Generate Prisma and apply committed migrations with `npm run db:generate`, `npm run db:deploy`, and `npm run db:status`. For an intentional local schema change, use `npm run db:migrate -- --name describe_the_change`, then `npm run db:generate`.

Keep the Prisma schema and migration SQL together. Migrations include checks Prisma cannot express directly, including ballot ranks 1–25, nonnegative records and poll totals, valid foreign keys, distinct game participants, FBS eligibility, and at most one current season. Result ranks can tie and can exceed 25 for others receiving votes.

Seeding is explicit and idempotent. It is never part of builds, migrations, or deployment. Seed and database verification tools refuse remote database hosts.

## Import the historical 2026 archive

The legacy importer supports the static site's voter and team registries plus published Weeks 0 through 7. With `Roman-Poll/` beside this repository, build a validated JSON bundle:

~~~powershell
npm run legacy:bundle
~~~

For a different source location, pass `--source "C:\path\to\Roman-Poll"`. The generated `.tmp/roman-poll-2026-legacy.json` is ignored by Git. Sign in as an approved admin, open **Admin → Season data**, select **Legacy static-site bundle**, choose that JSON file, run **Validate and preview**, then **Import season**. Matching weeks are updated on re-import. Legacy voter IDs stay separate from sign-in accounts, and team slugs stay separate from CFBD IDs; exact-name provider matches are linked when unique.

To import the same archive in production, generate the bundle locally and upload it through the production admin page after deploying the migration. The source repository is not modified and does not need to be deployed with the app.

## App behavior

- **Sign-in:** Google OAuth only. New accounts are pending voters unless bootstrapped through `ADMIN_EMAILS`.
- **Ballots:** Approved accounts can save incomplete drafts. Submission requires 25 unique eligible FBS teams. Server writes recheck approval, week status, opening time, deadline, and eligibility. PostgreSQL backs up uniqueness and rank rules.
- **Admin:** User access, team eligibility, week transitions, publication, sync, import, and export are audited. Admin pages and actions check the current database role and status.
- **Sync:** `/api/sync` accepts a constant-time compared `Authorization: Bearer $CRON_SECRET` or a same-origin approved admin request. It imports FBS teams and games, then refreshes snapshots for the open week. Vercel invokes it daily at 12:00 UTC; the admin **Sync now** control uses the same route.
- **Publication:** Publishing a closed week aggregates 25-to-1 points, uses first-place votes as the tie-breaker, shares unresolved ranks, and freezes results. Published rankings include weekly superlatives for consensus, debate, climbers, and bold ballots. Voter profiles compare their latest and season-long rankings with the field. Public pages and routes never return unpublished ballots or rankings.
- **Public output:** `/api/rankings/latest` and `/api/rankings/[season]/[week]` expose only published weeks from app or imported history. App formatting is centralized in `lib/poll/serialize.ts`; legacy rankings preserve the source points, average-rank tie break, sequential ordering, and historical movement. Legacy `teamId` values remain slugs unless a unique exact provider-team match exists. Set `STATIC_SITE_ORIGIN` to the static site's origin.
- **Archive:** Admins can export full season JSON, run Zod validation and conflict checks, then restore an archive in one database transaction. Legacy history uses separate voter/team tables and is safe to re-import without creating duplicate editions.

The game sync uses CFBD's `/teams/fbs` and `/games` operations. A valid `GAME_API_KEY` is required for real requests; `db:verify-sync` uses an injected mock and never calls CFBD.

## Verification commands

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:status`, `npm run db:check`, `npm run db:verify`, `npm run db:verify-sync`, `npm run db:verify-archive`, and `npm run test:smoke`.

`db:verify` checks database constraints and rolls back its scenarios. `db:verify-sync` uses local-only temporary IDs and mocked CFBD data, verifies repeat-sync idempotence and snapshots, then removes its rows. Playwright checks desktop and phone widths, guest redirects, published-only JSON behavior, keyboard navigation, and responsive overflow. Google callback and live CFBD requests require real credentials and are not covered by local smoke checks.

## Neon and Vercel deployment

No Neon project or Vercel deployment has been provisioned or verified.

1. Create a Neon PostgreSQL database. Set `DATABASE_URL` to its pooled URL and `DIRECT_URL` to its direct, unpooled URL; retain TLS parameters such as `sslmode=require`.
2. Import this repository into Vercel with the Next.js preset and Node.js 24.x. Use `npm ci` and `npm run build`; do not configure static export or a legacy GitHub Pages base path.
3. Set production environment values in Vercel. Connect Preview to a separate Neon branch/database.
4. Before deploying, run `npm run db:deploy` and `npm run db:status` against the intended database from a trusted terminal. Do not run the demo seed in production or Preview.
5. Deploy and verify the public home page, Google sign-in, `/api/sync` authorization, and configured rankings JSON route.

Builds generate Prisma but never migrate or seed. Run production migrations explicitly before deployment. Vercel's daily cron reads `CRON_SECRET`; no separate backend or Redis service is used.
