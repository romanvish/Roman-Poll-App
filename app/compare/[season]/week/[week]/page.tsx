import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompareBallots } from "@/components/compare-ballots";
import { PublishedEditionPicker } from "@/components/published-edition-picker";
import { publishedEditionParamsSchema } from "@/lib/schemas/public-routes";
import { getPublishedPolls } from "@/lib/server/published-polls";
import { getPublishedEditionDetails } from "@/lib/server/public-voters";

export const instant = false;

type Props = { params: Promise<{ season: string; week: string }>; searchParams: Promise<{ left?: string | string[]; right?: string | string[] }> };

export async function generateMetadata({ params }: Props) {
  const parsed = publishedEditionParamsSchema.safeParse(await params);
  if (!parsed.success) return { title: "Compare ballots" };
  return { title: `${parsed.data.season} Week ${parsed.data.week} Voter Comparison`, description: "Compare two published Roman Poll ballots team by team." };
}

export default async function PublishedComparePage({ params, searchParams }: Props) {
  await connection();
  const parsed = publishedEditionParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [query, { season, week }, editions, edition] = await Promise.all([
    searchParams, Promise.resolve(parsed.data), getPublishedPolls(), getPublishedEditionDetails(parsed.data.season, parsed.data.week),
  ]);
  if (!edition) notFound();
  return <div className="page-shell account-page page-stack">
    <header className="page-heading ballot-heading">
      <div><p className="eyebrow">Head to head · {new Date(edition.publishedAt).toLocaleDateString()}</p><h1>Where the ballots disagree.</h1><p className="lede">Put two voters side by side and find the teams separating their {edition.label.toLowerCase()} rankings.</p></div>
      <PublishedEditionPicker editions={editions.map((poll) => ({ season: poll.season, week: poll.week, label: poll.label }))} current={{ season, week }} section="compare" />
    </header>
    <div className="published-page-links"><Link href={`/polls/${season}/${week}`}>View poll rankings</Link><Link href={`/ballots/${season}/week/${week}`}>View every ballot</Link></div>
    <CompareBallots edition={edition} initialLeftId={typeof query.left === "string" ? query.left : undefined} initialRightId={typeof query.right === "string" ? query.right : undefined} />
  </div>;
}
