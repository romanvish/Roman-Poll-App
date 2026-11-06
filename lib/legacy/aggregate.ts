import type { LegacyArchive } from "@/lib/schemas/legacy-archive";

export type LegacyComputedRank = {
  teamId: string;
  team: string;
  rank: number;
  points: number;
  firstPlaceVotes: number;
  previousRank: number | null;
  record: string;
  rankSpread: number;
  rankStandardDeviation: number;
  averageRank: number;
};

export function aggregateLegacyWeek(
  week: LegacyArchive["weeks"][number],
  teamIds: Map<string, string>,
  previousRanks: Map<string, number> = new Map(),
): LegacyComputedRank[] {
  const teams = new Map<string, { name: string; points: number; rankTotal: number; ballots: number; firstPlaceVotes: number }>();
  const canonicalTeam = new Map([...teamIds.keys()].map((name) => [name.toLocaleLowerCase(), name]));
  for (const voter of week.voters) {
    for (const entry of voter.ballot) {
      const canonicalName = canonicalTeam.get(entry.team.toLocaleLowerCase()) ?? entry.team;
      const current = teams.get(canonicalName) ?? { name: canonicalName, points: 0, rankTotal: 0, ballots: 0, firstPlaceVotes: 0 };
      current.points += 26 - entry.rank;
      current.rankTotal += entry.rank;
      current.ballots++;
      if (entry.rank === 1) current.firstPlaceVotes++;
      teams.set(canonicalName, current);
    }
  }
  const records = new Map(Object.entries(week.records).map(([name, record]) => [name.toLocaleLowerCase(), record]));
  return [...teams.values()].map((total) => {
    const teamId = teamIds.get(total.name)!;
    const ranks = week.voters.map((voter) => voter.ballot.find((entry) => entry.team.toLocaleLowerCase() === total.name.toLocaleLowerCase())?.rank ?? 26);
    const average = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    const variance = ranks.reduce((sum, rank) => sum + (rank - average) ** 2, 0) / ranks.length;
    return {
      teamId,
      team: total.name,
      rank: 0,
      points: total.points,
      firstPlaceVotes: total.firstPlaceVotes,
      previousRank: previousRanks.get(teamId) ?? null,
      record: records.get(total.name.toLocaleLowerCase()) ?? "0-0",
      rankSpread: Math.max(...ranks) - Math.min(...ranks),
      rankStandardDeviation: Math.sqrt(variance),
      averageRank: total.rankTotal / total.ballots,
    };
  }).sort((a, b) => b.points - a.points || a.averageRank - b.averageRank || a.team.localeCompare(b.team))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export function calculateLegacyRankings(archive: LegacyArchive) {
  const teamIds = new Map(archive.teams.map((team) => [team.name, team.id]));
  const priorTop25 = new Map<string, number>();
  return archive.weeks.map((week) => {
    const ranks = aggregateLegacyWeek(week, teamIds, priorTop25);
    const currentTop25 = new Map(ranks.filter((item) => item.rank <= 25).map((item) => [item.teamId, item.rank]));
    priorTop25.clear();
    for (const [teamId, rank] of currentTop25) priorTop25.set(teamId, rank);
    return ranks;
  });
}
