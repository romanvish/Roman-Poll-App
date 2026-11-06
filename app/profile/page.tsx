import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { ProfileForm } from "@/app/profile/profile-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getDatabase } from "@/lib/server/db";
import { requireSignedInUser } from "@/lib/server/authorization";
import { profileLinksSchema } from "@/lib/schemas/content";

export const instant = false;

export default async function ProfilePage() {
  await connection();
  const user = await requireSignedInUser();
  const db = getDatabase();
  const season = await db.season.findFirst({ where: { isCurrent: true }, select: { id: true } });
  const teams = season ? await db.seasonTeam.findMany({
    where: { seasonId: season.id, isFbs: true, isEligible: true },
    select: { team: { select: { id: true, name: true, abbreviation: true } }, conference: true },
    orderBy: { team: { name: "asc" } },
  }) : [];

  const links = profileLinksSchema.safeParse(user.links);
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Your account" title="Your profile" detail="Approved profiles appear on the public About page and beside published ballots." />
    <div className="account-card-heading"><p>Signed in as <strong>{user.email}</strong></p><SignOutButton /></div>
    {user.status === "pending" && <Card className="pending-notice"><CardContent><strong>Waiting for approval.</strong> Profile editing becomes available after an admin approves your account. <Link href="/waiting" className="text-link">More information</Link></CardContent></Card>}
    <Card><CardContent className="account-card"><ProfileForm profile={{ ...user, links: links.success ? links.data : [] }} teams={teams.map((entry) => ({ ...entry.team, conference: entry.conference }))} editable={user.status === "approved"} /></CardContent></Card>
  </div>;
}
