export type TeamHistoryItem = { season: number; week: number; label: string; publishedAt: string; rank: number; points: number; firstPlaceVotes: number; previousRank: number | null; record: string };

export function TeamRankTrend({ history, team }: { history: TeamHistoryItem[]; team: string }) {
  const maxRank = Math.max(25, ...history.map((item) => item.rank));
  const points = history.map((item, index) => {
    const x = history.length < 2 ? 300 : 36 + (index / (history.length - 1)) * 528;
    const y = 18 + ((item.rank - 1) / Math.max(maxRank - 1, 1)) * 142;
    return { x, y, label: `${item.label}: No. ${item.rank}` };
  });
  if (!points.length) return <div className="empty-panel"><strong>No published ranking history yet.</strong><p>This team will appear here after its first published ballot.</p></div>;
  return <figure className="team-trend">
    <figcaption>{team} rank by published week <span>(higher ranks appear near the top)</span></figcaption>
    <svg viewBox="0 0 600 180" role="img" aria-label={`${team} ranking trend from ${history[0].label} to ${history.at(-1)?.label}`}>
      {[...new Set([1, 5, 10, 15, 20, 25, maxRank])].filter((rank) => rank <= maxRank).map((rank) => {
        const y = 18 + ((rank - 1) / Math.max(maxRank - 1, 1)) * 142;
        return <g key={rank}><line x1="36" x2="564" y1={y} y2={y} /><text x="4" y={y + 4}>#{rank}</text></g>;
      })}
      {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />}
      {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="5"><title>{point.label}</title></circle>)}
    </svg>
    <div className="team-trend-labels"><span>{history[0].label}</span><span>{history.at(-1)?.label}</span></div>
  </figure>;
}

export function TeamHistory({ history, team }: { history: TeamHistoryItem[]; team: string }) {
  return <section className="team-history-section" aria-labelledby="team-history-heading">
    <div className="section-heading"><div><p className="eyebrow">Published editions</p><h2 id="team-history-heading">{team} poll history</h2></div><span className="edition-label">{history.length} ranked weeks</span></div>
    <TeamRankTrend history={history} team={team} />
    {history.length > 0 && <div className="results-table-wrap"><table className="results-table team-history-table"><thead><tr><th>Week</th><th>Record</th><th>Rank</th><th>Points</th><th>First-place votes</th></tr></thead><tbody>
      {[...history].reverse().map((item) => <tr key={`${item.season}-${item.week}`}><th scope="row">{item.season} · {item.label}</th><td>{item.record}</td><td>{item.rank <= 25 ? `#${item.rank}` : `Others (${item.rank})`}</td><td>{item.points}</td><td>{item.firstPlaceVotes}</td></tr>)}
    </tbody></table></div>}
  </section>;
}
