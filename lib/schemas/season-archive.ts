import { z } from "zod";
import { editorialSchema } from "@/lib/schemas/content";

const optionalJson = z.unknown().nullable().optional();
const timestamp = z.string().datetime({ offset: true });

const archiveTeamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  shortName: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1),
  logoUrl: z.string().nullable(),
  color: z.string().nullable(),
  conference: z.string().nullable(),
  isFbs: z.boolean(),
  isEligible: z.boolean(),
}).strict();

const archiveSnapshotSchema = z.object({
  teamId: z.number().int().positive(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  confWins: z.number().int().nonnegative(),
  confLosses: z.number().int().nonnegative(),
  lastResult: optionalJson,
  nextOpponent: optionalJson,
  extraJson: optionalJson,
}).strict();

const archiveResultSchema = z.object({
  teamId: z.number().int().positive(),
  rank: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  firstPlaceVotes: z.number().int().nonnegative(),
  previousRank: z.number().int().positive().nullable(),
}).strict();

const archiveBallotSchema = z.object({
  userId: z.string().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
  status: z.enum(["draft", "submitted"]),
  submittedAt: timestamp.nullable(),
  entries: z.array(z.object({ teamId: z.number().int().positive(), rank: z.number().int().min(1).max(25) }).strict()).max(25),
}).strict().superRefine((ballot, context) => {
  if (new Set(ballot.entries.map((entry) => entry.teamId)).size !== ballot.entries.length) context.addIssue({ code: "custom", message: "Ballot entries must use unique teams" });
  if (new Set(ballot.entries.map((entry) => entry.rank)).size !== ballot.entries.length) context.addIssue({ code: "custom", message: "Ballot entries must use unique ranks" });
  if (ballot.status === "submitted" && ballot.entries.length !== 25) context.addIssue({ code: "custom", message: "Submitted ballots must contain 25 teams" });
});

const archiveWeekSchema = z.object({
  number: z.number().int().min(0).max(25),
  label: z.string().trim().min(1).max(40),
  status: z.enum(["draft", "open", "closed", "published"]),
  opensAt: timestamp.nullable(),
  deadline: timestamp,
  publishedAt: timestamp.nullable(),
  editorial: editorialSchema.nullable(),
  snapshots: z.array(archiveSnapshotSchema),
  results: z.array(archiveResultSchema),
  ballots: z.array(archiveBallotSchema),
}).strict().superRefine((week, context) => {
  if (week.status === "published" && week.publishedAt === null) context.addIssue({ code: "custom", message: "Published weeks need a publication time" });
  if (new Set(week.snapshots.map((entry) => entry.teamId)).size !== week.snapshots.length) context.addIssue({ code: "custom", message: "Week snapshots must use unique teams" });
  if (new Set(week.results.map((entry) => entry.teamId)).size !== week.results.length) context.addIssue({ code: "custom", message: "Week results must use unique teams" });
  if (new Set(week.ballots.map((entry) => entry.userId)).size !== week.ballots.length) context.addIssue({ code: "custom", message: "A week may contain one ballot per voter" });
});

export const seasonArchiveSchema = z.object({
  format: z.literal("roman-poll-season"),
  version: z.literal(1),
  season: z.object({ year: z.number().int().min(1900).max(2200), isCurrent: z.boolean() }).strict(),
  teams: z.array(archiveTeamSchema),
  weeks: z.array(archiveWeekSchema),
}).strict().superRefine((archive, context) => {
  const teamIds = new Set(archive.teams.map((team) => team.id));
  if (teamIds.size !== archive.teams.length) context.addIssue({ code: "custom", message: "Season teams must be unique" });
  if (archive.teams.some((team) => team.isEligible && !team.isFbs)) context.addIssue({ code: "custom", message: "Only FBS teams can be eligible" });
  if (new Set(archive.weeks.map((week) => week.number)).size !== archive.weeks.length) context.addIssue({ code: "custom", message: "Season week numbers must be unique" });
  for (const week of archive.weeks) {
    for (const teamId of [...week.snapshots.map((entry) => entry.teamId), ...week.results.map((entry) => entry.teamId), ...week.ballots.flatMap((ballot) => ballot.entries.map((entry) => entry.teamId))]) {
      if (!teamIds.has(teamId)) context.addIssue({ code: "custom", message: `Week ${week.number} references a team outside the season` });
    }
  }
});

export type SeasonArchive = z.infer<typeof seasonArchiveSchema>;
