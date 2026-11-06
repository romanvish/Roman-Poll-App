import { describe, expect, it } from "vitest";
import { resolveInitialAccess } from "../../lib/auth/bootstrap";
import { isLastApprovedAdmin } from "../../lib/admin/access";
import { isValidCronBearer } from "../../lib/sync/authorization";
import { buildTeamSnapshots } from "../../lib/sync/snapshot";
import { gameApiGameListSchema } from "../../lib/schemas/game-api";
import { validateBallotSelection, validateBallotWrite } from "../../lib/schemas/ballot";
import { authEnvironmentSchema, databaseEnvironmentSchema } from "../../lib/schemas/environment";
import { profileUpdateSchema } from "../../lib/schemas/profile";

describe("initial account access", () => {
  it("approves configured admins case-insensitively", () => {
    expect(resolveInitialAccess(" Owner@Example.com ", "owner@example.com, other@example.com")).toEqual({ role: "admin", status: "approved" });
  });

  it("starts other accounts pending as voters", () => {
    expect(resolveInitialAccess("friend@example.com", "owner@example.com")).toEqual({ role: "voter", status: "pending" });
  });
});

describe("last admin protection", () => {
  it("blocks disabling or demoting the only approved admin", () => {
    expect(isLastApprovedAdmin("admin", "approved", 1)).toBe(true);
  });

  it("allows changes when another approved admin remains", () => {
    expect(isLastApprovedAdmin("admin", "approved", 2)).toBe(false);
    expect(isLastApprovedAdmin("voter", "approved", 1)).toBe(false);
    expect(isLastApprovedAdmin("admin", "disabled", 1)).toBe(false);
  });
});

describe("sync access and snapshots", () => {
  it("compares cron bearer tokens and rejects missing or short secrets", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    expect(isValidCronBearer(`Bearer ${secret}`, secret)).toBe(true);
    expect(isValidCronBearer("Bearer wrong", secret)).toBe(false);
    expect(isValidCronBearer(`Bearer ${secret}`, undefined)).toBe(false);
    expect(isValidCronBearer("Bearer short", "short")).toBe(false);
  });

  it("validates provider games and derives records, conference records, and next game", () => {
    const games = gameApiGameListSchema.parse([
      { id: 1, season: 2026, week: 1, startDate: "2026-08-30T18:00:00Z", homeId: 100, homeTeam: "Alpha", homeConference: "North", homeClassification: "fbs", homePoints: 24, awayId: 200, awayTeam: "Beta", awayConference: "North", awayClassification: "fbs", awayPoints: 10, status: "completed" },
      { id: 2, season: 2026, week: 2, startDate: "2026-09-06T18:00:00Z", homeId: 300, homeTeam: "Gamma", homeConference: "South", homeClassification: "fbs", homePoints: null, awayId: 100, awayTeam: "Alpha", awayConference: "North", awayClassification: "fbs", awayPoints: null, status: "scheduled" },
    ]);
    const snapshots = buildTeamSnapshots([100], games, new Date("2026-09-01T00:00:00Z"));
    expect(snapshots[0]).toMatchObject({ wins: 1, losses: 0, confWins: 1, confLosses: 0, lastResult: { opponent: "Beta", result: "W", score: "24-10" }, nextOpponent: { opponent: "Gamma", isHome: false } });
    expect(gameApiGameListSchema.safeParse([{ ...games[0], homeId: games[0].awayId }]).success).toBe(false);
  });
});

describe("ballot selection validation", () => {
  const top25 = Array.from({ length: 25 }, (_, index) => index + 1);

  it("accepts exactly 25 unique team IDs for submission", () => {
    expect(validateBallotSelection(top25, true)).toEqual({ success: true, teamIds: top25 });
  });

  it("allows incomplete drafts but rejects duplicates and malformed submissions", () => {
    expect(validateBallotSelection([2, 7], false).success).toBe(true);
    expect(validateBallotSelection([], false).success).toBe(true);
    expect(validateBallotSelection([2, 2], false).success).toBe(false);
    expect(validateBallotSelection(top25.slice(0, 24), true).success).toBe(false);
    expect(validateBallotSelection([...top25, 26], true).success).toBe(false);
    expect(validateBallotSelection([0, ...top25.slice(1)], true).success).toBe(false);
  });

  it("requires an open, unexpired week and 25 eligible teams for submission", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const openWeek = { status: "open", opensAt: new Date("2026-10-01T00:00:00Z"), deadline: new Date("2026-10-02T00:00:00Z") };
    expect(validateBallotWrite({ teamIds: top25, eligibleTeamIds: top25, submit: true, week: openWeek, now }).success).toBe(true);
    expect(validateBallotWrite({ teamIds: top25, eligibleTeamIds: top25.slice(1), submit: true, week: openWeek, now })).toMatchObject({ success: false, reason: "eligibility" });
    expect(validateBallotWrite({ teamIds: top25, eligibleTeamIds: top25, submit: true, week: { ...openWeek, status: "closed" }, now })).toMatchObject({ success: false, reason: "week" });
    expect(validateBallotWrite({ teamIds: top25, eligibleTeamIds: top25, submit: true, week: { ...openWeek, deadline: now }, now })).toMatchObject({ success: false, reason: "week" });
  });
});

describe("environment validation", () => {
  it("requires PostgreSQL URLs for database use", () => {
    expect(databaseEnvironmentSchema.safeParse({ DATABASE_URL: "postgresql://user:pass@localhost:5432/poll" }).success).toBe(true);
    expect(databaseEnvironmentSchema.safeParse({ DATABASE_URL: "https://example.test" }).success).toBe(false);
  });

  it("validates auth configuration without exposing supplied secrets in errors", () => {
    const secret = "not-a-valid-secret-value";
    const result = authEnvironmentSchema.safeParse({
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "not an origin",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "secret-client-value",
      ADMIN_EMAILS: "bad-email",
    });
    if (result.success) throw new Error("Invalid auth environment unexpectedly parsed");
    expect(JSON.stringify(result.error.issues)).not.toContain(secret);
    expect(JSON.stringify(result.error.issues)).not.toContain("secret-client-value");
  });
});

describe("profile update validation", () => {
  const validProfile = {
    displayName: "A. Voter",
    avatarPath: "",
    tagline: "Saturday tradition",
    bio: "First paragraph\n\nSecond paragraph",
    title: "Engineer",
    affiliation: "Independent",
    location: "Denver",
    specialties: "Big Ten\nDefense",
    links: "Film notes | https://example.com/notes",
    favoriteTeamId: "194",
  };

  it("normalizes paragraphs, specialties, and team ID", () => {
    expect(profileUpdateSchema.parse(validProfile)).toMatchObject({
      bio: ["First paragraph", "Second paragraph"],
      specialties: ["Big Ten", "Defense"],
      favoriteTeamId: 194,
      avatarPath: null,
      links: [{ label: "Film notes", url: "https://example.com/notes" }],
    });
  });

  it("rejects invalid team IDs and unexpected fields", () => {
    expect(profileUpdateSchema.safeParse({ ...validProfile, favoriteTeamId: "0" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...validProfile, role: "admin" }).success).toBe(false);
  });
});
