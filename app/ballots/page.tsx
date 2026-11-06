import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SitePageHeading } from "@/components/site-page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { getPublishedPolls } from "@/lib/server/published-polls";

export const instant = false;

export default async function BallotsPage() {
  await connection();
  const editions = await getPublishedPolls();
  const latest = editions[0];
  if (latest) redirect(`/ballots/${latest.season}/week/${latest.week}`);
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Ballots" title="Every vote, out in the open." detail="Individual ballots are published alongside their poll edition." />
    <Card><CardContent className="empty-state"><h2>No published ballots yet</h2><p>Voters’ rankings will appear here after an edition is published.</p><Link href="/polls" className="text-link">Browse the poll archive</Link></CardContent></Card>
  </div>;
}
