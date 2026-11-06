import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { TeamControls } from "@/app/admin/teams/team-controls";
import { SyncNow } from "@/app/admin/teams/sync-now";
import { requireAdmin } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

export default async function AdminTeamsPage() {
  await connection();
  await requireAdmin();
  const db = getDatabase();
  const season = await db.season.findFirst({ where: { isCurrent: true }, select: { id: true, year: true } });
  const [memberships, lastSync] = season ? await Promise.all([
    db.seasonTeam.findMany({ where: { seasonId: season.id }, include: { team: { select: { name: true, abbreviation: true } } }, orderBy: { team: { name: "asc" } } }),
    db.syncLog.findFirst({ where: { seasonId: season.id }, orderBy: { createdAt: "desc" } }),
  ]) : [[], null];

  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Administration" title="Teams and sync" detail={season ? `Manage ${season.year} eligibility and refresh game data.` : "Set a current season before syncing data."} />
    <nav className="admin-nav" aria-label="Administration"><a href="/admin/users">Users</a><a href="/admin/teams" aria-current="page">Teams</a><a href="/admin/weeks">Weeks</a><a href="/admin/data">Season data</a><a href="/admin/audit">Audit log</a></nav>
    {season && <Card><CardContent className="sync-panel"><div><strong>Last sync</strong><p>{lastSync ? `${lastSync.status} · ${lastSync.createdAt.toLocaleString()}${lastSync.error ? ` · ${lastSync.error}` : ""}` : "No sync recorded yet."}</p></div><SyncNow /></CardContent></Card>}
    <div className="admin-team-list">{memberships.map((membership) => <Card key={`${membership.seasonId}:${membership.teamId}`}><CardContent className="admin-team-row">
      <div><strong>{membership.team.name}</strong><span>{membership.team.abbreviation} · {membership.conference ?? "Independent"} · {membership.isFbs ? "FBS" : "non-FBS"} · {membership.isEligible ? "eligible" : "ineligible"}</span></div>
      {membership.isFbs && <TeamControls seasonId={membership.seasonId} teamId={membership.teamId} eligible={membership.isEligible} />}
    </CardContent></Card>)}</div>
  </div>;
}
