export type AggregationBallot = { entries: Array<{ rank: number; teamId: number; team: { name: string } }> };
export type AggregatedTeam = { teamId: number; team: string; rank: number; points: number; firstPlaceVotes: number; previousRank: number | null };

export function aggregatePoll(ballots: AggregationBallot[], previousRanks: Map<number, number> = new Map()): AggregatedTeam[] {
  const totals = new Map<number, { team: string; points: number; firstPlaceVotes: number }>();
  for (const ballot of ballots) {
    for (const entry of ballot.entries) {
      if (entry.rank < 1 || entry.rank > 25) continue;
      const current = totals.get(entry.teamId) ?? { team: entry.team.name, points: 0, firstPlaceVotes: 0 };
      current.points += 26 - entry.rank;
      if (entry.rank === 1) current.firstPlaceVotes++;
      totals.set(entry.teamId, current);
    }
  }
  const sorted = [...totals.entries()].map(([teamId, total]) => ({ teamId, ...total }))
    .sort((a, b) => b.points - a.points || b.firstPlaceVotes - a.firstPlaceVotes || a.team.localeCompare(b.team));
  let currentRank = 0;
  let priorPoints: number | null = null;
  let priorFirstPlaceVotes: number | null = null;
  return sorted.map((team, index) => {
    if (team.points !== priorPoints || team.firstPlaceVotes !== priorFirstPlaceVotes) currentRank = index + 1;
    priorPoints = team.points;
    priorFirstPlaceVotes = team.firstPlaceVotes;
    return { ...team, rank: currentRank, previousRank: previousRanks.get(team.teamId) ?? null };
  });
}
