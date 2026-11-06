import { describe, expect, it } from "vitest";
import { aggregateLegacyWeek } from "@/lib/legacy/aggregate";
import { legacyArchiveSchema, type LegacyArchive } from "@/lib/schemas/legacy-archive";

const teams = Array.from({ length: 25 }, (_, index) => ({ id: `team-${String(index + 1).padStart(2, "0")}`, name: `Team ${String(index + 1).padStart(2, "0")}`, abbreviation: `T${index + 1}`, logo: null }));

function ballot(voterId: string, swapTop = false) {
  const order = teams.map((team) => team.name);
  if (swapTop) [order[0], order[1]] = [order[1], order[0]];
  return { voterId, ballot: order.map((team, index) => ({ rank: index + 1, team })) };
}

function fixture(): LegacyArchive {
  return legacyArchiveSchema.parse({
    format: "roman-poll-legacy",
    version: 1,
    season: 2026,
    teams,
    voters: [{ id: "voter-a", name: "Voter A", specialties: [], bio: [], links: [] }, { id: "voter-b", name: "Voter B", specialties: [], bio: [], links: [] }],
    weeks: Array.from({ length: 8 }, (_, week) => ({
      season: 2026,
      week,
      publishedAt: `2026-10-${String(week + 1).padStart(2, "0")}`,
      records: Object.fromEntries(teams.map((team) => [team.name, "1-0"])),
      editorial: { headline: "Headline", dek: "Dek", analysis: [], highlights: [] },
      voters: [ballot("voter-a"), ballot("voter-b", true)],
    })),
  });
}

describe("legacy archive", () => {
  it("validates the complete eight-week bundle and rejects missing references", () => {
    const archive = fixture();
    expect(archive.weeks).toHaveLength(8);
    const invalid = structuredClone(archive);
    invalid.weeks[0].voters[0].ballot[0].team = "Unknown Team";
    expect(legacyArchiveSchema.safeParse(invalid).success).toBe(false);
  });

  it("preserves static-site aggregation: points, average-rank ties, firsts, consensus spread and sequential ranks", () => {
    const archive = fixture();
    const week = archive.weeks[0];
    const teamIds = new Map(archive.teams.map((team) => [team.name, team.id]));
    const ranks = aggregateLegacyWeek(week, teamIds);
    expect(ranks[0]).toMatchObject({ team: "Team 01", rank: 1, points: 49, firstPlaceVotes: 1, averageRank: 1.5, rankSpread: 1 });
    expect(ranks[1]).toMatchObject({ team: "Team 02", rank: 2, points: 49, firstPlaceVotes: 1, averageRank: 1.5 });
    expect(ranks[2].rank).toBe(3);
  });

  it("calculates historical movement only when a team was in the prior top 25", () => {
    const archive = fixture();
    const teamIds = new Map(archive.teams.map((team) => [team.name, team.id]));
    const ranks = aggregateLegacyWeek(archive.weeks[1], teamIds, new Map([[archive.teams[0].id, 4]]));
    expect(ranks.find((rank) => rank.teamId === archive.teams[0].id)?.previousRank).toBe(4);
    expect(ranks.find((rank) => rank.teamId === archive.teams[1].id)?.previousRank).toBeNull();
  });
});
