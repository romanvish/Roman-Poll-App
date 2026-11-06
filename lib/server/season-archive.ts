import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { seasonArchiveSchema, type SeasonArchive } from "@/lib/schemas/season-archive";
import { getDatabase } from "@/lib/server/db";
import { recordAdminAction } from "@/lib/server/audit";

export async function buildSeasonArchive(year: number): Promise<SeasonArchive | null> {
  const season = await getDatabase().season.findUnique({
    where: { year },
    include: {
      teams: { include: { team: true }, orderBy: { team: { name: "asc" } } },
      weeks: {
        include: {
          snapshots: true,
          results: true,
          ballots: { include: { user: { select: { id: true, displayName: true, name: true } }, entries: { orderBy: { rank: "asc" } } } },
        },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!season) return null;
  return seasonArchiveSchema.parse({
    format: "roman-poll-season",
    version: 1,
    season: { year: season.year, isCurrent: season.isCurrent },
    teams: season.teams.map((membership) => ({
      id: membership.teamId,
      name: membership.team.name,
      shortName: membership.team.shortName,
      abbreviation: membership.team.abbreviation,
      logoUrl: membership.team.logoUrl,
      color: membership.team.color,
      conference: membership.conference,
      isFbs: membership.isFbs,
      isEligible: membership.isEligible,
    })),
    weeks: season.weeks.map((week) => ({
      number: week.number,
      label: week.label,
      status: week.status,
      opensAt: week.opensAt?.toISOString() ?? null,
      deadline: week.deadline.toISOString(),
      publishedAt: week.publishedAt?.toISOString() ?? null,
      editorial: week.editorial,
      snapshots: week.snapshots.map(({ teamId, wins, losses, confWins, confLosses, lastResult, nextOpponent, extraJson }) => ({ teamId, wins, losses, confWins, confLosses, lastResult, nextOpponent, extraJson })),
      results: week.results.map(({ teamId, rank, points, firstPlaceVotes, previousRank }) => ({ teamId, rank, points, firstPlaceVotes, previousRank })),
      ballots: week.ballots.map((ballot) => ({
        userId: ballot.userId,
        displayName: ballot.displayNameSnapshot || ballot.user.displayName || ballot.user.name,
        status: ballot.status,
        submittedAt: ballot.submittedAt?.toISOString() ?? null,
        entries: ballot.entries.map(({ teamId, rank }) => ({ teamId, rank })),
      })),
    })),
  });
}

export async function checkArchiveImport(tx: Prisma.TransactionClient, archive: SeasonArchive) {
  const existingSeason = await tx.season.findUnique({ where: { year: archive.season.year }, select: { id: true } });
  const currentSeason = archive.season.isCurrent ? await tx.season.findFirst({ where: { isCurrent: true }, select: { year: true } }) : null;
  const voterIds = [...new Set(archive.weeks.flatMap((week) => week.ballots.map((ballot) => ballot.userId)))];
  const existingVoters = voterIds.length ? await tx.user.findMany({ where: { id: { in: voterIds } }, select: { id: true } }) : [];
  const existingVoterIds = new Set(existingVoters.map((user) => user.id));
  const missingVoterIds = voterIds.filter((id) => !existingVoterIds.has(id));
  const issues: string[] = [];
  if (existingSeason) issues.push(`Season ${archive.season.year} already exists.`);
  if (currentSeason) issues.push(`Season ${currentSeason.year} is already current; the imported season cannot also be current.`);
  if (missingVoterIds.length) issues.push(`${missingVoterIds.length} ballot voter account(s) are missing from this database.`);
  return {
    valid: issues.length === 0,
    issues,
    summary: {
      seasonYear: archive.season.year,
      current: archive.season.isCurrent,
      teamCount: archive.teams.length,
      weekCount: archive.weeks.length,
      ballotCount: archive.weeks.reduce((total, week) => total + week.ballots.length, 0),
      publishedWeekCount: archive.weeks.filter((week) => week.status === "published").length,
      voterCount: voterIds.length,
    },
  };
}

export async function importSeasonArchive(actorId: string, archive: SeasonArchive) {
  const db = getDatabase();
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
    if (!actor || actor.role !== "admin" || actor.status !== "approved") throw new Error("ADMIN_REQUIRED");
    const check = await checkArchiveImport(tx, archive);
    if (!check.valid) throw new Error("IMPORT_CONFLICT");
    const season = await tx.season.create({ data: { year: archive.season.year, isCurrent: archive.season.isCurrent } });
    for (let offset = 0; offset < archive.teams.length; offset += 100) {
      const chunk = archive.teams.slice(offset, offset + 100);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "team" ("id", "name", "shortName", "abbreviation", "conference", "logoUrl", "color", "isFbs")
        VALUES ${Prisma.join(chunk.map((team) => Prisma.sql`(${team.id}, ${team.name}, ${team.shortName}, ${team.abbreviation}, ${team.conference}, ${team.logoUrl}, ${team.color}, ${team.isFbs})`))}
        ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "shortName" = EXCLUDED."shortName", "abbreviation" = EXCLUDED."abbreviation", "conference" = EXCLUDED."conference", "logoUrl" = EXCLUDED."logoUrl", "color" = EXCLUDED."color", "isFbs" = EXCLUDED."isFbs"
      `);
    }
    if (archive.teams.length) await tx.seasonTeam.createMany({ data: archive.teams.map((team) => ({ seasonId: season.id, teamId: team.id, conference: team.conference, isFbs: team.isFbs, isEligible: team.isEligible })) });
    let importedBallots = 0;
    for (const weekInput of archive.weeks) {
      const week = await tx.week.create({
        data: {
          seasonId: season.id, number: weekInput.number, label: weekInput.label, status: weekInput.status,
          opensAt: weekInput.opensAt ? new Date(weekInput.opensAt) : null,
          deadline: new Date(weekInput.deadline),
          publishedAt: weekInput.publishedAt ? new Date(weekInput.publishedAt) : null,
          editorial: weekInput.editorial ?? Prisma.DbNull,
        },
      });
      if (weekInput.snapshots.length) await tx.teamWeekStat.createMany({ data: weekInput.snapshots.map((snapshot) => ({
        teamId: snapshot.teamId, weekId: week.id, wins: snapshot.wins, losses: snapshot.losses, confWins: snapshot.confWins, confLosses: snapshot.confLosses,
        lastResult: snapshot.lastResult === undefined || snapshot.lastResult === null ? Prisma.DbNull : snapshot.lastResult as Prisma.InputJsonValue,
        nextOpponent: snapshot.nextOpponent === undefined || snapshot.nextOpponent === null ? Prisma.DbNull : snapshot.nextOpponent as Prisma.InputJsonValue,
        extraJson: snapshot.extraJson === undefined || snapshot.extraJson === null ? Prisma.DbNull : snapshot.extraJson as Prisma.InputJsonValue,
      })) });
      if (weekInput.results.length) await tx.weekResult.createMany({ data: weekInput.results.map((result) => ({ weekId: week.id, ...result })) });
      if (weekInput.ballots.length) {
        await tx.ballot.createMany({ data: weekInput.ballots.map((ballot) => ({
          id: randomUUID(), weekId: week.id, userId: ballot.userId, status: ballot.status,
          submittedAt: ballot.submittedAt ? new Date(ballot.submittedAt) : null,
          displayNameSnapshot: ballot.displayName,
        })) });
        const createdBallots = await tx.ballot.findMany({ where: { weekId: week.id }, select: { id: true, userId: true } });
        const idByUser = new Map(createdBallots.map((ballot) => [ballot.userId, ballot.id]));
        const entries = weekInput.ballots.flatMap((ballot) => ballot.entries.map((entry) => ({ ballotId: idByUser.get(ballot.userId)!, ...entry })));
        if (entries.length) await tx.ballotEntry.createMany({ data: entries });
        importedBallots += weekInput.ballots.length;
      }
    }
    await recordAdminAction(tx, { actorId, action: "season.import", targetType: "season", targetId: season.id, details: { year: season.year, teams: archive.teams.length, weeks: archive.weeks.length, ballots: importedBallots } });
    return { seasonId: season.id, ...check.summary };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 55_000 });
}
