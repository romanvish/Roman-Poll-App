import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TeamHistory, type TeamHistoryItem } from "@/components/team-history";
import { TeamLogo } from "@/components/team-identity";
import { SitePageHeading } from "@/components/site-page-heading";
import { getLegacyTeamDetail } from "@/lib/server/legacy-public";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function TeamPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const legacy = await getLegacyTeamDetail(id);
  if (legacy) {
    return <div className="page-shell account-page page-stack team-page">
      <SitePageHeading eyebrow="Team history" title={legacy.name} detail={`${legacy.abbreviation} · historical Roman Poll results`} />
      <div className="team-page-identity"><TeamLogo abbreviation={legacy.abbreviation} logoPath={legacy.logoPath} /></div>
      <TeamHistory history={legacy.history} team={legacy.name} />
    </div>;
  }

  const teamId = /^\d+$/.test(id) ? Number(id) : Number.NaN;
  if (!Number.isSafeInteger(teamId) || teamId <= 0) notFound();
  const team = await getDatabase().team.findUnique({ where: { id: teamId }, select: { id: true, name: true, abbreviation: true } });
  if (!team) notFound();
  const resultRows = await getDatabase().weekResult.findMany({
    where: { teamId, week: { status: "published", publishedAt: { not: null } } },
    include: { week: { select: { number: true, label: true, publishedAt: true, season: { select: { year: true } }, snapshots: { where: { teamId }, select: { wins: true, losses: true } } } } },
    orderBy: [{ week: { season: { year: "asc" } } }, { week: { number: "asc" } }],
  });
  const history: TeamHistoryItem[] = resultRows.filter((row) => row.week.publishedAt).map((row) => ({
    season: row.week.season.year,
    week: row.week.number,
    label: row.week.label,
    publishedAt: row.week.publishedAt!.toISOString(),
    rank: row.rank,
    points: row.points,
    firstPlaceVotes: row.firstPlaceVotes,
    previousRank: row.previousRank,
    record: `${row.week.snapshots[0]?.wins ?? 0}-${row.week.snapshots[0]?.losses ?? 0}`,
  }));
  return <div className="page-shell account-page page-stack team-page">
    <SitePageHeading eyebrow="Team history" title={team.name} detail={`${team.abbreviation} · published Roman Poll results`} />
    <TeamHistory history={history} team={team.name} />
  </div>;
}
