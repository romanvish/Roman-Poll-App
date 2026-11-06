import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BallotsExplorer } from "@/components/ballots-explorer";
import { PublishedEditionPicker } from "@/components/published-edition-picker";
import { getPublishedPolls } from "@/lib/server/published-polls";
import { getPublicVoters, getPublishedEditionDetails } from "@/lib/server/public-voters";
import { publishedEditionParamsSchema } from "@/lib/schemas/public-routes";

export const instant = false;

type Props = { params: Promise<{ season: string; week: string }> };

export async function generateMetadata({ params }: Props) {
  const parsed = publishedEditionParamsSchema.safeParse(await params);
  if (!parsed.success) return { title: "Ballots" };
  return { title: `${parsed.data.season} Week ${parsed.data.week} Ballots`, description: "Explore every ballot behind this published Roman Poll edition." };
}

export default async function PublishedBallotsPage({ params }: Props) {
  await connection();
  const parsed = publishedEditionParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [{ season, week }, editions, edition, publicVoters] = await Promise.all([
    Promise.resolve(parsed.data), getPublishedPolls(), getPublishedEditionDetails(parsed.data.season, parsed.data.week), getPublicVoters(),
  ]);
  if (!edition) notFound();
  return <div className="page-shell account-page page-stack">
    <header className="page-heading ballot-heading">
      <div><p className="eyebrow">The ballots · {new Date(edition.publishedAt).toLocaleDateString()}</p><h1>Every vote, out in the open.</h1><p className="lede">See exactly how each voter ranked the field for {edition.label} of the {edition.season} season.</p></div>
      <PublishedEditionPicker editions={editions.map((poll) => ({ season: poll.season, week: poll.week, label: poll.label }))} current={{ season, week }} section="ballots" />
    </header>
    <div className="published-page-links"><Link href={`/polls/${season}/${week}`}>View poll rankings</Link><Link href={`/compare/${season}/week/${week}`}>Compare ballots</Link></div>
    <BallotsExplorer ballots={edition.ballots} voters={publicVoters} />
  </div>;
}
