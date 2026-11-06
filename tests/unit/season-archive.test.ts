import { describe, expect, it } from "vitest";
import { seasonArchiveSchema } from "../../lib/schemas/season-archive";

const archive = {
  format: "roman-poll-season",
  version: 1,
  season: { year: 2026, isCurrent: false },
  teams: [
    { id: 1, name: "Alpha", shortName: "Alphas", abbreviation: "ALP", logoUrl: null, color: null, conference: "North", isFbs: true, isEligible: true },
    { id: 2, name: "Beta", shortName: "Betas", abbreviation: "BET", logoUrl: null, color: null, conference: "North", isFbs: true, isEligible: true },
  ],
  weeks: [{ number: 1, label: "Week 1", status: "open", opensAt: null, deadline: "2026-09-01T00:00:00Z", publishedAt: null, editorial: null, snapshots: [], results: [], ballots: [] }],
};

describe("season archive schema", () => {
  it("accepts a complete season archive and rejects unknown fields", () => {
    expect(seasonArchiveSchema.safeParse(archive).success).toBe(true);
    expect(seasonArchiveSchema.safeParse({ ...archive, unexpected: true }).success).toBe(false);
  });

  it("requires submitted ballots to contain 25 unique teams from the archive", () => {
    const submitted = {
      userId: "voter-1", displayName: "Voter", status: "submitted", submittedAt: "2026-09-01T00:00:00Z",
      entries: Array.from({ length: 25 }, (_, index) => ({ teamId: index + 1, rank: index + 1 })),
    };
    const manyTeams = [...archive.teams, ...Array.from({ length: 23 }, (_, index) => ({ id: index + 3, name: `Team ${index + 3}`, shortName: `T${index + 3}`, abbreviation: `T${index + 3}`, logoUrl: null, color: null, conference: null, isFbs: true, isEligible: true }))];
    expect(seasonArchiveSchema.safeParse({ ...archive, teams: manyTeams, weeks: [{ ...archive.weeks[0], status: "closed", ballots: [submitted] }] }).success).toBe(true);
    expect(seasonArchiveSchema.safeParse({ ...archive, weeks: [{ ...archive.weeks[0], status: "closed", ballots: [{ ...submitted, entries: submitted.entries.slice(1) }] }] }).success).toBe(false);
    expect(seasonArchiveSchema.safeParse({ ...archive, weeks: [{ ...archive.weeks[0], ballots: [{ ...submitted, entries: [{ teamId: 1, rank: 1 }, ...submitted.entries.slice(1)] }] }] }).success).toBe(false);
  });
});
