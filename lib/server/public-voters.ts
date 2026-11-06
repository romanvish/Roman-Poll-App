import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { editorialSchema, profileLinksSchema, type ProfileLink, type WeekEditorial } from "@/lib/schemas/content";
import { getDatabase } from "@/lib/server/db";
import { getLegacyPublicVoter, getLegacyPublicVoters, getLegacyPublishedEditionDetails, getLegacyVoterInsightEditions } from "@/lib/server/legacy-public";
import { ballotRankStatistics } from "@/lib/poll/ballot-statistics";

export type PublicVoter = {
  id: string;
  name: string;
  avatarPath: string | null;
  tagline: string | null;
  title: string | null;
  affiliation: string | null;
  location: string | null;
  favoriteTeam: string | null;
  bio: string[];
  specialties: string[];
  links: ProfileLink[];
};

export type PublicTeamId = number | string;
export type PublicBallotEntry = { rank: number; teamId: PublicTeamId; team: string; record: string };
export type PublicBallot = { voterId: string; voter: string; entries: PublicBallotEntry[] };
export type VoterInsightEdition = { season: number; week: number; label: string; ballots: Array<{ voterId: string; voter: string; entries: Array<{ rank: number; teamId: PublicTeamId; team: string }> }> };
export type PublishedEditionDetails = {
  season: number;
  week: number;
  label: string;
  publishedAt: string;
  editorial?: WeekEditorial | null;
  ballots: PublicBallot[];
  pollRanks: Array<{ teamId: PublicTeamId; team: string; rank: number; previousRank: number | null; logoPath?: string | null; teamSlug?: string; rankSpread?: number; rankStandardDeviation?: number; averageRank?: number }>;
};
export type VoterInsightBallot = { voterId: string; voter: string; entries: Array<{ rank: number; teamId: PublicTeamId; team: string }> };

function toPublicVoter(user: {
  id: string; name: string; displayName: string | null; avatarPath: string | null; tagline: string | null;
  title: string | null; affiliation: string | null; location: string | null; bio: string[]; specialties: string[];
  links: unknown; favoriteTeam: { name: string } | null;
}): PublicVoter {
  const linkResult = profileLinksSchema.safeParse(user.links);
  const avatarPath = user.avatarPath?.replace(/^\/voters\//, "/profile-images/voters/") ?? null;
  return {
    id: user.id,
    name: user.displayName?.trim() || user.name,
    avatarPath: avatarPath?.startsWith("/") && !avatarPath.includes("..") ? avatarPath : null,
    tagline: user.tagline,
    title: user.title,
    affiliation: user.affiliation,
    location: user.location,
    favoriteTeam: user.favoriteTeam?.name ?? null,
    bio: user.bio.filter((paragraph) => paragraph.trim().length > 0),
    specialties: user.specialties.filter((specialty) => specialty.trim().length > 0),
    links: linkResult.success ? linkResult.data : [],
  };
}

export async function getPublicVoters(): Promise<PublicVoter[]> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters");
  const users = await getDatabase().user.findMany({
    where: { status: "approved" },
    select: {
      id: true, name: true, displayName: true, avatarPath: true, tagline: true, title: true, affiliation: true,
      location: true, bio: true, specialties: true, links: true, favoriteTeam: { select: { name: true } },
    },
    orderBy: [{ displayName: "asc" }, { name: "asc" }],
  });
  const [legacyVoters] = await Promise.all([getLegacyPublicVoters()]);
  const merged = new Map(users.map((user) => [user.id, toPublicVoter(user)]));
  for (const voter of legacyVoters) if (!merged.has(voter.id)) merged.set(voter.id, voter);
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPublicVoter(id: string): Promise<(PublicVoter & { ballots: Array<{ season: number; week: number; label: string; publishedAt: string; entries: PublicBallotEntry[] }> }) | null> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters", `public-voter-${id}`);
  const legacy = await getLegacyPublicVoter(id);
  if (legacy) return legacy;
  const user = await getDatabase().user.findFirst({
    where: { id, status: "approved" },
    select: {
      id: true, name: true, displayName: true, avatarPath: true, tagline: true, title: true, affiliation: true,
      location: true, bio: true, specialties: true, links: true, favoriteTeam: { select: { name: true } },
      ballots: {
        where: { status: "submitted", week: { status: "published" } },
        select: {
          displayNameSnapshot: true,
          week: { select: { number: true, label: true, publishedAt: true, season: { select: { year: true } }, snapshots: { select: { teamId: true, wins: true, losses: true } } } },
          entries: { orderBy: { rank: "asc" }, select: { rank: true, teamId: true, team: { select: { name: true } } } },
        },
      },
    },
  });
  if (!user) return null;
  const voter = toPublicVoter(user);
  const ballots = user.ballots.filter((ballot) => ballot.week.publishedAt).map((ballot) => {
    const records = new Map(ballot.week.snapshots.map((snapshot) => [snapshot.teamId, `${snapshot.wins}-${snapshot.losses}`]));
    return {
      season: ballot.week.season.year,
      week: ballot.week.number,
      label: ballot.week.label,
      publishedAt: ballot.week.publishedAt!.toISOString(),
      entries: ballot.entries.map((entry) => ({ rank: entry.rank, teamId: entry.teamId, team: entry.team.name, record: records.get(entry.teamId) ?? "0-0" })),
    };
  }).sort((a, b) => b.season - a.season || b.week - a.week);
  return { ...voter, ballots };
}

async function getAppPublishedEditionDetails(season: number, weekNumber: number): Promise<PublishedEditionDetails | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`published-week-${season}-${weekNumber}`);
  const week = await getDatabase().week.findFirst({
    where: { number: weekNumber, status: "published", season: { year: season } },
    select: {
      number: true, label: true, publishedAt: true, season: { select: { year: true } },
      editorial: true,
      snapshots: { select: { teamId: true, wins: true, losses: true } },
      results: { select: { teamId: true, rank: true, previousRank: true, team: { select: { name: true } } } },
      ballots: {
        where: { status: "submitted" },
        select: {
          userId: true, displayNameSnapshot: true,
          user: { select: { name: true, displayName: true } },
          entries: { orderBy: { rank: "asc" }, select: { rank: true, teamId: true, team: { select: { name: true } } } },
        },
      },
    },
  });
  if (!week?.publishedAt) return null;
  const editorial = editorialSchema.safeParse(week.editorial);
  const records = new Map(week.snapshots.map((snapshot) => [snapshot.teamId, `${snapshot.wins}-${snapshot.losses}`]));
  const ballots = week.ballots.map((ballot) => ({
    voterId: ballot.userId,
    voter: ballot.displayNameSnapshot?.trim() || ballot.user.displayName?.trim() || ballot.user.name,
    entries: ballot.entries.map((entry) => ({ rank: entry.rank, teamId: entry.teamId, team: entry.team.name, record: records.get(entry.teamId) ?? "0-0" })),
  })).sort((a, b) => a.voter.localeCompare(b.voter));
  const statistics = ballotRankStatistics(ballots);
  return {
    season: week.season.year,
    week: week.number,
    label: week.label,
    publishedAt: week.publishedAt.toISOString(),
    editorial: editorial.success ? editorial.data : null,
    ballots,
    pollRanks: week.results.filter((result) => result.rank <= 25).map((result) => ({ teamId: result.teamId, team: result.team.name, rank: result.rank, previousRank: result.previousRank, ...statistics.get(result.teamId) })),
  };
}

export async function getPublishedEditionDetails(season: number, weekNumber: number): Promise<PublishedEditionDetails | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`published-week-${season}-${weekNumber}`);
  const [legacy, app] = await Promise.all([getLegacyPublishedEditionDetails(season, weekNumber), getAppPublishedEditionDetails(season, weekNumber)]);
  if (!legacy) return app;
  if (!app) return legacy;
  return new Date(legacy.publishedAt).getTime() >= new Date(app.publishedAt).getTime() ? legacy : app;
}

export async function getVoterInsightEditions(userId: string): Promise<VoterInsightEdition[]> {
  "use cache";
  cacheLife("max");
  cacheTag("public-voters", `public-voter-${userId}`);
  const legacyEditions = await getLegacyVoterInsightEditions(userId);
  const weeks = await getDatabase().week.findMany({
    where: { status: "published", ballots: { some: { userId, status: "submitted" } } },
    select: {
      number: true, label: true, season: { select: { year: true } },
      ballots: {
        where: { status: "submitted" },
        select: {
          userId: true, displayNameSnapshot: true,
          user: { select: { name: true, displayName: true } },
          entries: { orderBy: { rank: "asc" }, select: { rank: true, teamId: true, team: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ season: { year: "asc" } }, { number: "asc" }],
  });
  const appEditions = weeks.map((week) => ({
    season: week.season.year,
    week: week.number,
    label: week.label,
    ballots: week.ballots.map((ballot) => ({
      voterId: ballot.userId,
      voter: ballot.displayNameSnapshot?.trim() || ballot.user.displayName?.trim() || ballot.user.name,
      entries: ballot.entries.map((entry) => ({ rank: entry.rank, teamId: entry.teamId, team: entry.team.name })),
    })),
  }));
  const byEdition = new Map([...legacyEditions, ...appEditions].map((edition) => [`${edition.season}-${edition.week}`, edition]));
  return [...byEdition.values()].sort((a, b) => a.season - b.season || a.week - b.week);
}
