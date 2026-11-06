-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('voter', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'approved', 'disabled');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('draft', 'open', 'closed', 'published');

-- CreateEnum
CREATE TYPE "BallotStatus" AS ENUM ('draft', 'submitted');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "displayName" TEXT,
    "avatarPath" TEXT,
    "favoriteTeamId" INTEGER,
    "role" "UserRole" NOT NULL DEFAULT 'voter',
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "bio" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagline" TEXT,
    "title" TEXT,
    "affiliation" TEXT,
    "location" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "week" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'draft',
    "opensAt" TIMESTAMPTZ(3),
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "editorial" JSONB,

    CONSTRAINT "week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "conference" TEXT,
    "logoUrl" TEXT,
    "color" TEXT,
    "isFbs" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_team" (
    "seasonId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "conference" TEXT,
    "isFbs" BOOLEAN NOT NULL DEFAULT false,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "season_team_pkey" PRIMARY KEY ("seasonId","teamId")
);

-- CreateTable
CREATE TABLE "team_week_stat" (
    "teamId" INTEGER NOT NULL,
    "weekId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "confWins" INTEGER NOT NULL DEFAULT 0,
    "confLosses" INTEGER NOT NULL DEFAULT 0,
    "lastResult" JSONB,
    "nextOpponent" JSONB,
    "extraJson" JSONB,

    CONSTRAINT "team_week_stat_pkey" PRIMARY KEY ("teamId","weekId")
);

-- CreateTable
CREATE TABLE "game" (
    "id" INTEGER NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3),

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "status" "BallotStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ballot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballot_entry" (
    "ballotId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "ballot_entry_pkey" PRIMARY KEY ("ballotId","rank")
);

-- CreateTable
CREATE TABLE "week_result" (
    "weekId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "firstPlaceVotes" INTEGER NOT NULL,
    "previousRank" INTEGER,

    CONSTRAINT "week_result_pkey" PRIMARY KEY ("weekId","teamId")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_status_role_idx" ON "user"("status", "role");

-- CreateIndex
CREATE INDEX "user_favoriteTeamId_idx" ON "user"("favoriteTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "season_year_key" ON "season"("year");

-- CreateIndex
CREATE INDEX "week_status_publishedAt_idx" ON "week"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "week_seasonId_number_key" ON "week"("seasonId", "number");

-- CreateIndex
CREATE INDEX "season_team_teamId_idx" ON "season_team"("teamId");

-- CreateIndex
CREATE INDEX "team_week_stat_weekId_idx" ON "team_week_stat"("weekId");

-- CreateIndex
CREATE INDEX "game_seasonId_weekNumber_idx" ON "game"("seasonId", "weekNumber");

-- CreateIndex
CREATE INDEX "game_homeTeamId_idx" ON "game"("homeTeamId");

-- CreateIndex
CREATE INDEX "game_awayTeamId_idx" ON "game"("awayTeamId");

-- CreateIndex
CREATE INDEX "ballot_weekId_status_idx" ON "ballot"("weekId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ballot_userId_weekId_key" ON "ballot"("userId", "weekId");

-- CreateIndex
CREATE INDEX "ballot_entry_teamId_idx" ON "ballot_entry"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ballot_entry_ballotId_teamId_key" ON "ballot_entry"("ballotId", "teamId");

-- CreateIndex
CREATE INDEX "week_result_weekId_rank_idx" ON "week_result"("weekId", "rank");

-- CreateIndex
CREATE INDEX "week_result_teamId_idx" ON "week_result"("teamId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_favoriteTeamId_fkey" FOREIGN KEY ("favoriteTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week" ADD CONSTRAINT "week_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_team" ADD CONSTRAINT "season_team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_team" ADD CONSTRAINT "season_team_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_week_stat" ADD CONSTRAINT "team_week_stat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_week_stat" ADD CONSTRAINT "team_week_stat_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot_entry" ADD CONSTRAINT "ballot_entry_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "ballot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot_entry" ADD CONSTRAINT "ballot_entry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_result" ADD CONSTRAINT "week_result_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_result" ADD CONSTRAINT "week_result_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL invariants not representable in the Prisma schema.
-- This partial index allows many archived seasons and at most one current season.
CREATE UNIQUE INDEX "season_one_current" ON "season" ("isCurrent") WHERE "isCurrent" = true;

ALTER TABLE "ballot_entry" ADD CONSTRAINT "ballot_entry_rank_check" CHECK ("rank" BETWEEN 1 AND 25);
ALTER TABLE "week" ADD CONSTRAINT "week_number_check" CHECK ("number" >= 0);
ALTER TABLE "team_week_stat" ADD CONSTRAINT "team_week_stat_records_check"
  CHECK ("wins" >= 0 AND "losses" >= 0 AND "confWins" >= 0 AND "confLosses" >= 0);
ALTER TABLE "game" ADD CONSTRAINT "game_scores_check"
  CHECK (("homeScore" IS NULL OR "homeScore" >= 0) AND ("awayScore" IS NULL OR "awayScore" >= 0));
ALTER TABLE "game" ADD CONSTRAINT "game_week_check" CHECK ("weekNumber" >= 0);
ALTER TABLE "game" ADD CONSTRAINT "game_distinct_teams_check" CHECK ("homeTeamId" <> "awayTeamId");
ALTER TABLE "season_team" ADD CONSTRAINT "season_team_eligibility_check" CHECK (NOT "isEligible" OR "isFbs");
ALTER TABLE "week_result" ADD CONSTRAINT "week_result_totals_check"
  CHECK ("points" >= 0 AND "firstPlaceVotes" >= 0 AND "rank" >= 1 AND ("previousRank" IS NULL OR "previousRank" >= 1));
