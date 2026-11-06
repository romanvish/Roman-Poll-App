import { ArrowDown, ClipboardList, ListOrdered, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLatestPublishedPoll } from "@/lib/server/published-polls";
import { getPublishedEditionDetails } from "@/lib/server/public-voters";
import { TeamIdentity } from "@/components/team-identity";

export const instant = false;

const steps = [
  { number: "01", title: "Make your case", description: "Twenty-five teams. Your order. A fresh ballot every week.", icon: ListOrdered },
  { number: "02", title: "Every vote counts", description: "First place earns 25 points, down to one point for No. 25.", icon: Users },
  { number: "03", title: "See the whole picture", description: "When an edition is published, the rankings and every ballot become public.", icon: Trophy },
];

export default async function Home() {
  await connection();
  const latestPoll = await getLatestPublishedPoll();
  const latestDetails = latestPoll ? await getPublishedEditionDetails(latestPoll.season, latestPoll.week) : null;
  const teamDetails = new Map(latestDetails?.pollRanks.map((team) => [team.team, team]) ?? []);
  return <>
    <section className="poll-hero" aria-labelledby="welcome-heading">
      <div className="page-shell hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">College football · A poll among friends</p>
          <h1 id="welcome-heading">The game is better<br />with a little debate.</h1>
          <p className="hero-lede">Our teams. Our takes. Our Top 25. An independent college football poll built on the opinions of the people you watch with.</p>
          <Button asChild className="mt-8"><a href="#latest-poll">Explore the poll <ArrowDown aria-hidden="true" /></a></Button>
        </div>
        <div className="ballot-mark" aria-hidden="true"><span>THE ROMAN POLL</span><strong>25</strong><p>A different perspective.<br />Every single week.</p></div>
      </div>
    </section>

    <div className="page-shell page-stack">
      <section id="latest-poll" aria-labelledby="latest-heading">
        <div className="section-heading"><div><p className="eyebrow">The latest edition</p><h2 id="latest-heading">{latestPoll ? `${latestPoll.season}: ${latestPoll.label}` : "The field is wide open."}</h2></div><span className="edition-label">{latestPoll ? `${latestPoll.voters} voters` : "Awaiting publication"}</span></div>
        {latestPoll ? <Card><CardContent className="latest-poll-card">
          {latestDetails?.editorial && <div className="poll-editorial home-editorial"><p className="eyebrow">{latestPoll.season} · {latestPoll.label}</p><h2>{latestDetails.editorial.headline}</h2><p className="poll-editorial-dek">{latestDetails.editorial.dek}</p></div>}
          <div className="results-table-wrap"><table className="latest-poll-table"><thead><tr><th>Rank</th><th>Team</th><th>Record</th><th>Points</th><th>Firsts</th><th>Movement</th></tr></thead><tbody>{latestPoll.rankings.map((team) => {
            const details = teamDetails.get(team.team);
            const movement = team.previousRank === null ? "New" : team.previousRank === team.rank ? "—" : team.rank < team.previousRank ? `↑ ${team.previousRank - team.rank}` : `↓ ${team.rank - team.previousRank}`;
            return <tr key={`${team.teamId}-${team.rank}`}><td>{team.rank}</td><th scope="row"><TeamIdentity id={details?.teamSlug ?? team.teamId} name={team.team} logoPath={details?.logoPath} /></th><td>{team.record}</td><td>{team.points}</td><td>{team.firstPlaceVotes}</td><td>{movement}</td></tr>;
          })}</tbody></table></div>
          <Link href={`/polls/${latestPoll.season}/${latestPoll.week}`} className="text-link">View rankings and every ballot</Link>
        </CardContent></Card> : <Card><CardContent className="empty-state">
          <ClipboardList className="empty-icon" size={34} strokeWidth={1.5} aria-hidden="true" />
          <h3>No published poll yet</h3>
          <p>The first Top 25 will appear here once voting is complete and the edition is published. Check back for the rankings, the ballots, and the debate.</p>
          <span className="empty-rule" aria-hidden="true" />
          <p className="empty-caption">A new season. A clean slate.</p>
        </CardContent></Card>}
      </section>

      <section id="how-it-works" aria-labelledby="method-heading">
        <p className="eyebrow">Opinion meets accountability</p><h2 id="method-heading">One group. Twenty-five spots.</h2>
        <p className="section-lede">A simple weekly ritual, with every pick out in the open after publication.</p>
        <div className="method-grid">{steps.map(({ number, title, description, icon: Icon }) => <article key={number}>
          <div className="method-top"><span>{number}</span><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></div>
          <h3>{title}</h3><p>{description}</p>
        </article>)}</div>
      </section>
    </div>
  </>;
}
