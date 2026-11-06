CREATE TABLE "legacy_voter" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "affiliation" TEXT,
  "photo_path" TEXT,
  "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bio" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "links" JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "legacy_voter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT NOT NULL,
  "logo_path" TEXT,
  "provider_team_id" INTEGER,
  CONSTRAINT "legacy_team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_edition" (
  "id" TEXT NOT NULL,
  "season" INTEGER NOT NULL,
  "week" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ(3),
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "editorial" JSONB,
  CONSTRAINT "legacy_edition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_ballot" (
  "edition_id" TEXT NOT NULL,
  "voter_id" TEXT NOT NULL,
  CONSTRAINT "legacy_ballot_pkey" PRIMARY KEY ("edition_id", "voter_id")
);

CREATE TABLE "legacy_ballot_entry" (
  "edition_id" TEXT NOT NULL,
  "voter_id" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "team_id" TEXT NOT NULL,
  CONSTRAINT "legacy_ballot_entry_pkey" PRIMARY KEY ("edition_id", "voter_id", "rank"),
  CONSTRAINT "legacy_ballot_entry_edition_id_voter_id_fkey" FOREIGN KEY ("edition_id", "voter_id") REFERENCES "legacy_ballot"("edition_id", "voter_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "legacy_ballot_entry_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "legacy_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legacy_ballot_entry_rank_check" CHECK ("rank" BETWEEN 1 AND 25)
);

CREATE TABLE "legacy_team_rank" (
  "id" TEXT NOT NULL,
  "edition_id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "first_place_votes" INTEGER NOT NULL,
  "previous_rank" INTEGER,
  "record" TEXT NOT NULL,
  "rank_spread" INTEGER NOT NULL,
  "rank_standard_deviation" DOUBLE PRECISION NOT NULL,
  "average_rank" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "legacy_team_rank_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legacy_team_rank_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "legacy_edition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "legacy_team_rank_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "legacy_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legacy_team_rank_edition_id_team_id_key" UNIQUE ("edition_id", "team_id"),
  CONSTRAINT "legacy_team_rank_rank_check" CHECK ("rank" > 0),
  CONSTRAINT "legacy_team_rank_points_check" CHECK ("points" >= 0),
  CONSTRAINT "legacy_team_rank_first_place_votes_check" CHECK ("first_place_votes" >= 0),
  CONSTRAINT "legacy_team_rank_previous_rank_check" CHECK ("previous_rank" IS NULL OR "previous_rank" > 0)
);

CREATE INDEX "legacy_team_provider_team_id_idx" ON "legacy_team"("provider_team_id");
CREATE UNIQUE INDEX "legacy_edition_season_week_key" ON "legacy_edition"("season", "week");
CREATE INDEX "legacy_edition_is_published_published_at_idx" ON "legacy_edition"("is_published", "published_at");
CREATE INDEX "legacy_team_rank_edition_id_rank_idx" ON "legacy_team_rank"("edition_id", "rank");
CREATE INDEX "legacy_team_rank_team_id_edition_id_idx" ON "legacy_team_rank"("team_id", "edition_id");

ALTER TABLE "legacy_team" ADD CONSTRAINT "legacy_team_provider_team_id_fkey" FOREIGN KEY ("provider_team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legacy_ballot" ADD CONSTRAINT "legacy_ballot_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "legacy_edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legacy_ballot" ADD CONSTRAINT "legacy_ballot_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "legacy_voter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
