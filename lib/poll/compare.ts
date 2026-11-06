export type CompareTeamId = number | string;
export type CompareBallotEntry = { teamId: CompareTeamId; team: string; rank: number };
export type CompareRow = { teamId: CompareTeamId; team: string; leftRank: number; rightRank: number; pollRank: number | null; gap: number };

export function compareBallotRanks(
  left: CompareBallotEntry[],
  right: CompareBallotEntry[],
  pollRanks: Array<{ teamId: CompareTeamId; rank: number }>,
): CompareRow[] {
  const leftRanks = new Map(left.map((entry) => [entry.teamId, entry.rank]));
  const rightRanks = new Map(right.map((entry) => [entry.teamId, entry.rank]));
  const officialRanks = new Map(pollRanks.map((entry) => [entry.teamId, entry.rank]));
  const teams = new Map([...left, ...right].map((entry) => [entry.teamId, entry.team]));
  return [...teams].map(([teamId, team]) => {
    const leftRank = leftRanks.get(teamId) ?? 26;
    const rightRank = rightRanks.get(teamId) ?? 26;
    const pollRank = officialRanks.get(teamId);
    return { teamId, team, leftRank, rightRank, pollRank: pollRank && pollRank <= 25 ? pollRank : null, gap: Math.abs(leftRank - rightRank) };
  }).sort((a, b) => (a.pollRank ?? 26) - (b.pollRank ?? 26) || b.gap - a.gap || a.team.localeCompare(b.team));
}
