import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SitePageHeading } from "@/components/site-page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { getPublishedPolls } from "@/lib/server/published-polls";

export const instant = false;

export default async function ComparePage() {
  await connection();
  const editions = await getPublishedPolls();
  const latest = editions[0];
  if (latest) redirect(`/compare/${latest.season}/week/${latest.week}`);
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Compare" title="Where the ballots disagree." detail="Put two voters side by side and find the teams separating their rankings." />
    <Card><CardContent className="empty-state"><h2>No ballots to compare yet</h2><p>Comparisons will be available when an edition with multiple ballots is published.</p><Link href="/polls" className="text-link">Browse the poll archive</Link></CardContent></Card>
  </div>;
}
