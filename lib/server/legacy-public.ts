import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { getDatabase } from "@/lib/server/db";
import { profileLinksSchema } from "@/lib/schemas/content";
import { editorialSchema } from "@/lib/schemas/content";
import { serializeLegacyPublishedPoll } from "@/lib/legacy/serialize";
import type { PublicPoll } from "@/lib/schemas/public-poll";
import type { PublicVoter, PublishedEditionDetails, VoterInsightEdition } from "@/lib/server/public-voters";

const legacyEditionInclude = {
  ranks: { include: { team: { select: { id: true, name: true, logoPath: true, providerTeamId: true } } }, orderBy: { rank: "asc" as const } },
  ballots: {
    include: {
      voter: { select: { id: true, name: true } },
      entries: { include: { team: { select: { id: true, name: true } } }, orderBy: { rank: "asc" as const } },
    },
  },
} as const;

function toPublishedPoll(edition: Awaited<ReturnType<typeof findLegacyEdition>>) {
  if (!edition?.isPublished || !edition.publishedAt) return null;
  return serializeLegacyPublishedPoll({
    season: edition.season,
    week: edition.week,
    label: edition.label,
    publishedAt: edition.publishedAt,
    ranks: edition.ranks.map((rank) => ({
      teamId: rank.teamId,
      publicTeamId: rank.team.providerTeamId ?? rank.teamId,
      team: rank.team.name,
      rank: rank.rank,
      points: rank.points,
      firstPlaceVotes: rank.firstPlaceVotes,
      previousRank: rank.previousRank,
      record: rank.record,
    })),
    ballots: [...edition.ballots].sort((a, b) => a.voter.name.localeCompare(b.voter.name)).map((ballot) => ({
      voter: ballot.voter.name,
      entries: ballot.entries.map((entry) => ({ rank: entry.rank, team: entry.team.name })),
    })),
  });
}

async function findLegacyEdition(season: number, week: number) {
  return getDatabase().legacyEdition.findUnique({
    where: { season_week: { season, week }, isPublished: true },
    include: legacyEditionInclude,
  });
}

export async function getLegacyPublishedPoll(season: number, week: number): Promise<PublicPoll | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`published-week-${season}-${week}`, `published-season-${season}`);
  return toPublishedPoll(await findLegacyEdition(season, week));
}

export async function getLatestLegacyPublishedPoll(): Promise<PublicPoll | null> {
  "use cache";
  cacheLife("max");
  cacheTag("published-latest");
  const latest = await getDatabase().legacyEdition.findFirst({ where: { isPublished: true, publishedAt: { not: null } }, orderBy: [{ publishedAt: "desc" }, { season: "desc" }, { week: "desc" }], select: { season: true, week: true } });
  return latest ? getLegacyPublishedPoll(latest.season, latest.week) : null;
}

export async function getLegacyPublishedPolls(): Promise<PublicPoll[]> {
  "use cache";
  cacheLife("max");
  cacheTag("published-polls-list");
  const editions = await getDatabase().legacyEdition.findMany({ where: { isPublished: true, publishedAt: { not: null } }, select: { season: true, week: true }, orderBy: [{ publishedAt: "desc" }, { season: "desc" }, { week: "desc" }] });
  const polls = await Promise.all(editions.map((edition) => getLegacyPublishedPoll(edition.season, edition.week)));
  return polls.filter((poll): poll is PublicPoll => poll !== null);
}

export async function getLegacyPublishedEditionDetails(season: number, week: number): Promise<PublishedEditionDetails | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`published-week-${season}-${week}`);
  const edition = await findLegacyEdition(season, week);
  if (!edition?.publishedAt) return null;
  const editorial = editorialSchema.safeParse(edition.editorial);
  const teamInfo = new Map(edition.ranks.map((rank) => [rank.teamId, rank]));
  const ballots = [...edition.ballots].sort((a, b) => a.voter.name.localeCompare(b.voter.name)).map((ballot) => ({
    voterId: ballot.voter.id,
    voter: ballot.voter.name,
    entries: ballot.entries.map((entry) => {
      const rank = teamInfo.get(entry.team.id);
      return { rank: entry.rank, teamId: entry.team.id, team: entry.team.name, record: rank?.record ?? "0-0" };
    }),
  }));
  return {
    season: edition.season,
    week: edition.week,
    label: edition.label,
    publishedAt: edition.publishedAt.toISOString(),
    editorial: editorial.success ? editorial.data : null,
    ballots,
    pollRanks: edition.ranks.map((rank) => ({
      teamId: rank.teamId,
      team: rank.team.name,
      rank: rank.rank,
      previousRank: rank.previousRank,
      logoPath: usablePublicAsset(rank.team.logoPath),
      teamSlug: rank.team.id,
      rankSpread: rank.rankSpread,
      rankStandardDeviation: rank.rankStandardDeviation,
      averageRank: rank.averageRank,
    })),
  };
}

export async function getLegacyPublicVoters(): Promise<PublicVoter[]> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters");
  const voters = await getDatabase().legacyVoter.findMany({ orderBy: { name: "asc" } });
  return voters.map((voter) => {
    const links = profileLinksSchema.safeParse(voter.links);
    return {
      id: voter.id,
      name: voter.name,
      avatarPath: voter.photoPath,
      tagline: null,
      title: voter.title,
      affiliation: voter.affiliation,
      location: null,
      favoriteTeam: null,
      bio: voter.bio,
      specialties: voter.specialties,
      links: links.success ? links.data : [],
    };
  });
}

export async function getLegacyPublicVoter(id: string): Promise<(PublicVoter & { ballots: Array<{ season: number; week: number; label: string; publishedAt: string; entries: Array<{ rank: number; teamId: string; team: string; record: string }> }> }) | null> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters", `public-voter-${id}`);
  const voter = await getDatabase().legacyVoter.findUnique({
    where: { id },
    include: {
      ballots: { where: { edition: { isPublished: true, publishedAt: { not: null } } }, include: {
        edition: { select: { season: true, week: true, label: true, publishedAt: true, ranks: { select: { teamId: true, record: true } } } },
        entries: { include: { team: { select: { id: true, name: true } } }, orderBy: { rank: "asc" } },
      } },
    },
  });
  if (!voter) return null;
  const links = profileLinksSchema.safeParse(voter.links);
  const ballots = voter.ballots.filter((ballot) => ballot.edition.publishedAt).map((ballot) => {
    const records = new Map(ballot.edition.ranks.map((rank) => [rank.teamId, rank.record]));
    return {
      season: ballot.edition.season,
      week: ballot.edition.week,
      label: ballot.edition.label,
      publishedAt: ballot.edition.publishedAt!.toISOString(),
      entries: ballot.entries.map((entry) => ({ rank: entry.rank, teamId: entry.team.id, team: entry.team.name, record: records.get(entry.team.id) ?? "0-0" })),
    };
  }).sort((a, b) => b.season - a.season || b.week - a.week);
  return {
    id: voter.id, name: voter.name, avatarPath: voter.photoPath, tagline: null, title: voter.title,
    affiliation: voter.affiliation, location: null, favoriteTeam: null, bio: voter.bio,
    specialties: voter.specialties, links: links.success ? links.data : [], ballots,
  };
}

export async function getLegacyVoterInsightEditions(voterId: string): Promise<VoterInsightEdition[]> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters", `public-voter-${voterId}`);
  const editions = await getDatabase().legacyEdition.findMany({
    where: { isPublished: true, ballots: { some: { voterId } } },
    include: { ballots: { include: { voter: { select: { id: true, name: true } }, entries: { include: { team: { select: { id: true, name: true } } }, orderBy: { rank: "asc" } } } } },
    orderBy: [{ season: "asc" }, { week: "asc" }],
  });
  return editions.map((edition) => ({
    season: edition.season,
    week: edition.week,
    label: edition.label,
    ballots: edition.ballots.map((ballot) => ({ voterId: ballot.voter.id, voter: ballot.voter.name, entries: ballot.entries.map((entry) => ({ rank: entry.rank, teamId: entry.team.id, team: entry.team.name })) })),
  }));
}

export type LegacyTeamDetail = {
  id: string;
  name: string;
  abbreviation: string;
  logoPath: string | null;
  providerTeamId: number | null;
  history: Array<{ season: number; week: number; label: string; publishedAt: string; rank: number; points: number; firstPlaceVotes: number; previousRank: number | null; record: string }>;
};

export async function getLegacyTeamDetail(id: string): Promise<LegacyTeamDetail | null> {
  "use cache";
  cacheLife("max");
  cacheTag("legacy-teams", `legacy-team-${id}`);
  const team = await getDatabase().legacyTeam.findUnique({
    where: { id },
    include: { ranks: { where: { edition: { isPublished: true, publishedAt: { not: null } } }, include: { edition: { select: { season: true, week: true, label: true, publishedAt: true } } }, orderBy: [{ edition: { season: "asc" } }, { edition: { week: "asc" } }] } },
  });
  if (!team) return null;
  return {
    id: team.id, name: team.name, abbreviation: team.abbreviation, logoPath: usablePublicAsset(team.logoPath), providerTeamId: team.providerTeamId,
    history: team.ranks.filter((rank) => rank.edition.publishedAt).map((rank) => ({
      season: rank.edition.season, week: rank.edition.week, label: rank.edition.label,
      publishedAt: rank.edition.publishedAt!.toISOString(), rank: rank.rank, points: rank.points,
      firstPlaceVotes: rank.firstPlaceVotes, previousRank: rank.previousRank, record: rank.record,
    })),
  };
}

export async function getLegacyTeamDetails(): Promise<Array<{ id: string; name: string; logoPath: string | null }>> {
  "use cache";
  cacheLife("max");
  cacheTag("legacy-teams");
  const teams = await getDatabase().legacyTeam.findMany({ select: { id: true, name: true, logoPath: true }, orderBy: { name: "asc" } });
  return teams.map((team) => ({ ...team, logoPath: usablePublicAsset(team.logoPath) }));
}

function usablePublicAsset(assetPath: string | null) {
  if (!assetPath || !assetPath.startsWith("/") || assetPath.includes("..")) return null;
  const localPath = path.join(process.cwd(), "public", assetPath.slice(1));
  return existsSync(localPath) ? assetPath : null;
}
