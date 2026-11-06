import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { LegacyArchive } from "@/lib/schemas/legacy-archive";
import { calculateLegacyRankings } from "@/lib/legacy/aggregate";
import { recordAdminAction } from "@/lib/server/audit";

type Tx = Prisma.TransactionClient;

export type LegacyImportCheck = {
  valid: boolean;
  issues: string[];
  summary: { season: number; teams: number; voters: number; weeks: number; ballots: number; rankedTeams: number; linkedTeams: number; updatingWeeks: number };
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export async function checkLegacyArchiveImport(tx: Tx, archive: LegacyArchive): Promise<LegacyImportCheck> {
  const existingWeeks = await tx.legacyEdition.findMany({ where: { season: archive.season, week: { in: archive.weeks.map((week) => week.week) } }, select: { week: true } });
  const providers = await tx.team.findMany({ select: { id: true, name: true } });
  const providerByName = new Map<string, number | null>();
  for (const provider of providers) {
    const key = normalized(provider.name);
    providerByName.set(key, providerByName.has(key) ? null : provider.id);
  }
  const linkedTeams = archive.teams.filter((team) => providerByName.get(normalized(team.name)) !== undefined && providerByName.get(normalized(team.name)) !== null).length;
  const ballots = archive.weeks.reduce((total, week) => total + week.voters.length, 0);
  const rankedTeams = archive.weeks.reduce((total, week) => total + new Set(week.voters.flatMap((voter) => voter.ballot.map((entry) => entry.team))).size, 0);
  return {
    valid: true,
    issues: [],
    summary: { season: archive.season, teams: archive.teams.length, voters: archive.voters.length, weeks: archive.weeks.length, ballots, rankedTeams, linkedTeams, updatingWeeks: existingWeeks.length },
  };
}

export async function importLegacyArchive(tx: Tx, actorId: string, archive: LegacyArchive) {
  const check = await checkLegacyArchiveImport(tx, archive);
  const providers = await tx.team.findMany({ select: { id: true, name: true } });
  const providerByName = new Map<string, number | null>();
  for (const provider of providers) {
    const key = normalized(provider.name);
    providerByName.set(key, providerByName.has(key) ? null : provider.id);
  }

  for (const voter of archive.voters) {
    await tx.legacyVoter.upsert({
      where: { id: voter.id },
      create: { id: voter.id, name: voter.name, title: voter.title ?? null, affiliation: voter.affiliation ?? null, photoPath: voter.photo ?? null, specialties: voter.specialties, bio: voter.bio, links: voter.links as Prisma.InputJsonValue },
      update: { name: voter.name, title: voter.title ?? null, affiliation: voter.affiliation ?? null, photoPath: voter.photo ?? null, specialties: voter.specialties, bio: voter.bio, links: voter.links as Prisma.InputJsonValue },
    });
  }
  for (const team of archive.teams) {
    const providerTeamId = providerByName.get(normalized(team.name)) ?? null;
    await tx.legacyTeam.upsert({
      where: { id: team.id },
      create: { id: team.id, name: team.name, abbreviation: team.abbreviation, logoPath: team.logo ?? null, providerTeamId },
      update: { name: team.name, abbreviation: team.abbreviation, logoPath: team.logo ?? null, providerTeamId },
    });
  }

  const rankings = calculateLegacyRankings(archive);
  for (const [index, week] of archive.weeks.entries()) {
    const publishedAt = new Date(`${week.publishedAt}T12:00:00.000Z`);
    const edition = await tx.legacyEdition.upsert({
      where: { season_week: { season: archive.season, week: week.week } },
      create: { season: archive.season, week: week.week, label: week.week === 0 ? "Preseason" : `Week ${week.week}`, publishedAt, isPublished: true, editorial: week.editorial as Prisma.InputJsonValue },
      update: { label: week.week === 0 ? "Preseason" : `Week ${week.week}`, publishedAt, isPublished: true, editorial: week.editorial as Prisma.InputJsonValue },
      select: { id: true },
    });
    await tx.legacyBallot.deleteMany({ where: { editionId: edition.id } });
    await tx.legacyTeamRank.deleteMany({ where: { editionId: edition.id } });

    const ballots = week.voters.map((voter) => ({ editionId: edition.id, voterId: voter.voterId }));
    if (ballots.length) await tx.legacyBallot.createMany({ data: ballots });
    const entries = week.voters.flatMap((voter) => voter.ballot.map((entry) => ({
      editionId: edition.id,
      voterId: voter.voterId,
      rank: entry.rank,
      teamId: archive.teams.find((team) => normalized(team.name) === normalized(entry.team))!.id,
    })));
    if (entries.length) await tx.legacyBallotEntry.createMany({ data: entries });
    const ranks = rankings[index].map((rank) => ({
      editionId: edition.id,
      teamId: rank.teamId,
      rank: rank.rank,
      points: rank.points,
      firstPlaceVotes: rank.firstPlaceVotes,
      previousRank: rank.previousRank,
      record: rank.record,
      rankSpread: rank.rankSpread,
      rankStandardDeviation: rank.rankStandardDeviation,
      averageRank: rank.averageRank,
    }));
    if (ranks.length) await tx.legacyTeamRank.createMany({ data: ranks });
  }

  await recordAdminAction(tx, {
    actorId,
    action: "season.legacy_import.commit",
    targetType: "legacy_season",
    targetId: String(archive.season),
    details: check.summary as unknown as Prisma.InputJsonValue,
  });
  return check.summary;
}
