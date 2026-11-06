import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, reportDatabaseError, requireLocalDatabase } from "./database";
import { seasonArchiveSchema } from "../lib/schemas/season-archive";
import { buildSeasonArchive, checkArchiveImport, importSeasonArchive } from "../lib/server/season-archive";

const year = 2198;
const teamIds = [910_000_001, 910_000_002];
const userId = randomUUID();

async function main() {
  requireLocalDatabase();
  const data = seasonArchiveSchema.parse({
    format: "roman-poll-season", version: 1,
    season: { year, isCurrent: false },
    teams: [
      { id: teamIds[0], name: "Archive Alpha", shortName: "Alpha", abbreviation: "AAL", logoUrl: null, color: null, conference: "Test League", isFbs: true, isEligible: true },
      { id: teamIds[1], name: "Archive Beta", shortName: "Beta", abbreviation: "ABE", logoUrl: null, color: null, conference: "Test League", isFbs: true, isEligible: true },
    ],
    weeks: [{
      number: 1, label: "Archive Week", status: "closed", opensAt: null,
      deadline: "2198-09-01T00:00:00Z", publishedAt: null, editorial: null,
      snapshots: [{ teamId: teamIds[0], wins: 3, losses: 1, confWins: 2, confLosses: 0, lastResult: { result: "W" }, nextOpponent: null, extraJson: null }],
      results: [
        { teamId: teamIds[0], rank: 1, points: 25, firstPlaceVotes: 1, previousRank: null },
        { teamId: teamIds[1], rank: 26, points: 1, firstPlaceVotes: 0, previousRank: null },
      ],
      ballots: [{ userId, displayName: "Archive Voter", status: "draft", submittedAt: null, entries: [{ teamId: teamIds[0], rank: 1 }] }],
    }],
  });
  const user = await db.user.create({ data: { id: userId, email: `${userId}@archive-verification.invalid`, name: "Archive Verification", displayName: "Archive Voter", role: "admin", status: "approved" } });

  try {
    const dryRun = await db.$transaction((tx) => checkArchiveImport(tx, data));
    assert.equal(dryRun.valid, true);
    assert.equal(dryRun.summary.ballotCount, 1);
    await importSeasonArchive(user.id, data);
    const imported = await buildSeasonArchive(year);
    assert.ok(imported);
    assert.equal(imported.weeks[0].snapshots[0].wins, 3);
    assert.equal(imported.weeks[0].results[1].rank, 26);
    assert.equal(imported.weeks[0].ballots[0].displayName, "Archive Voter");
    const duplicate = await db.$transaction((tx) => checkArchiveImport(tx, data));
    assert.equal(duplicate.valid, false);
    console.log("PASS season archive dry run, import, export, and conflict checks");
  } finally {
    await db.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { actorId: userId } });
      await tx.season.deleteMany({ where: { year } });
      await tx.team.deleteMany({ where: { id: { in: teamIds } } });
      await tx.user.deleteMany({ where: { id: userId } });
    });
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && (error.name === "AssertionError" || error.message === "IMPORT_CONFLICT" || error.message === "ADMIN_REQUIRED")) console.error(error.name, error.message);
  reportDatabaseError(error);
}).finally(() => db.$disconnect());
