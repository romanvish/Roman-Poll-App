export type InsightTeamId = number | string;
export type InsightEntry = { rank: number; teamId: InsightTeamId; team: string };
export type InsightBallot = { voterId: string; voter: string; entries: InsightEntry[] };
export type VoterTeamDelta = { teamId: InsightTeamId; team: string; voterRank: number; fieldAverageRank: number; delta: number };
export type VoterLens = { available: boolean; higher: VoterTeamDelta[]; lower: VoterTeamDelta[] };
export type WeeklySuperlatives = {
  mostConsensus: { teamId: InsightTeamId; team: string; rankSpread: number } | null;
  mostDebated: { teamId: InsightTeamId; team: string; rankSpread: number } | null;
  biggestClimber: { teamId: InsightTeamId; team: string; spots: number } | null;
  boldestBallot: (VoterTeamDelta & { voterId: string; voter: string }) | null;
};

const UNRANKED = 26;

export function getVoterDeltas(ballots: InsightBallot[], voterId: string): VoterTeamDelta[] {
  const voter = ballots.find((ballot) => ballot.voterId === voterId);
  const field = ballots.filter((ballot) => ballot.voterId !== voterId);
  if (!voter || field.length === 0) return [];
  const teams = new Map([...ballots.flatMap((ballot) => ballot.entries)].map((entry) => [entry.teamId, entry.team]));
  const voterRanks = new Map(voter.entries.map((entry) => [entry.teamId, entry.rank]));
  return [...teams].map(([teamId, team]) => {
    const voterRank = voterRanks.get(teamId) ?? UNRANKED;
    const fieldAverageRank = field.reduce((sum, ballot) => sum + (ballot.entries.find((entry) => entry.teamId === teamId)?.rank ?? UNRANKED), 0) / field.length;
    return { teamId, team, voterRank, fieldAverageRank, delta: fieldAverageRank - voterRank };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.team.localeCompare(b.team));
}

export function getVoterLens(ballots: InsightBallot[], voterId: string, limit = 3): VoterLens {
  const deltas = getVoterDeltas(ballots, voterId);
  return { available: deltas.length > 0, higher: deltas.filter((item) => item.delta > 0).slice(0, limit), lower: deltas.filter((item) => item.delta < 0).slice(0, limit) };
}

export function getSeasonSignatureTakes(editions: Array<{ ballots: InsightBallot[] }>, voterId: string, limit = 3): VoterLens {
  const grouped = new Map<InsightTeamId, { team: string; delta: number; voterRank: number; fieldRank: number; count: number }>();
  for (const edition of editions) {
    for (const item of getVoterDeltas(edition.ballots, voterId)) {
      const current = grouped.get(item.teamId) ?? { team: item.team, delta: 0, voterRank: 0, fieldRank: 0, count: 0 };
      current.delta += item.delta;
      current.voterRank += item.voterRank;
      current.fieldRank += item.fieldAverageRank;
      current.count++;
      grouped.set(item.teamId, current);
    }
  }
  const deltas = [...grouped].map(([teamId, item]) => ({
    teamId, team: item.team, voterRank: item.voterRank / item.count,
    fieldAverageRank: item.fieldRank / item.count, delta: item.delta / item.count,
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.team.localeCompare(b.team));
  return { available: deltas.length > 0, higher: deltas.filter((item) => item.delta > 0).slice(0, limit), lower: deltas.filter((item) => item.delta < 0).slice(0, limit) };
}

export function getWeeklySuperlatives(
  ballots: InsightBallot[],
  pollRanks: Array<{ teamId: InsightTeamId; team: string; rank: number; previousRank: number | null }>,
): WeeklySuperlatives {
  const teamNames = new Map([...ballots.flatMap((ballot) => ballot.entries)].map((entry) => [entry.teamId, entry.team]));
  const rankSpread = new Map<InsightTeamId, { spread: number; standardDeviation: number }>();
  for (const teamId of teamNames.keys()) {
    const ranks = ballots.map((ballot) => ballot.entries.find((entry) => entry.teamId === teamId)?.rank ?? UNRANKED);
    const mean = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    const variance = ranks.reduce((sum, rank) => sum + (rank - mean) ** 2, 0) / ranks.length;
    rankSpread.set(teamId, { spread: Math.max(...ranks) - Math.min(...ranks), standardDeviation: Math.sqrt(variance) });
  }
  const ranked = pollRanks.filter((result) => result.rank <= 25 && rankSpread.has(result.teamId));
  const byConsensus = [...ranked].sort((a, b) => rankSpread.get(a.teamId)!.standardDeviation - rankSpread.get(b.teamId)!.standardDeviation || a.rank - b.rank || a.team.localeCompare(b.team));
  const byDebate = [...ranked].sort((a, b) => rankSpread.get(b.teamId)!.standardDeviation - rankSpread.get(a.teamId)!.standardDeviation || a.rank - b.rank || a.team.localeCompare(b.team));
  const climber = ranked.filter((team) => team.previousRank !== null && team.previousRank <= 25 && team.previousRank > team.rank)
    .map((team) => ({ team, spots: team.previousRank! - team.rank }))
    .sort((a, b) => b.spots - a.spots || a.team.rank - b.team.rank)[0];
  const boldest = ballots.flatMap((ballot) => getVoterDeltas(ballots, ballot.voterId).map((delta) => ({ ...delta, voterId: ballot.voterId, voter: ballot.voter })))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.voterId.localeCompare(b.voterId) || a.team.localeCompare(b.team))[0];
  const summary = (team: typeof ranked[number] | undefined) => team ? { teamId: team.teamId, team: team.team, rankSpread: rankSpread.get(team.teamId)!.spread } : null;
  return {
    mostConsensus: summary(byConsensus[0]),
    mostDebated: summary(byDebate[0]),
    biggestClimber: climber ? { teamId: climber.team.teamId, team: climber.team.team, spots: climber.spots } : null,
    boldestBallot: boldest ?? null,
  };
}
