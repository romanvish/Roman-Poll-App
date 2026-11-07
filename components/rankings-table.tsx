import type { PublicPoll } from "@/lib/schemas/public-poll";
import { TeamIdentity } from "@/components/team-identity";

type RankingRow = PublicPoll["rankings"][number] & {
  logoPath?: string | null;
  teamSlug?: string;
  rankSpread?: number;
};

function MovementBadge({ previousRank, rank }: { previousRank: number | null; rank: number }) {
  if (previousRank === null) return <span className="movement new">NEW</span>;
  if (previousRank === rank) return <span className="movement same"><span aria-hidden="true">—</span><span className="sr-only">No change</span></span>;
  const movedUp = previousRank > rank;
  return <span className={`movement ${movedUp ? "up" : "down"}`}>
    <span aria-hidden="true">{movedUp ? "↑" : "↓"}</span> {Math.abs(previousRank - rank)}
    <span className="sr-only"> {movedUp ? "places up" : "places down"}</span>
  </span>;
}

function ConsensusBadge({ rankSpread }: { rankSpread?: number }) {
  if (rankSpread === undefined) return <span className="consensus unavailable">—<span className="sr-only">Consensus unavailable</span></span>;
  const level = rankSpread === 0 ? "unanimous" : rankSpread <= 5 ? "close" : "split";
  const label = level === "unanimous" ? "Unanimous" : level === "close" ? "Close" : "Split";
  return <span className={`consensus ${level}`} title={`Ballot rank range: ${rankSpread}`}>
    {label}<small>spread {rankSpread}</small><span className="sr-only">; rank range {rankSpread}</span>
  </span>;
}

export function RankingsTable({ rows, pointsAvailable }: { rows: RankingRow[]; pointsAvailable: number }) {
  if (rows.length === 0) return <div className="empty-panel">No teams were ranked in this edition.</div>;

  return <>
    <div className="rankings-table-wrap">
      <table className="rankings-table" aria-label="Poll rankings">
        <thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Record</th><th scope="col">Movement</th><th scope="col">Consensus</th><th scope="col">Firsts</th><th scope="col">Points</th></tr></thead>
        <tbody>{rows.map((team) => <tr key={`${team.teamId}-${team.rank}`}>
          <td><span className="rank-number">{team.rank}</span></td>
          <th scope="row"><TeamIdentity id={team.teamSlug ?? team.teamId} name={team.team} logoPath={team.logoPath} /></th>
          <td>{team.record}</td>
          <td><MovementBadge previousRank={team.previousRank} rank={team.rank} /></td>
          <td><ConsensusBadge rankSpread={team.rankSpread} /></td>
          <td>{team.firstPlaceVotes || "—"}</td>
          <td><strong>{team.points}</strong><small> / {pointsAvailable}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="ranking-mobile" aria-label="Poll rankings">
      {rows.map((team) => <article key={`${team.teamId}-${team.rank}`}>
        <span className="rank-number">{team.rank}</span>
        <div className="ranking-mobile-team">
          <TeamIdentity id={team.teamSlug ?? team.teamId} name={team.team} logoPath={team.logoPath} />
          <p>{team.record} · {team.points} points · {team.firstPlaceVotes || "—"} firsts</p>
        </div>
        <div className="ranking-mobile-badges">
          <MovementBadge previousRank={team.previousRank} rank={team.rank} />
          <ConsensusBadge rankSpread={team.rankSpread} />
        </div>
      </article>)}
    </div>
  </>;
}
