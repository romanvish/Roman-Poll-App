import { describe, expect, it } from "vitest";
import { aggregatePoll } from "../../lib/poll/aggregate";
import { serializePublishedPoll } from "../../lib/poll/serialize";

function ballot(ids: number[]) {
  return { entries: ids.map((teamId, index) => ({ rank: index + 1, teamId, team: { name: `Team ${teamId}` } })) };
}

describe("poll aggregation", () => {
  it("awards 25-to-1 points and counts first-place votes", () => {
    const [first, second] = aggregatePoll([ballot([1, 2, 3, ...Array.from({ length: 22 }, (_, i) => i + 4)])]);
    expect(first).toMatchObject({ teamId: 1, rank: 1, points: 25, firstPlaceVotes: 1 });
    expect(second).toMatchObject({ teamId: 2, rank: 2, points: 24, firstPlaceVotes: 0 });
  });

  it("uses first-place votes to break point ties, then shares unresolved ranks", () => {
    const ballots = [
      ballot([1, 2, 3, 4, ...Array.from({ length: 21 }, (_, i) => i + 5)]),
      ballot([2, 1, 3, 4, ...Array.from({ length: 21 }, (_, i) => i + 5)]),
    ];
    const ranked = aggregatePoll(ballots, new Map([[1, 3]]));
    expect(ranked.slice(0, 3).map(({ teamId, rank, points, firstPlaceVotes, previousRank }) => ({ teamId, rank, points, firstPlaceVotes, previousRank }))).toEqual([
      { teamId: 1, rank: 1, points: 49, firstPlaceVotes: 1, previousRank: 3 },
      { teamId: 2, rank: 1, points: 49, firstPlaceVotes: 1, previousRank: null },
      { teamId: 3, rank: 3, points: 46, firstPlaceVotes: 0, previousRank: null },
    ]);

    const filler = Array.from({ length: 22 }, (_, i) => i + 10);
    const tiebreakBallots = [ballot([1, 2, 3, ...Array.from({ length: 22 }, (_, i) => i + 4)]), ballot([3, 2, 1, ...filler])];
    const tiebreak = aggregatePoll(tiebreakBallots);
    expect(tiebreak.find((team) => team.teamId === 1)?.rank).toBeLessThan(tiebreak.find((team) => team.teamId === 2)!.rank);
  });

  it("keeps vote getters past rank 25 as others receiving votes", () => {
    const first = ballot(Array.from({ length: 25 }, (_, i) => i + 1));
    const second = ballot([...Array.from({ length: 23 }, (_, i) => i + 1), 25, 26]);
    const ranked = aggregatePoll([first, second]);
    expect(ranked.find((team) => team.teamId === 26)).toMatchObject({ rank: 26, points: 1, firstPlaceVotes: 0 });
  });

  it("serializes only the placeholder static-site contract", () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({ rank: index + 1, team: { name: `Team ${index + 1}` } }));
    const payload = serializePublishedPoll({
      season: { year: 2026 }, number: 11, label: "Week 11", publishedAt: new Date("2026-11-09T18:00:00Z"),
      results: [
        { teamId: 1, rank: 1, points: 346, firstPlaceVotes: 10, previousRank: 1, team: { name: "Ohio State" }, record: "9-0" },
        { teamId: 99, rank: 26, points: 12, firstPlaceVotes: 0, previousRank: null, team: { name: "Tulane" }, record: "7-2" },
      ],
      ballots: [{ displayNameSnapshot: "Sam", user: { displayName: "Sam", name: "Sam Demo" }, entries }],
    });
    expect(Object.keys(payload)).toEqual(["season", "week", "label", "publishedAt", "voters", "rankings", "othersReceivingVotes", "ballots"]);
    expect(payload.rankings[0]).toEqual({ rank: 1, team: "Ohio State", teamId: 1, record: "9-0", points: 346, firstPlaceVotes: 10, previousRank: 1 });
    expect(payload.othersReceivingVotes).toEqual([{ team: "Tulane", teamId: 99, points: 12 }]);
    expect(payload.ballots[0].teams).toHaveLength(25);
  });
});
