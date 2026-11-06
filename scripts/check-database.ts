import assert from "node:assert/strict";
import { db, reportDatabaseError } from "./database";

async function main() {
  await db.$queryRaw`SELECT 1`;
  const [seasons, weeks, teams, voters, ballots, entries, sessions, results] = await Promise.all([
    db.season.count(), db.week.count(), db.team.count(), db.user.count(),
    db.ballot.count(), db.ballotEntry.count(), db.session.count(), db.weekResult.count(),
  ]);
  const demoBallots = await db.ballot.findMany({
    where: { user: { email: { endsWith: "@demo.invalid" } } },
    include: { entries: true, week: { select: { seasonId: true } } },
  });
  for (const ballot of demoBallots) {
    assert.equal(ballot.entries.length, 25);
    assert.equal(new Set(ballot.entries.map((entry) => entry.teamId)).size, 25);
    assert.deepEqual(ballot.entries.map((entry) => entry.rank).sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
    const eligible = await db.seasonTeam.count({ where: { seasonId: ballot.week.seasonId, isFbs: true, isEligible: true, teamId: { in: ballot.entries.map((entry) => entry.teamId) } } });
    assert.equal(eligible, 25);
  }
  console.log(JSON.stringify({ connected: true, seasons, weeks, teams, users: voters, ballots, entries, sessions, results, validDemoBallots: demoBallots.length }, null, 2));
}

main().catch(reportDatabaseError).finally(() => db.$disconnect());
