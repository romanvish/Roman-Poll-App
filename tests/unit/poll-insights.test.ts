import { describe, expect, it } from "vitest";
import { getSeasonSignatureTakes, getVoterLens, getWeeklySuperlatives, type InsightBallot } from "../../lib/poll/insights";

const weekOne: InsightBallot[] = [
  { voterId: "a", voter: "A", entries: [{ teamId: 1, team: "Alpha", rank: 1 }, { teamId: 2, team: "Beta", rank: 2 }] },
  { voterId: "b", voter: "B", entries: [{ teamId: 1, team: "Alpha", rank: 5 }, { teamId: 2, team: "Beta", rank: 1 }] },
];

describe("published poll insights", () => {
  it("finds consensus, debate, climber, and the boldest voter/team pair", () => {
    expect(getWeeklySuperlatives(weekOne, [
      { teamId: 2, team: "Beta", rank: 1, previousRank: null },
      { teamId: 1, team: "Alpha", rank: 2, previousRank: 4 },
    ])).toEqual({
      mostConsensus: { teamId: 2, team: "Beta", rankSpread: 1 },
      mostDebated: { teamId: 1, team: "Alpha", rankSpread: 4 },
      biggestClimber: { teamId: 1, team: "Alpha", spots: 2 },
      boldestBallot: { teamId: 1, team: "Alpha", voterId: "a", voter: "A", voterRank: 1, fieldAverageRank: 5, delta: 4 },
    });
  });

  it("shows a voter's highest weekly departures from the rest of the panel", () => {
    expect(getVoterLens(weekOne, "a")).toEqual({
      available: true,
      higher: [{ teamId: 1, team: "Alpha", voterRank: 1, fieldAverageRank: 5, delta: 4 }],
      lower: [{ teamId: 2, team: "Beta", voterRank: 2, fieldAverageRank: 1, delta: -1 }],
    });
  });

  it("averages each voter’s deviations across published editions for signature takes", () => {
    const weekTwo: InsightBallot[] = [
      { voterId: "a", voter: "A", entries: [{ teamId: 1, team: "Alpha", rank: 3 }, { teamId: 2, team: "Beta", rank: 2 }] },
      { voterId: "b", voter: "B", entries: [{ teamId: 1, team: "Alpha", rank: 1 }, { teamId: 2, team: "Beta", rank: 3 }] },
    ];
    expect(getSeasonSignatureTakes([{ ballots: weekOne }, { ballots: weekTwo }], "a")).toEqual({
      available: true,
      higher: [{ teamId: 1, team: "Alpha", voterRank: 2, fieldAverageRank: 3, delta: 1 }],
      lower: [],
    });
  });
});
