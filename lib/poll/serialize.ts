import { publicPollSchema, type PublicPoll } from "@/lib/schemas/public-poll";

type ResultInput = {
  season: { year: number };
  number: number;
  label: string;
  publishedAt: Date | null;
  results: Array<{ teamId: number; rank: number; points: number; firstPlaceVotes: number; previousRank: number | null; team: { name: string }; record: string }>;
  ballots: Array<{ displayNameSnapshot: string | null; user: { displayName: string | null; name: string }; entries: Array<{ rank: number; team: { name: string } }> }>;
};

export function serializePublishedPoll(input: ResultInput): PublicPoll {
  const rankings = input.results.filter((result) => result.rank <= 25).map((result) => ({
    rank: result.rank,
    team: result.team.name,
    teamId: result.teamId,
    record: result.record,
    points: result.points,
    firstPlaceVotes: result.firstPlaceVotes,
    previousRank: result.previousRank,
  }));
  const othersReceivingVotes = input.results.filter((result) => result.rank > 25 && result.points > 0).map((result) => ({ team: result.team.name, teamId: result.teamId, points: result.points }));
  return publicPollSchema.parse({
    season: input.season.year,
    week: input.number,
    label: input.label,
    publishedAt: input.publishedAt?.toISOString(),
    voters: input.ballots.length,
    rankings,
    othersReceivingVotes,
    ballots: input.ballots.map((ballot) => ({
      voter: ballot.displayNameSnapshot || ballot.user.displayName || ballot.user.name,
      teams: [...ballot.entries].sort((a, b) => a.rank - b.rank).map((entry) => entry.team.name),
    })),
  });
}
