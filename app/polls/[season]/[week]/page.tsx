import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { getPublishedPoll } from "@/lib/server/published-polls";
import { getPublicVoters, getPublishedEditionDetails } from "@/lib/server/public-voters";
import { getWeeklySuperlatives } from "@/lib/poll/insights";
import { WeeklySuperlatives } from "@/components/weekly-superlatives";
import { TeamIdentity } from "@/components/team-identity";
import { RankingsTable } from "@/components/rankings-table";

export const instant = false;

type Props = { params: Promise<{ season: string; week: string }> };

export default async function PublishedPollPage({ params }: Props) {
  await connection();
  const parsed = await params;
  const season = Number(parsed.season);
  const weekNumber = Number(parsed.week);
  if (!Number.isInteger(season) || !Number.isInteger(weekNumber)) notFound();
  const [poll, edition, publicVoters] = await Promise.all([
    getPublishedPoll(season, weekNumber),
    getPublishedEditionDetails(season, weekNumber),
    getPublicVoters(),
  ]);
  if (!poll || !edition) notFound();
  const superlatives = getWeeklySuperlatives(edition.ballots, edition.pollRanks);
  const teamDetails = new Map(edition.pollRanks.map((rank) => [rank.team, rank]));
  return <div className="page-shell account-page results-page">
    <Link className="text-link" href="/polls">← All published polls</Link>
    <SitePageHeading eyebrow={`${poll.season} Roman Poll`} title={poll.label} detail={`${poll.voters} voters · published ${new Date(poll.publishedAt).toLocaleDateString()}`} />
    <div className="published-page-links"><Link href={`/ballots/${poll.season}/week/${poll.week}`}>Explore every ballot</Link><Link href={`/compare/${poll.season}/week/${poll.week}`}>Compare voters</Link><Link href="/about">Meet the voters</Link></div>
    {edition.editorial && <section className="poll-editorial" aria-label="Week editorial">
      <p className="eyebrow">This week in college football</p><h2>{edition.editorial.headline}</h2><p className="poll-editorial-dek">{edition.editorial.dek}</p>
      {edition.editorial.analysis.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>)}
      {edition.editorial.highlights.length > 0 && <div className="poll-editorial-highlights">{edition.editorial.highlights.map((highlight) => <article key={`${highlight.label}-${highlight.title}`}><p className="eyebrow">{highlight.label}</p><h3>{highlight.title}</h3><p>{highlight.body}</p></article>)}</div>}
    </section>}
    <Card><CardContent className="results-table-wrap"><RankingsTable rows={poll.rankings.map((entry) => ({ ...entry, ...teamDetails.get(entry.team) }))} pointsAvailable={poll.voters * 25} /></CardContent></Card>
    {poll.othersReceivingVotes.length > 0 && <section className="results-section"><h2>Others receiving votes</h2><ul className="others-receiving-votes">{poll.othersReceivingVotes.map((entry) => {
      const details = teamDetails.get(entry.team);
      return <li key={entry.teamId}><TeamIdentity id={details?.teamSlug ?? entry.teamId} name={entry.team} logoPath={details?.logoPath} /><span>{entry.points} points</span></li>;
    })}</ul></section>}
    <WeeklySuperlatives items={superlatives} publicVoterIds={publicVoters.map((voter) => voter.id)} />
    <section className="results-section"><h2>Every ballot</h2><div className="published-ballots">{poll.ballots.map((ballot) => <Card key={ballot.voter}><CardContent><h3>{ballot.voter}</h3><ol>{ballot.teams.map((team, index) => <li key={`${team}-${index}`}><span>{index + 1}</span>{team}</li>)}</ol></CardContent></Card>)}</div></section>
  </div>;
}
