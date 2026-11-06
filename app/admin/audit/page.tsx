import { Card, CardContent } from "@/components/ui/card";
import { connection } from "next/server";
import { SitePageHeading } from "@/components/site-page-heading";
import { requireAdmin } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

export default async function AdminAuditPage() {
  await connection();
  await requireAdmin();
  const entries = await getDatabase().auditLog.findMany({
    include: { actor: { select: { displayName: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Administration" title="Audit log" detail="Recent administrative changes to account access." />
    <nav className="admin-nav" aria-label="Administration"><a href="/admin/users">Users</a><a href="/admin/teams">Teams</a><a href="/admin/weeks">Weeks</a><a href="/admin/data">Season data</a><a href="/admin/audit" aria-current="page">Audit log</a></nav>
    <div className="admin-user-list">{entries.map((entry) => <Card key={entry.id}><CardContent className="audit-entry">
      <p><strong>{entry.action}</strong><span>{entry.createdAt.toLocaleString()}</span></p>
      <p>{entry.actor.displayName || entry.actor.name} ({entry.actor.email}) changed user <code>{entry.targetId}</code>.</p>
    </CardContent></Card>)}{entries.length === 0 && <p>No admin actions have been recorded.</p>}</div>
  </div>;
}
