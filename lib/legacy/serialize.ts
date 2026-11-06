import { publicPollSchema, type PublicPoll } from "@/lib/schemas/public-poll";

export type LegacyPollInput = {
  season: number;
  week: number;
  label: string;
  publishedAt: Date;
  ranks: Array<{ teamId: string; publicTeamId: string | number; team: string; rank: number; points: number; firstPlaceVotes: number; previousRank: number | null; record: string }>;
  ballots: Array<{ voter: string; entries: Array<{ rank: number; team: string }> }>;
};

export function serializeLegacyPublishedPoll(input: LegacyPollInput): PublicPoll {
  return publicPollSchema.parse({
    season: input.season,
    week: input.week,
    label: input.label,
    publishedAt: input.publishedAt.toISOString(),
    voters: input.ballots.length,
    rankings: input.ranks.filter((rank) => rank.rank <= 25).map((rank) => ({
      rank: rank.rank, team: rank.team, teamId: rank.publicTeamId, record: rank.record,
      points: rank.points, firstPlaceVotes: rank.firstPlaceVotes, previousRank: rank.previousRank,
    })),
    othersReceivingVotes: input.ranks.filter((rank) => rank.rank > 25 && rank.points > 0).map((rank) => ({ team: rank.team, teamId: rank.publicTeamId, points: rank.points })),
    ballots: input.ballots.map((ballot) => ({ voter: ballot.voter, teams: [...ballot.entries].sort((a, b) => a.rank - b.rank).map((entry) => entry.team) })),
  });
}
