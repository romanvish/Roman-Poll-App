import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { SeasonImportForm } from "@/app/admin/data/season-import-form";
import { requireAdmin } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

export default async function AdminDataPage() {
  await connection();
  await requireAdmin();
  const seasons = await getDatabase().season.findMany({ select: { year: true, isCurrent: true }, orderBy: { year: "desc" } });
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Administration" title="Season data" detail="Export a season backup or validate and restore an archive." />
    <nav className="admin-nav" aria-label="Administration"><a href="/admin/users">Users</a><a href="/admin/teams">Teams</a><a href="/admin/weeks">Weeks</a><a href="/admin/data" aria-current="page">Season data</a><a href="/admin/audit">Audit log</a></nav>
    <Card><CardContent className="season-data-card"><h2>Export a season</h2><p>Archives include teams, weekly snapshots, ballots, and published results. Ballot identities use display names and stable user IDs.</p><div className="season-export-list">{seasons.map((season) => <a key={season.year} href={`/api/admin/export/${season.year}`}><strong>{season.year}{season.isCurrent ? " · current" : ""}</strong><span>Download JSON</span></a>)}{seasons.length === 0 && <p>No seasons are available.</p>}</div></CardContent></Card>
    <Card><CardContent className="season-data-card"><h2>Import data</h2><p>Run a dry run first. Season backups and legacy archive bundles are validated before they can be committed. Legacy bundles update matching weeks on re-import.</p><SeasonImportForm /></CardContent></Card>
  </div>;
}
