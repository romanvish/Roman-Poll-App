import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { parseEnvironment } from "@/lib/schemas/environment";
import { gameApiGameListSchema, gameApiTeamListSchema } from "@/lib/schemas/game-api";
import { syncEnvironmentSchema } from "@/lib/schemas/sync-environment";
import { buildTeamSnapshots } from "@/lib/sync/snapshot";
import { getDatabase } from "@/lib/server/db";
import { recordAdminAction } from "@/lib/server/audit";

export class SyncConfigurationError extends Error {
  constructor() { super("Game sync is not configured. Check the server environment."); this.name = "SyncConfigurationError"; }
}

export class GameApiError extends Error {
  constructor(status: number) { super(`The game data provider returned HTTP ${status}.`); this.name = "GameApiError"; }
}

function apiUrl(base: string, path: string, year: number) {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("year", String(year));
  if (path === "games") {
    url.searchParams.set("seasonType", "both");
    url.searchParams.set("classification", "fbs");
  }
  return url;
}

async function getJson(url: URL, key: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new GameApiError(response.status);
  return response.json() as Promise<unknown>;
}

function abbreviation(name: string) {
  const letters = name.normalize("NFKD").replace(/[^a-zA-Z]/g, "").toUpperCase();
  return letters.slice(0, 6) || "TEAM";
}

export async function syncCurrentSeason(actorId: string | null, fetcher: typeof fetch = fetch, now = new Date()) {
  const env = syncEnvironmentSchema.safeParse(process.env);
  if (!env.success) throw new SyncConfigurationError();
  const config = parseEnvironment(syncEnvironmentSchema, process.env);
  const db = getDatabase();
  const season = await db.season.findFirst({ where: { isCurrent: true }, select: { id: true, year: true } });
  if (!season) throw new Error("There is no current season to synchronize.");

  const [teamPayload, gamePayload] = await Promise.all([
    getJson(apiUrl(config.GAME_API_BASE_URL, "teams/fbs", season.year), config.GAME_API_KEY, fetcher),
    getJson(apiUrl(config.GAME_API_BASE_URL, "games", season.year), config.GAME_API_KEY, fetcher),
  ]);
  const teams = gameApiTeamListSchema.parse(teamPayload);
  const games = gameApiGameListSchema.parse(gamePayload).filter((game) => game.season === season.year);
  const allTeams = new Map(teams.map((team) => [team.id, {
    id: team.id, name: team.school, shortName: team.mascot?.trim() || team.school,
    abbreviation: team.abbreviation?.trim() || abbreviation(team.school),
    conference: team.conference ?? null, logoUrl: team.logos?.[0] ?? null,
    color: team.color ? `#${team.color.replace(/^#/, "")}` : null, isFbs: true,
  }]));
  for (const game of games) {
    for (const side of [
      { id: game.homeId, name: game.homeTeam, conference: game.homeConference },
      { id: game.awayId, name: game.awayTeam, conference: game.awayConference },
    ]) {
      if (!allTeams.has(side.id)) allTeams.set(side.id, {
        id: side.id, name: side.name, shortName: side.name, abbreviation: abbreviation(side.name),
        conference: side.conference ?? null, logoUrl: null, color: null, isFbs: false,
      });
    }
  }
  const seasonMemberships = [...allTeams.values()].map((team) => ({ seasonId: season.id, teamId: team.id, conference: team.conference, isFbs: team.isFbs }));
  const currentWeek = await db.week.findFirst({
    where: { seasonId: season.id, status: "open" }, orderBy: { number: "desc" }, select: { id: true },
  });
  const snapshots = currentWeek ? buildTeamSnapshots(teams.map((team) => team.id), games, now) : [];

  await db.$transaction(async (tx) => {
    if (actorId) {
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
      if (!actor || actor.role !== "admin" || actor.status !== "approved") throw new Error("ADMIN_REQUIRED");
    }
    const teamValues = [...allTeams.values()];
    for (let offset = 0; offset < teamValues.length; offset += 100) {
      const chunk = teamValues.slice(offset, offset + 100);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "team" ("id", "name", "shortName", "abbreviation", "conference", "logoUrl", "color", "isFbs")
        VALUES ${Prisma.join(chunk.map((team) => Prisma.sql`(${team.id}, ${team.name}, ${team.shortName}, ${team.abbreviation}, ${team.conference}, ${team.logoUrl}, ${team.color}, ${team.isFbs})`))}
        ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "shortName" = EXCLUDED."shortName", "abbreviation" = EXCLUDED."abbreviation", "conference" = EXCLUDED."conference", "logoUrl" = EXCLUDED."logoUrl", "color" = EXCLUDED."color", "isFbs" = EXCLUDED."isFbs"
      `);
    }
    for (let offset = 0; offset < seasonMemberships.length; offset += 100) {
      const chunk = seasonMemberships.slice(offset, offset + 100);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "season_team" ("seasonId", "teamId", "conference", "isFbs", "isEligible")
        VALUES ${Prisma.join(chunk.map((team) => Prisma.sql`(${team.seasonId}, ${team.teamId}, ${team.conference}, ${team.isFbs}, ${team.isFbs})`))}
        ON CONFLICT ("seasonId", "teamId") DO UPDATE SET "conference" = EXCLUDED."conference", "isFbs" = EXCLUDED."isFbs"
      `);
    }
    for (let offset = 0; offset < games.length; offset += 100) {
      const chunk = games.slice(offset, offset + 100);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "game" ("id", "seasonId", "weekNumber", "homeTeamId", "awayTeamId", "homeScore", "awayScore", "status", "startsAt")
        VALUES ${Prisma.join(chunk.map((game) => Prisma.sql`(${game.id}, ${season.id}, ${game.week}, ${game.homeId}, ${game.awayId}, ${game.homePoints}, ${game.awayPoints}, ${game.status}, ${new Date(game.startDate)})`))}
        ON CONFLICT ("id") DO UPDATE SET "seasonId" = EXCLUDED."seasonId", "weekNumber" = EXCLUDED."weekNumber", "homeTeamId" = EXCLUDED."homeTeamId", "awayTeamId" = EXCLUDED."awayTeamId", "homeScore" = EXCLUDED."homeScore", "awayScore" = EXCLUDED."awayScore", "status" = EXCLUDED."status", "startsAt" = EXCLUDED."startsAt"
      `);
    }
    if (currentWeek && snapshots.length) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "team_week_stat" ("teamId", "weekId", "wins", "losses", "confWins", "confLosses", "lastResult", "nextOpponent")
        VALUES ${Prisma.join(snapshots.map((entry) => Prisma.sql`(${entry.teamId}, ${currentWeek.id}, ${entry.wins}, ${entry.losses}, ${entry.confWins}, ${entry.confLosses}, ${JSON.stringify(entry.lastResult)}::jsonb, ${JSON.stringify(entry.nextOpponent)}::jsonb)`))}
        ON CONFLICT ("teamId", "weekId") DO UPDATE SET "wins" = EXCLUDED."wins", "losses" = EXCLUDED."losses", "confWins" = EXCLUDED."confWins", "confLosses" = EXCLUDED."confLosses", "lastResult" = EXCLUDED."lastResult", "nextOpponent" = EXCLUDED."nextOpponent"
      `);
    }
    await tx.syncLog.create({ data: { seasonId: season.id, status: "success", teamCount: teams.length, gameCount: games.length } });
    if (actorId) await recordAdminAction(tx, {
      actorId, action: "sync.run", targetType: "season", targetId: season.id,
      details: { teamCount: teams.length, gameCount: games.length, snapshotCount: snapshots.length },
    });
  }, { timeout: 55_000 });

  return { season: season.year, teams: teams.length, games: games.length, snapshots: snapshots.length };
}
