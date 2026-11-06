export function ballotRankStatistics(ballots: Array<{ entries: Array<{ teamId: string | number; rank: number }> }>) {
  const teamIds = new Set(ballots.flatMap((ballot) => ballot.entries.map((entry) => entry.teamId)));
  return new Map([...teamIds].map((teamId) => {
    const ranks = ballots.map((ballot) => ballot.entries.find((entry) => entry.teamId === teamId)?.rank ?? 26);
    const mean = ranks.reduce((sum, rank) => sum + rank, 0) / Math.max(ranks.length, 1);
    const variance = ranks.reduce((sum, rank) => sum + (rank - mean) ** 2, 0) / Math.max(ranks.length, 1);
    return [teamId, { rankSpread: Math.max(...ranks) - Math.min(...ranks), rankStandardDeviation: Math.sqrt(variance), averageRank: mean }] as const;
  }));
}
