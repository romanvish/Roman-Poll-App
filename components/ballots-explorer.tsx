"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicBallot } from "@/lib/server/public-voters";
import { PublicVoterAvatar } from "@/components/public-voter-avatar";
import type { PublicVoter } from "@/lib/server/public-voters";

export function BallotsExplorer({ ballots, voters }: { ballots: PublicBallot[]; voters: PublicVoter[] }) {
  const [query, setQuery] = useState("");
  const profiles = useMemo(() => new Map(voters.map((voter) => [voter.id, voter])), [voters]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return ballots;
    return ballots.filter((ballot) => {
      const voter = profiles.get(ballot.voterId);
      return [ballot.voter, voter?.title, voter?.affiliation].some((value) => value?.toLocaleLowerCase().includes(term)) || ballot.entries.some((entry) => entry.team.toLocaleLowerCase().includes(term));
    });
  }, [ballots, query, profiles]);

  return <section aria-labelledby="individual-ballots-heading">
    <div className="ballots-toolbar">
      <div><p className="eyebrow">The ballot room</p><h2 id="individual-ballots-heading">Individual rankings</h2></div>
      <label className="ballot-search"><span>Search voter or team</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example, Ohio State" /></label>
    </div>
    <p className="ballot-result-count" aria-live="polite">Showing {visible.length} of {ballots.length} ballots</p>
    <div className="public-ballot-list">
      {visible.map((ballot) => <article className="public-ballot-card" key={ballot.voterId}>
        <div className="public-ballot-heading">
          <div className="public-ballot-voter">{profiles.has(ballot.voterId) && <PublicVoterAvatar name={ballot.voter} avatarPath={profiles.get(ballot.voterId)?.avatarPath ?? null} size="small" />}<span><p className="eyebrow">25 teams ranked</p><h3>{profiles.has(ballot.voterId) ? <Link href={`/voters/${encodeURIComponent(ballot.voterId)}`}>{ballot.voter}</Link> : ballot.voter}</h3>{profiles.get(ballot.voterId)?.affiliation && <small>{profiles.get(ballot.voterId)?.affiliation}</small>}</span></div>
          <details><summary>View ballot</summary><ol className="public-ballot-entries" aria-label={`${ballot.voter}'s ballot rankings`}>{ballot.entries.map((entry) => <li key={entry.rank}>
            <span className="public-ballot-rank">{entry.rank}</span><strong>{entry.team}</strong><small>{entry.record}</small>
          </li>)}</ol></details>
        </div>
      </article>)}
      {visible.length === 0 && <div className="empty-panel"><strong>No ballots match “{query}”.</strong><p>Try a voter name or a team.</p></div>}
    </div>
  </section>;
}
