import { Card, CardContent } from "@/components/ui/card";
import { connection } from "next/server";
import { SitePageHeading } from "@/components/site-page-heading";
import { UserAccessControls } from "@/app/admin/users/user-access-controls";
import { userFilterSchema } from "@/lib/schemas/admin";
import { requireAdmin } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export const instant = false;

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  await connection();
  await requireAdmin();
  const params = await searchParams;
  const filter = userFilterSchema.parse(params.status);
  const users = await getDatabase().user.findMany({
    where: filter === "all" ? undefined : { status: filter },
    select: { id: true, name: true, displayName: true, email: true, role: true, status: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { email: "asc" }],
    take: 200,
  });

  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Administration" title="Manage people" detail="Approve friends and manage access to the poll." />
    <nav className="admin-nav" aria-label="Administration"><a href="/admin/users" aria-current="page">Users</a><a href="/admin/teams">Teams</a><a href="/admin/weeks">Weeks</a><a href="/admin/data">Season data</a><a href="/admin/audit">Audit log</a></nav>
    <form className="admin-filter" action="/admin/users"><label htmlFor="status-filter">Account status</label><select id="status-filter" name="status" defaultValue={filter}><option value="all">Everyone</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="disabled">Disabled</option></select><button type="submit">Filter</button></form>
    <div className="admin-user-list">
      {users.map((user) => <Card key={user.id}><CardContent className="admin-user-card">
        <div><h2>{user.displayName || user.name}</h2><p>{user.email}</p><p className="admin-user-meta">{user.status} · {user.role} · joined {user.createdAt.toLocaleDateString()}</p></div>
        <UserAccessControls user={{ id: user.id, status: user.status, role: user.role }} />
      </CardContent></Card>)}
      {users.length === 0 && <p>No users match this filter.</p>}
    </div>
  </div>;
}
