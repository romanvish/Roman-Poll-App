import { z } from "zod";
import { editorialSchema, profileLinksSchema } from "@/lib/schemas/content";

const safePublicPath = z.string().trim().startsWith("/").refine((path) => !path.includes("..") && !path.includes("\\"), "Expected a local public asset path");

const legacyTeamSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  abbreviation: z.string().trim().min(1).max(20),
  logo: safePublicPath.nullable().optional(),
}).strict();

const legacyVoterSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).nullable().optional(),
  affiliation: z.string().trim().max(160).nullable().optional(),
  photo: safePublicPath.nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(100)).default([]),
  bio: z.array(z.string().trim().min(1).max(2000)).default([]),
  links: profileLinksSchema.default([]),
}).strict();

const legacyBallotEntrySchema = z.object({
  rank: z.number().int().min(1).max(25),
  team: z.string().trim().min(1).max(120),
}).strict();

const legacyBallotSchema = z.object({
  voterId: z.string().trim().min(1).max(100),
  ballot: z.array(legacyBallotEntrySchema).length(25),
}).strict().superRefine((ballot, context) => {
  if (new Set(ballot.ballot.map((entry) => entry.rank)).size !== 25) context.addIssue({ code: "custom", message: `${ballot.voterId} must use each rank from 1 to 25 exactly once` });
  if (new Set(ballot.ballot.map((entry) => entry.team.toLocaleLowerCase())).size !== 25) context.addIssue({ code: "custom", message: `${ballot.voterId} must rank 25 unique teams` });
});

const legacyWeekSchema = z.object({
  season: z.number().int().min(1900).max(2200),
  week: z.number().int().min(0).max(25),
  publishedAt: z.iso.date(),
  records: z.record(z.string(), z.string()),
  editorial: editorialSchema,
  voters: z.array(legacyBallotSchema).min(1),
}).strict().superRefine((week, context) => {
  if (new Set(week.voters.map((voter) => voter.voterId)).size !== week.voters.length) context.addIssue({ code: "custom", message: `Week ${week.week} contains duplicate voter ballots` });
});

export const legacyArchiveSchema = z.object({
  format: z.literal("roman-poll-legacy"),
  version: z.literal(1),
  season: z.number().int().min(1900).max(2200),
  teams: z.array(legacyTeamSchema).min(25),
  voters: z.array(legacyVoterSchema).min(1),
  weeks: z.array(legacyWeekSchema).length(8),
}).strict().superRefine((archive, context) => {
  const teamsById = new Set(archive.teams.map((team) => team.id));
  const teamsByName = new Set(archive.teams.map((team) => team.name.toLocaleLowerCase()));
  const voters = new Set(archive.voters.map((voter) => voter.id));
  if (teamsById.size !== archive.teams.length) context.addIssue({ code: "custom", message: "Team IDs must be unique" });
  if (teamsByName.size !== archive.teams.length) context.addIssue({ code: "custom", message: "Team names must be unique" });
  if (voters.size !== archive.voters.length) context.addIssue({ code: "custom", message: "Voter IDs must be unique" });
  if (archive.weeks.some((week, index) => week.week !== index)) context.addIssue({ code: "custom", message: "Weeks must contain exactly weeks 0 through 7 in order" });
  for (const week of archive.weeks) {
    if (week.season !== archive.season) context.addIssue({ code: "custom", message: `Week ${week.week} must match season ${archive.season}` });
    for (const voter of week.voters) {
      if (!voters.has(voter.voterId)) context.addIssue({ code: "custom", message: `Week ${week.week} references unknown voter ${voter.voterId}` });
      for (const entry of voter.ballot) {
        if (!teamsByName.has(entry.team.toLocaleLowerCase())) context.addIssue({ code: "custom", message: `Week ${week.week} references unknown team ${entry.team}` });
      }
    }
    for (const teamName of Object.keys(week.records)) {
      if (!teamsByName.has(teamName.toLocaleLowerCase())) context.addIssue({ code: "custom", message: `Week ${week.week} records an unknown team ${teamName}` });
    }
    const recordNames = new Set(Object.keys(week.records).map((name) => name.toLocaleLowerCase()));
    for (const teamName of week.voters.flatMap((voter) => voter.ballot.map((entry) => entry.team))) {
      if (!recordNames.has(teamName.toLocaleLowerCase())) context.addIssue({ code: "custom", message: `Week ${week.week} is missing a record for ${teamName}` });
    }
  }
});

export type LegacyArchive = z.infer<typeof legacyArchiveSchema>;
