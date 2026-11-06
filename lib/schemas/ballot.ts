import { z } from "zod";

export const ballotSelectionSchema = z.array(z.number().int().positive()).max(25)
  .refine((teamIds) => new Set(teamIds).size === teamIds.length, "A team can only appear once.");

export const submittedBallotSchema = ballotSelectionSchema.length(25, "Choose exactly 25 teams to submit.");

export function validateBallotSelection(teamIds: unknown, submit: boolean) {
  const result = (submit ? submittedBallotSchema : ballotSelectionSchema).safeParse(teamIds);
  return result.success ? { success: true as const, teamIds: result.data } : { success: false as const, issues: result.error.issues };
}

export function validateBallotWrite(input: {
  teamIds: unknown;
  eligibleTeamIds: number[];
  submit: boolean;
  week: { status: string; opensAt: Date | null; deadline: Date } | null;
  now: Date;
}) {
  const selection = validateBallotSelection(input.teamIds, input.submit);
  if (!selection.success) return { success: false as const, reason: "selection" as const };
  if (!input.week || input.week.status !== "open" || input.week.deadline <= input.now || (input.week.opensAt && input.week.opensAt > input.now)) {
    return { success: false as const, reason: "week" as const };
  }
  const eligible = new Set(input.eligibleTeamIds);
  if (selection.teamIds.some((teamId) => !eligible.has(teamId))) return { success: false as const, reason: "eligibility" as const };
  return { success: true as const, teamIds: selection.teamIds };
}

export const createWeekSchema = z.object({
  number: z.coerce.number().int().min(0).max(25),
  label: z.string().trim().min(1).max(40),
  deadline: z.string().datetime({ offset: true }),
}).strict();

export const weekTransitionSchema = z.object({
  weekId: z.string().min(1).max(100),
  action: z.enum(["open", "close", "reopen", "unpublish"]),
}).strict();
