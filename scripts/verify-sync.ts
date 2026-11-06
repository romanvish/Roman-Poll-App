import assert from "node:assert/strict";
import { db, reportDatabaseError, requireLocalDatabase } from "./database";
import { syncCurrentSeason } from "../lib/server/sync";

const teamIds = [900_000_001, 900_000_002];
const gameId = 1_900_000_001;
const now = new Date("2026-11-06T18:00:00Z");
const runStarted = new Date();

const providerTeams = [
  { id: teamIds[0], school: "Verification North", mascot: "North", abbreviation: "VERN", conference: "Verification League", color: "123456", logos: [] },
  { id: teamIds[1], school: "Verification South", mascot: "South", abbreviation: "VERS", conference: "Verification League", color: "654321", logos: [] },
];
const providerGames = [{
  id: gameId, season: 2026, week: 10, startDate: "2026-11-01T18:00:00Z",
  homeId: teamIds[0], homeTeam: "Verification North", homeConference: "Verification League", homeClassification: "fbs", homePoints: 28,
  awayId: teamIds[1], awayTeam: "Verification South", awayConference: "Verification League", awayClassification: "fbs", awayPoints: 7,
  status: "completed",
}];

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/teams/fbs")) return Response.json(providerTeams);
  if (url.pathname.endsWith("/games")) return Response.json(providerGames);
  return Response.json({ error: "Unexpected verification URL" }, { status: 404 });
};

async function cleanUp() {
  await db.$transaction(async (tx) => {
    const season = await tx.season.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (season) await tx.teamWeekStat.deleteMany({ where: { teamId: { in: teamIds }, week: { seasonId: season.id } } });
    await tx.game.deleteMany({ where: { id: gameId } });
    await tx.seasonTeam.deleteMany({ where: { teamId: { in: teamIds } } });
    await tx.team.deleteMany({ where: { id: { in: teamIds } } });
    await tx.syncLog.deleteMany({ where: { createdAt: { gte: runStarted } } });
  });
}

async function main() {
  requireLocalDatabase();
  process.env.GAME_API_KEY = "local-sync-verification-key";
  process.env.GAME_API_BASE_URL = "https://api.collegefootballdata.com";
  const existing = await db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true } });
  assert.equal(existing.length, 0, "verification team IDs must be unused");
  try {
    const first = await syncCurrentSeason(null, fakeFetch, now);
    assert.deepEqual(first, { season: 2026, teams: 2, games: 1, snapshots: 2 });
    const currentWeek = await db.week.findFirst({ where: { status: "open", season: { isCurrent: true } }, select: { id: true } });
    assert.ok(currentWeek, "an open week is required to verify snapshots");
    const snapshot = await db.teamWeekStat.findUniqueOrThrow({ where: { teamId_weekId: { teamId: teamIds[0], weekId: currentWeek.id } } });
    assert.equal(snapshot.wins, 1);
    assert.equal(snapshot.confWins, 1);
    const second = await syncCurrentSeason(null, fakeFetch, now);
    assert.deepEqual(second, first, "repeated sync should return stable counts");
    assert.equal(await db.game.count({ where: { id: gameId } }), 1);
    assert.equal(await db.seasonTeam.count({ where: { teamId: { in: teamIds } } }), 2);
    console.log("PASS mocked team/game sync and snapshots");
    console.log("PASS repeated sync is idempotent");
  } finally {
    await cleanUp();
  }
}

main().catch(reportDatabaseError).finally(() => db.$disconnect());
