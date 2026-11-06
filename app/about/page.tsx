import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PublicVoterAvatar } from "@/components/public-voter-avatar";
import { getPublicVoters } from "@/lib/server/public-voters";

export const instant = false;
export const metadata: Metadata = {
  title: "About the poll and its voters",
  description: "How Roman Poll works and meet the voters behind each published ballot.",
};

export default async function AboutPage() {
  await connection();
  const voters = await getPublicVoters();
  return <div className="page-shell account-page page-stack about-page">
    <header className="page-heading narrow-heading">
      <p className="eyebrow">Our method</p>
      <h1>A poll you can inspect, not just accept.</h1>
      <p className="lede">Roman Poll combines independent Top 25 ballots into one weekly ranking. Once an edition is published, every point and every pick is open to the group.</p>
    </header>
    <section aria-labelledby="method-heading">
      <div className="section-heading"><div><p className="eyebrow">The scoring</p><h2 id="method-heading">How it works</h2></div><span className="edition-label">25 teams · one ballot each</span></div>
      <div className="method-grid">
        <article><div className="method-top"><span>01</span><strong>25 → 1</strong></div><h3>Points by position</h3><p>A first-place vote earns 25 points, second earns 24, continuing down to one point at No. 25.</p></article>
        <article><div className="method-top"><span>02</span><strong>Σ</strong></div><h3>Ballots combined</h3><p>Points from each submitted ballot are totaled. First-place votes break point ties, and unresolved ties share a rank.</p></article>
        <article><div className="method-top"><span>03</span><strong>↕</strong></div><h3>Every pick is visible</h3><p>Published editions include the individual rankings, so you can inspect a ballot or compare two voters team by team.</p></article>
      </div>
    </section>
    <section aria-labelledby="voters-heading">
      <div className="section-heading"><div><p className="eyebrow">The panel</p><h2 id="voters-heading">Meet the voters</h2></div><span className="edition-label">{voters.length} approved voters</span></div>
      {voters.length ? <div className="public-voter-grid">{voters.map((voter) => <article className="public-voter-card" key={voter.id}>
        <Link className="public-voter-card-link" href={`/voters/${encodeURIComponent(voter.id)}`}>
          <PublicVoterAvatar name={voter.name} avatarPath={voter.avatarPath} />
          <span><strong>{voter.name}</strong><small>{[voter.title, voter.affiliation].filter(Boolean).join(" · ") || "Roman Poll voter"}</small></span>
        </Link>
        {voter.tagline && <p className="public-voter-tagline">{voter.tagline}</p>}
        {voter.bio[0] && <p className="public-voter-bio">{voter.bio[0]}</p>}
        {voter.specialties.length > 0 && <div className="public-voter-specialties">{voter.specialties.slice(0, 3).map((specialty) => <span key={specialty}>{specialty}</span>)}</div>}
        <Link className="text-link" href={`/voters/${encodeURIComponent(voter.id)}`}>Meet {voter.name.split(" ")[0]} <span aria-hidden="true">→</span></Link>
      </article>)}</div> : <div className="empty-panel"><strong>The voter panel is not populated yet.</strong><p>Approved voters will appear here after they create their profiles.</p></div>}
    </section>
  </div>;
}
