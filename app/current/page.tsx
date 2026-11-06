import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { BallotEditor, type BallotTeam } from "@/app/current/ballot-editor";
import { LocalTime } from "@/app/current/local-time";
import { requireApprovedUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

function displayRecord(wins: number, losses: number) { return `${wins}-${losses}`; }

export default async function CurrentWeekPage() {
  await connection();
  const user = await requireApprovedUser();
  const db = getDatabase();
  const season = await db.season.findFirst({ where: { isCurrent: true }, select: { id: true, year: true } });
  const week = season ? await db.week.findFirst({ where: { seasonId: season.id, status: "open" }, orderBy: { number: "desc" } }) : null;
  if (!season || !week) return <div className="page-shell account-page"><SitePageHeading eyebrow="This week" title="No open ballot" detail="An admin will open the next poll when it is ready." /><Link href="/" className="text-link">Return to the public page</Link></div>;

  const [memberships, ballot, priorWeek] = await Promise.all([
    db.seasonTeam.findMany({ where: { seasonId: season.id, isFbs: true, isEligible: true }, include: { team: { select: { id: true, name: true, abbreviation: true, logoUrl: true } }, }, orderBy: { team: { name: "asc" } } }),
    db.ballot.findUnique({ where: { userId_weekId: { userId: user.id, weekId: week.id } }, include: { entries: { orderBy: { rank: "asc" }, select: { teamId: true } } } }),
    db.week.findFirst({ where: { seasonId: season.id, number: { lt: week.number }, status: { in: ["closed", "published"] } }, orderBy: { number: "desc" }, select: { id: true } }),
  ]);
  const stats = await db.teamWeekStat.findMany({ where: { weekId: week.id }, select: { teamId: true, wins: true, losses: true, confWins: true, confLosses: true, lastResult: true, nextOpponent: true } });
  const statsByTeam = new Map(stats.map((stat) => [stat.teamId, stat]));
  const teams: BallotTeam[] = memberships.map((membership) => {
    const stat = statsByTeam.get(membership.teamId);
    const last = stat?.lastResult && typeof stat.lastResult === "object" && !Array.isArray(stat.lastResult) ? stat.lastResult as Record<string, unknown> : null;
    const next = stat?.nextOpponent && typeof stat.nextOpponent === "object" && !Array.isArray(stat.nextOpponent) ? stat.nextOpponent as Record<string, unknown> : null;
    return {
      id: membership.team.id,
      name: membership.team.name,
      abbreviation: membership.team.abbreviation,
      logoUrl: membership.team.logoUrl,
      conference: membership.conference ?? "Independent",
      record: displayRecord(stat?.wins ?? 0, stat?.losses ?? 0),
      conferenceRecord: displayRecord(stat?.confWins ?? 0, stat?.confLosses ?? 0),
      lastResult: last && typeof last.opponent === "string" && typeof last.result === "string" && typeof last.score === "string" ? `${last.result} ${last.score} vs ${last.opponent}` : "No completed game",
      nextOpponent: next && typeof next.opponent === "string" ? `${next.isHome ? "vs" : "at"} ${next.opponent}` : "No scheduled game",
    };
  });
  let previousBallot: number[] = [];
  if (priorWeek) {
    const previous = await db.ballot.findUnique({ where: { userId_weekId: { userId: user.id, weekId: priorWeek.id } }, include: { entries: { orderBy: { rank: "asc" }, select: { teamId: true } } } });
    previousBallot = previous?.entries.map((entry) => entry.teamId) ?? [];
  }
  const now = new Date();
  const canVote = week.status === "open" && week.deadline > now && (!week.opensAt || week.opensAt <= now);
  const initialTeamIds = ballot?.entries.map((entry) => entry.teamId).filter((id) => teams.some((team) => team.id === id)) ?? [];

  return <div className="page-shell account-page current-week-page">
    <SitePageHeading eyebrow={`${season.year} college football`} title={week.label} detail="Build your Top 25. Your picks stay private until the poll is published." />
    <Card><CardContent className="week-status-card"><div><strong>{canVote ? (ballot?.status === "submitted" ? "Submitted · edits still open" : "Voting is open") : "Voting is closed"}</strong><p>Deadline: <LocalTime date={week.deadline.toISOString()} /> · <LocalTime date={week.deadline.toISOString()} countdown /></p></div>{ballot?.submittedAt && <span>Submitted {ballot.submittedAt.toLocaleString()}</span>}</CardContent></Card>
    {canVote ? <BallotEditor weekId={week.id} teams={teams} initialTeamIds={initialTeamIds} previousTeamIds={previousBallot} /> : <Card><CardContent><p>The ballot is not accepting changes right now.</p></CardContent></Card>}
  </div>;
}
