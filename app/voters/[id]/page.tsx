import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicVoterAvatar } from "@/components/public-voter-avatar";
import { VoterInsights } from "@/components/voter-insights";
import { publicVoterIdSchema } from "@/lib/schemas/public-routes";
import { getPublicVoter, getVoterInsightEditions } from "@/lib/server/public-voters";
import { getSeasonSignatureTakes, getVoterLens } from "@/lib/poll/insights";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = publicVoterIdSchema.safeParse((await params).id);
  if (!id.success) return { title: "Voter profile" };
  const voter = await getPublicVoter(id.data);
  return voter ? { title: voter.name, description: voter.bio[0] ?? `${voter.name}, Roman Poll voter.` } : { title: "Voter not found" };
}

export default async function VoterProfilePage({ params }: Props) {
  await connection();
  const id = publicVoterIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const voter = await getPublicVoter(id.data);
  if (!voter) notFound();
  const latest = voter.ballots[0];
  const insights = await getVoterInsightEditions(voter.id);
  const seasonEditions = latest ? insights.filter((edition) => edition.season === latest.season) : [];
  const latestEdition = latest ? seasonEditions.find((edition) => edition.week === latest.week) : undefined;
  return <div className="page-shell account-page page-stack voter-profile-page">
    <Link href="/about" className="text-link">← Meet the panel</Link>
    <header className="public-voter-hero">
      <PublicVoterAvatar name={voter.name} avatarPath={voter.avatarPath} />
      <div><p className="eyebrow">Roman Poll voter</p><h1>{voter.name}</h1>
        <p className="public-voter-role">{[voter.title, voter.affiliation].filter(Boolean).join(" · ") || "Independent voter"}</p>
        {voter.location && <p className="public-voter-location">{voter.location}</p>}
        {voter.favoriteTeam && <p className="public-voter-favorite">Favorite team: <strong>{voter.favoriteTeam}</strong></p>}
        {voter.tagline && <p className="public-voter-tagline">“{voter.tagline}”</p>}
        {voter.specialties.length > 0 && <div className="public-voter-specialties">{voter.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div>}
      </div>
    </header>
    <section className="voter-bio-section" aria-labelledby="about-voter-heading">
      <div><p className="eyebrow">The person behind the picks</p><h2 id="about-voter-heading">About {voter.name.split(" ")[0]}</h2></div>
      <div>{voter.bio.length ? voter.bio.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>) : <p>This voter has not added a bio yet.</p>}
        {voter.links.length > 0 && <div className="public-voter-links">{voter.links.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
      </div>
    </section>
    {latest && <section aria-labelledby="latest-ballot-heading">
      <div className="section-heading"><div><p className="eyebrow">Latest published ballot · {latest.season}</p><h2 id="latest-ballot-heading">{latest.label}</h2></div>
        <Link className="text-link" href={`/compare/${latest.season}/week/${latest.week}`}>Compare this ballot</Link>
      </div>
      <ol className="profile-ballot">{latest.entries.map((entry) => <li key={entry.rank}><span>{entry.rank}</span><strong>{entry.team}</strong><small>{entry.record}</small></li>)}</ol>
    </section>}
    {latestEdition && <VoterInsights lens={getVoterLens(latestEdition.ballots, voter.id)} title={`${latest.label}: against the field`} />}
    {latest && <VoterInsights lens={getSeasonSignatureTakes(seasonEditions, voter.id)} title={`${latest.season} signature takes`} />}
    <section aria-labelledby="published-history-heading">
      <div className="section-heading"><div><p className="eyebrow">Archive</p><h2 id="published-history-heading">Published ballots</h2></div></div>
      {voter.ballots.length ? <div className="edition-link-grid">{voter.ballots.map((ballot) => <Link key={`${ballot.season}-${ballot.week}`} href={`/ballots/${ballot.season}/week/${ballot.week}`}>
        <strong>{ballot.season} · {ballot.label}</strong><span>{new Date(ballot.publishedAt).toLocaleDateString()} →</span>
      </Link>)}</div> : <div className="empty-panel"><strong>No published ballot yet</strong><p>This voter’s profile is ready; their rankings will appear here after publication.</p></div>}
    </section>
  </div>;
}
