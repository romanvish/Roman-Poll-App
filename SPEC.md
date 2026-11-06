# CFB Top 25 Poll — App Spec

Nov 5, 2026 · @Roman

## Overview

A small Next.js app where approved friends submit a weekly college football Top 25 ballot; the app aggregates ballots into a poll and serves it as JSON to the existing static site.

**In scope**

- Sign-in with admin approval before anyone can vote in the poll, there should be a public page showing each week's poll
- Drag-and-drop ballot with expandable team details (record, conference, all results)
- Weekly voting lifecycle run by admins: open, close, reopen, publish
- Aggregation into a ranked poll with points, first-place votes and others receiving votes
- JSON endpoint matching the static site's current format, plus season export and import
- Admin user management: approve, disable, promote to admin, demote
- Migrating the current static site's display pages and functionality

**Not in scope (v1)**

- Multiple groups or leagues
- Email notifications, real-time tallies, mobile apps

## Stack and hosting

One Next.js app (App Router) on Vercel Hobby, with Neon Postgres on its free plan; no separate backend service and no Redis.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript | Server actions and route handlers for the API |
| Database | Neon Postgres (free) | Use the pooled connection string |
| ORM | Prisma | Migrations checked into the repo |
| Auth | Better Auth | Google OAuth; optional email magic link later |
| Validation | Zod | Shared schemas for client and server |
| UI | Tailwind + shadcn/ui | dnd-kit for drag and drop |
| Hosting | Vercel Hobby | Daily cron for game sync |
| Extra sync | GitHub Actions (optional) | Calls the secured sync route more often on game days |

## Roles, access approval, and auth

Anyone can sign in, but new accounts start as **pending** and see only a waiting screen until an admin approves them.

| Status / role | Can do |
| --- | --- |
| Pending | Sign in, see the waiting screen, edit their own profile |
| Disabled | Nothing; sessions revoked |
| Voter (approved) | Vote, edit their ballot until close, view published results and ballots, edit profile |
| Admin | Everything a voter can, plus user management, week control, sync, export and import |

- Store `status` (pending, approved, disabled) and `role` (voter, admin) as separate columns on the user.
- Bootstrap the first admin with an `ADMIN_EMAILS` environment variable: matching accounts are auto-approved as admins on first sign-in.
- Enforce access in middleware for page routes and again in every server action and route handler. The UI hiding a button is never the check.
- Sign-in: Google OAuth through Better Auth, so there are no passwords or reset emails to handle. Add magic link if user doesn't have google

## Poll rules and decisions (defaults)

These are working defaults so the build can start; each is easy to change before launch.

| Rule | Default |
| --- | --- |
| Scoring | 25 points for #1 down to 1 point for #25 |
| Ballot size | Exactly 25 unique teams to submit; incomplete ballots save as drafts only |
| Eligible teams | FBS teams from the current season's team list in the database; no free text |
| Missed week | No ballot counted; nothing carries over from the prior week |
| Editing | Voters can change a submitted ballot until the week closes |
| Deadline | Stored in UTC, shown in the viewer's local time; the server rejects submissions after it, even if an admin hasn't closed the week |
| Ties | More first-place votes wins; if still tied, teams share the rank |
| Others receiving votes | Listed below the Top 25 with points |
| Ballot visibility | Hidden from other voters until the week is published, then public |
| Week labels | Preseason, Week 1 through the last regular week, Final (after bowls and playoff) |
| Data retention | Keep all seasons in the database; export is a backup, not a purge |

The week lifecycle runs: **draft → open → closed → published**. Admins can reopen a closed week (back to open) and unpublish a published week; both actions are logged.

## Data model

Nine app tables alongside Better Auth's own tables; a full season is only a few thousand rows, so nothing needs purging.

| Table | Key columns | Constraints and notes |
| --- | --- | --- |
| user (Better Auth, extended) | id, email, name, displayName, image, favoriteTeamId, role, status | role: voter or admin; status: pending, approved or disabled |
| season | id, year, isCurrent | One row per year; only one current |
| week | id, seasonId, number, label, status, opensAt, deadline, publishedAt | Unique (seasonId, number); status: draft, open, closed, published |
| team | id (external API id), name, shortName, abbreviation, conference, logoUrl, color, isFbs | Refreshed from the API each season |
| team\_week\_stat | teamId, weekId, wins, losses, confWins, confLosses, lastResult, nextOpponent, extraJson | Unique (teamId, weekId); snapshot of what voters saw that week |
| game | id (external), seasonId, weekNumber, homeTeamId, awayTeamId, homeScore, awayScore, status, startsAt | Raw results from the sync; source for team\_week\_stat |
| ballot | id, userId, weekId, status, submittedAt, updatedAt | Unique (userId, weekId); status: draft or submitted |
| ballot\_entry | ballotId, rank, teamId | Unique (ballotId, rank) and (ballotId, teamId); rank 1–25 |
| week\_result | weekId, teamId, rank, points, firstPlaceVotes, previousRank | Written when a week is published, so results are frozen |
| audit\_log | id, actorId, action, targetType, targetId, details, createdAt | Every admin action |

## Features

**Voter**

- Profile page: display name, avatar (from static upload in repo), favorite team, bio, tagline.
- Current week page: shows status, deadline countdown, and the ballot editor when the week is open.
- Ballot drafts autosave; Submit is enabled only with 25 unique teams.
- After submitting, the voter sees "Submitted" with the time and can keep editing until close.
- Results page per week: Top 25 with points, first-place votes, movement from last week, others receiving votes, and every voter's ballot once published.

**Admin**

- Users: list with filters by status, approve, disable, promote to admin, demote. The last remaining admin cannot be demoted or disabled.
- Weeks: create a week (number, label, deadline), open, close, reopen, publish, unpublish.
- Ballot overview for the open week: who has submitted and who hasn't (not their picks).
- Sync: "Sync now" button plus last-sync time and errors.
- Teams: trigger the season's team refresh from the API and toggle eligibility if needed.
- Audit log viewer.

**Game sync**

- One route, `POST /api/sync`, pulls games for the current season from the external API, upserts `game`, then recalculates `team_week_stat` for the current week.
- Called by Vercel cron daily, optionally by a GitHub Actions schedule on Saturdays, and by the admin button.
- Protected by a `CRON_SECRET` bearer token (admin button uses the admin session instead).
- The external API key is a server-only environment variable.

**Export and import**

- Export a full season as one JSON file: season, weeks, teams, team snapshots, ballots with entries, and results. Voter identities use display names plus a stable user id.
- Import accepts the same format to restore a season, and a separate legacy mode that loads past seasons from the static site's existing JSON as results only.
- Import validates the whole file with Zod, shows a dry-run summary, and writes in one transaction.
- Optional "delete season" exists but only after a fresh export, behind a typed confirmation.

## API routes and JSON output contract

The public JSON route must emit exactly the shape the static site already reads; the example below is a placeholder until a real sample from the static site replaces it.

| Route | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/rankings/latest` | GET | Public | Latest published week, static-site format |
| `/api/rankings/[season]/[week]` | GET | Public | A specific published week, static-site format |
| `/api/sync` | POST | Cron secret or admin | Pull games, refresh team snapshots |
| `/api/admin/export/[season]` | GET | Admin | Download season archive JSON |
| `/api/admin/import` | POST | Admin | Dry run or commit a season archive or legacy file |
| `/api/auth/[...all]` | GET, POST | Public | Better Auth handler |

Ballot saving, submitting, week control and user management are server actions, not public routes.

Public JSON routes return only published weeks, set CORS to the static site's origin, and are cached until the next publish (`revalidateTag`).

```json
{
  "season": 2026,
  "week": 11,
  "label": "Week 11",
  "publishedAt": "2026-11-09T18:00:00Z",
  "voters": 14,
  "rankings": [
    { "rank": 1, "team": "Ohio State", "teamId": 194, "record": "9-0", "points": 346, "firstPlaceVotes": 10, "previousRank": 1 }
  ],
  "othersReceivingVotes": [
    { "team": "Tulane", "teamId": 2655, "points": 12 }
  ],
  "ballots": [
    { "voter": "Sam", "teams": ["Ohio State", "Indiana"] }
  ]
}
```

## Ballot UI details

The ballot is a two-panel editor: a searchable team pool and a ranked list of 25 slots, usable on a phone with one thumb.

- **Team pool:** search box plus conference filter; each team shows logo, name and record. Tap or drag to add to the next empty slot.
- **Ranked list:** 25 numbered slots; drag to reorder with dnd-kit (pointer, touch and keyboard sensors). Drag starts from a grip handle so scrolling still works on mobile.
- **Expandable rows:** tapping a row expands it to show record, conference record, last result, next opponent, and last week's poll rank. Expanded rows collapse automatically when a drag starts.
- **Non-drag controls:** up and down buttons and a "Move to #" input on each row, plus remove. These also serve keyboard and screen-reader users.
- **Prefill:** a "Start from my last ballot" button copies last week's order as a draft.
- **Status bar:** count of filled slots (e.g. 23/25), autosave state, deadline countdown, and the Submit button.
- **Validation:** duplicates are impossible in the UI and rejected by the server; the server re-checks the week is open, the deadline hasn't passed, and all teams are eligible.

## Security checklist

The real risks are unauthorized votes and admin actions, not traffic; every item below is checked on the server.

- [ ] Every server action and route checks session, `status = approved`, and role where needed
- [ ] Ballot writes check ownership, week open, deadline not passed, 25 unique eligible teams
- [ ] Database unique constraints back up the one-ballot and no-duplicate rules
- [ ] `/api/sync` requires `CRON_SECRET`; compare in constant time
- [ ] API key, database URL and auth secret are server-only env vars (never `NEXT_PUBLIC_`)
- [ ] All inputs parsed with Zod; queries only through Drizzle
- [ ] Last-admin guard on demote and disable
- [ ] Audit log row for every admin action
- [ ] Unpublished ballots and results never returned by public routes
- [ ] Import runs in a transaction and refuses files that fail validation
- [ ] Better Auth rate limiting enabled on auth routes

## Build order

Seven milestones, each deployable on its own; milestone 6 is the point the static site can switch over.

1. **Foundation:** Next.js app, Prisma schema and migrations, Neon connection, deploy to Vercel, include docker compose for local testing.
2. **Auth and access:** Better Auth with Google, pending/approved/disabled flow, `ADMIN_EMAILS` bootstrap, middleware, profile page.
3. **Admin users:** user list, approve, disable, promote, demote, last-admin guard, audit log.
4. **Teams and sync:** team import, game sync route, team week snapshots, Vercel cron, admin "Sync now".
5. **Weeks and ballots:** week lifecycle controls, ballot editor with drag and drop and expandable rows, autosave, submit, server validation.
6. **Aggregation and output:** publish writes `week_result`, results page, public JSON routes in the static site's format, CORS and caching.
7. **Export and import:** season archive export, import with dry run, legacy import of past static-site JSON.

## Open questions

- [ ] Paste a real sample of the static site's current JSON so the output contract matches it exactly
- [ ] Which external API, and which fields it offers for the expanded team rows (rankings, stats, schedule)
- [ ] Confirm the defaults in Poll rules, especially missed weeks and ballot visibility
- [ ] Does everyone have a Google account, or is a second sign-in method needed?
- [ ] Should results stay viewable only to approved users, or be public like the JSON?
