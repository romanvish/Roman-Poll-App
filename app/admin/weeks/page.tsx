import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { LocalTime } from "@/app/current/local-time";
import { WeekCreateForm } from "@/app/admin/weeks/week-create-form";
import { WeekControls } from "@/app/admin/weeks/week-controls";
import { requireAdmin } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

export default async function AdminWeeksPage() {
  await connection();
  await requireAdmin();
  const season = await getDatabase().season.findFirst({ where: { isCurrent: true }, include: { weeks: { orderBy: { number: "desc" } } } });
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Administration" title="Weekly polls" detail={season ? `Manage the ${season.year} season.` : "Create a current season before adding a week."} />
    <nav className="admin-nav" aria-label="Administration"><a href="/admin/users">Users</a><a href="/admin/teams">Teams</a><a href="/admin/weeks" aria-current="page">Weeks</a><a href="/admin/data">Season data</a><a href="/admin/audit">Audit log</a></nav>
    {season && <Card><CardContent className="week-create-card"><h2>Create a week</h2><WeekCreateForm /></CardContent></Card>}
    <div className="admin-week-list">{season?.weeks.map((week) => <Card key={week.id}><CardContent className="admin-week-row">
      <div><strong>{week.label}</strong><span>{week.status} · deadline <LocalTime date={week.deadline.toISOString()} /></span></div>
      <WeekControls weekId={week.id} status={week.status} canReopen={week.deadline > new Date()} />
    </CardContent></Card>)}{season?.weeks.length === 0 && <p>No weeks have been created.</p>}</div>
  </div>;
}
