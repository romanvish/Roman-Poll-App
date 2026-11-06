import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { db, reportDatabaseError, requireLocalDatabase } from "./database";

type Context = {
  tx: Prisma.TransactionClient;
  userId: string;
  seasonId: string;
  weekId: string;
  ballotId: string;
  teamA: number;
  teamB: number;
};
type Scenario = { label: string; run: (context: Context) => Promise<unknown>; rejects?: string };

const scenarios: Scenario[] = [
  { label: "new users default to pending voters", run: async ({ tx, userId }) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.status, "pending"); assert.equal(user.role, "voter");
  } },
  { label: "one season per year", rejects: "P2002", run: ({ tx }) => tx.season.create({ data: { year: 9999 } }) },
  { label: "one week number per season", rejects: "P2002", run: ({ tx, seasonId }) => tx.week.create({ data: { seasonId, number: 1, label: "Duplicate", deadline: new Date() } }) },
  { label: "one team membership per season", rejects: "P2002", run: ({ tx, seasonId, teamA }) => tx.seasonTeam.createMany({ data: [{ seasonId, teamId: teamA }, { seasonId, teamId: teamA }] }) },
  { label: "one ballot per voter per week", rejects: "P2002", run: ({ tx, userId, weekId }) => tx.ballot.create({ data: { userId, weekId } }) },
  { label: "no duplicate ballot ranks", rejects: "P2002", run: ({ tx, ballotId, teamB }) => tx.ballotEntry.create({ data: { ballotId, rank: 1, teamId: teamB } }) },
  { label: "no duplicate teams in a ballot", rejects: "P2002", run: ({ tx, ballotId, teamA }) => tx.ballotEntry.create({ data: { ballotId, rank: 2, teamId: teamA } }) },
  ...[0, 26].map((rank): Scenario => ({ label: `reject ballot rank ${rank}`, rejects: "ballot_entry_rank_check", run: ({ tx, ballotId, teamB }) => tx.ballotEntry.create({ data: { ballotId, rank, teamId: teamB } }) })),
  { label: "ballot team foreign key", rejects: "P2003", run: ({ tx, ballotId }) => tx.ballotEntry.create({ data: { ballotId, rank: 2, teamId: -1 } }) },
  ...["wins", "losses", "confWins", "confLosses"].map((field): Scenario => ({ label: `reject negative ${field}`, rejects: "team_week_stat_records_check", run: ({ tx, weekId, teamA }) => tx.teamWeekStat.create({ data: { teamId: teamA, weekId, [field]: -1 } }) })),
  ...["points", "firstPlaceVotes"].map((field): Scenario => ({ label: `reject negative result ${field}`, rejects: "week_result_totals_check", run: ({ tx, weekId, teamA }) => tx.weekResult.create({ data: { weekId, teamId: teamA, rank: 1, points: 25, firstPlaceVotes: 1, [field]: -1 } }) })),
  ...["homeScore", "awayScore"].map((field): Scenario => ({ label: `reject negative ${field}`, rejects: "game_scores_check", run: ({ tx, seasonId, teamA, teamB }) => tx.game.create({ data: { id: 2_000_000_000, seasonId, weekNumber: 1, homeTeamId: teamA, awayTeamId: teamB, status: "final", [field]: -1 } }) })),
  { label: "ineligible FCS membership", rejects: "season_team_eligibility_check", run: ({ tx, seasonId, teamA }) => tx.seasonTeam.create({ data: { seasonId, teamId: teamA, isFbs: false, isEligible: true } }) },
  { label: "at most one current season", rejects: "P2002", run: async ({ tx, seasonId }) => {
    await tx.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    await tx.season.update({ where: { id: seasonId }, data: { isCurrent: true } });
    await tx.season.create({ data: { year: 9998, isCurrent: true } });
  } },
  { label: "tied result ranks and others receiving votes are allowed", run: async ({ tx, weekId, teamA, teamB }) => {
    await tx.weekResult.createMany({ data: [
      { weekId, teamId: teamA, rank: 26, points: 1, firstPlaceVotes: 0 },
      { weekId, teamId: teamB, rank: 26, points: 1, firstPlaceVotes: 0 },
    ] });
    assert.equal(await tx.weekResult.count({ where: { weekId, rank: 26 } }), 2);
  } },
  { label: "incomplete drafts can be stored", run: async ({ tx, ballotId }) => {
    const ballot = await tx.ballot.findUniqueOrThrow({ where: { id: ballotId }, include: { entries: true } });
    assert.equal(ballot.status, "draft"); assert.equal(ballot.entries.length, 1);
  } },
];

async function main() {
  requireLocalDatabase();
  const before = await db.user.count();
  for (const scenario of scenarios) {
    const rollback = new Error("Rollback successful verification");
    try {
      await db.$transaction(async (tx) => {
        const unique = randomUUID();
        const user = await tx.user.create({ data: { email: `${unique}@verification.invalid`, name: "Constraint verification" } });
        const season = await tx.season.create({ data: { year: 9999 } });
        const week = await tx.week.create({ data: { seasonId: season.id, number: 1, label: "Verification", deadline: new Date() } });
        const teamA = 2_000_000_001;
        const teamB = 2_000_000_002;
        await tx.team.createMany({ data: [teamA, teamB].map((id) => ({ id, name: "Verification", shortName: "Test", abbreviation: "TEST" })) });
        const ballot = await tx.ballot.create({ data: { userId: user.id, weekId: week.id, entries: { create: { rank: 1, teamId: teamA } } } });
        await scenario.run({ tx, userId: user.id, seasonId: season.id, weekId: week.id, ballotId: ballot.id, teamA, teamB });
        throw rollback;
      }, { timeout: 15_000 });
    } catch (error) {
      if (!scenario.rejects) {
        assert.equal(error, rollback, scenario.label);
      } else {
        assert.notEqual(error, rollback, `${scenario.label}: database accepted invalid data`);
        const details = error instanceof Error ? `${error.message} ${JSON.stringify("meta" in error ? error.meta : {})}` : "";
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
        assert.ok(code === scenario.rejects || details.includes(scenario.rejects), `${scenario.label}: expected ${scenario.rejects}, received ${code || "an unexpected error"}`);
      }
    }
    console.log(`PASS ${scenario.label}`);
  }
  assert.equal(await db.user.count(), before, "Verification must leave no test users behind");
  console.log(`${scenarios.length} database scenarios passed; all changes rolled back.`);
}

main().catch((error) => {
  if (error instanceof assert.AssertionError) { console.error(error.message); process.exitCode = 1; }
  else reportDatabaseError(error);
}).finally(() => db.$disconnect());
