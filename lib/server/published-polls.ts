import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getDatabase } from "@/lib/server/db";
import { serializePublishedPoll } from "@/lib/poll/serialize";
import type { PublicPoll } from "@/lib/schemas/public-poll";
import { getLegacyPublishedPoll, getLatestLegacyPublishedPoll, getLegacyPublishedPolls } from "@/lib/server/legacy-public";

async function queryAppPublishedPoll(seasonYear?: number, weekNumber?: number): Promise<PublicPoll | null> {
  const week = await getDatabase().week.findFirst({
    where: {
      status: "published",
      ...(seasonYear === undefined ? {} : { season: { year: seasonYear } }),
      ...(weekNumber === undefined ? {} : { number: weekNumber }),
    },
    include: {
      season: { select: { year: true } },
      results: { include: { team: { select: { name: true } } }, orderBy: [{ rank: "asc" }, { team: { name: "asc" } }] },
      snapshots: { select: { teamId: true, wins: true, losses: true } },
      ballots: {
        where: { status: "submitted" },
        include: { user: { select: { displayName: true, name: true } }, entries: { include: { team: { select: { name: true } } }, orderBy: { rank: "asc" } } },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { number: "desc" }],
  });
  if (!week?.publishedAt) return null;
  const snapshots = new Map(week.snapshots.map((snapshot) => [snapshot.teamId, snapshot]));
  const ballots = [...week.ballots].sort((a, b) => (a.displayNameSnapshot || a.user.displayName || a.user.name).localeCompare(b.displayNameSnapshot || b.user.displayName || b.user.name));
  return serializePublishedPoll({
    season: week.season,
    number: week.number,
    label: week.label,
    publishedAt: week.publishedAt,
    results: week.results.map((result) => {
      const snapshot = snapshots.get(result.teamId);
      return { ...result, record: `${snapshot?.wins ?? 0}-${snapshot?.losses ?? 0}` };
    }),
    ballots,
  });
}

export async function getPublishedPoll(year: number, weekNumber: number): Promise<PublicPoll | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`published-week-${year}-${weekNumber}`, `published-season-${year}`);
  const [app, legacy] = await Promise.all([queryAppPublishedPoll(year, weekNumber), getLegacyPublishedPoll(year, weekNumber)]);
  if (!app) return legacy;
  if (!legacy) return app;
  return new Date(legacy.publishedAt).getTime() >= new Date(app.publishedAt).getTime() ? legacy : app;
}

export async function getLatestPublishedPoll(): Promise<PublicPoll | null> {
  "use cache";
  cacheLife("max");
  cacheTag("published-latest");
  const [app, legacy] = await Promise.all([queryAppPublishedPoll(), getLatestLegacyPublishedPoll()]);
  if (!app) return legacy;
  if (!legacy) return app;
  return new Date(legacy.publishedAt).getTime() >= new Date(app.publishedAt).getTime() ? legacy : app;
}

export async function getPublishedPolls(): Promise<PublicPoll[]> {
  "use cache";
  cacheLife("max");
  cacheTag("published-polls-list");
  const weeks = await getDatabase().week.findMany({ where: { status: "published" }, select: { season: { select: { year: true } }, number: true }, orderBy: [{ season: { year: "desc" } }, { number: "desc" }] });
  const [appPolls, legacyPolls] = await Promise.all([
    Promise.all(weeks.map((week) => queryAppPublishedPoll(week.season.year, week.number))),
    getLegacyPublishedPolls(),
  ]);
  const byEdition = new Map<string, PublicPoll>();
  for (const poll of [...appPolls.filter((item): item is PublicPoll => item !== null), ...legacyPolls]) {
    const key = `${poll.season}-${poll.week}`;
    const previous = byEdition.get(key);
    if (!previous || new Date(poll.publishedAt).getTime() > new Date(previous.publishedAt).getTime()) byEdition.set(key, poll);
  }
  return [...byEdition.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || b.season - a.season || b.week - a.week);
}
