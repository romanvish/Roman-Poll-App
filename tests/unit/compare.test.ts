import { describe, expect, it } from "vitest";
import { compareBallotRanks } from "../../lib/poll/compare";

describe("published ballot comparison", () => {
  it("shows each voter rank, marks omitted teams NR, and sorts by the poll then disagreement", () => {
    const rows = compareBallotRanks(
      [{ teamId: 1, team: "Alpha", rank: 1 }, { teamId: 2, team: "Beta", rank: 2 }, { teamId: 3, team: "Gamma", rank: 3 }],
      [{ teamId: 2, team: "Beta", rank: 1 }, { teamId: 3, team: "Gamma", rank: 2 }, { teamId: 4, team: "Delta", rank: 3 }],
      [{ teamId: 1, rank: 2 }, { teamId: 2, rank: 1 }, { teamId: 4, rank: 28 }],
    );
    expect(rows).toEqual([
      { teamId: 2, team: "Beta", leftRank: 2, rightRank: 1, pollRank: 1, gap: 1 },
      { teamId: 1, team: "Alpha", leftRank: 1, rightRank: 26, pollRank: 2, gap: 25 },
      { teamId: 4, team: "Delta", leftRank: 26, rightRank: 3, pollRank: null, gap: 23 },
      { teamId: 3, team: "Gamma", leftRank: 3, rightRank: 2, pollRank: null, gap: 1 },
    ]);
  });

  it("returns no comparison rows when neither voter has a ranked team", () => {
    expect(compareBallotRanks([], [], [])).toEqual([]);
  });
});
