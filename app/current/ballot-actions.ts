"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { validateBallotSelection, validateBallotWrite } from "@/lib/schemas/ballot";
import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";

export type BallotActionResult = { ok: boolean; message: string; submittedAt?: string };

async function persistBallot(weekId: string, inputTeamIds: unknown, submit: boolean): Promise<BallotActionResult> {
  const user = await getSignedInUser();
  if (!user || user.status !== "approved") return { ok: false, message: "An approved voter session is required." };
  const parsed = validateBallotSelection(inputTeamIds, submit);
  if (!parsed.success) return { ok: false, message: submit ? "Choose 25 different eligible teams before submitting." : "The draft contains invalid or duplicate teams." };
  const teamIds = parsed.teamIds;
  try {
    const submittedAt = await getDatabase().$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: user.id }, select: { status: true } });
      if (!currentUser || currentUser.status !== "approved") throw new Error("APPROVAL_REQUIRED");
      const week = await tx.week.findUnique({ where: { id: weekId }, select: { id: true, seasonId: true, status: true, opensAt: true, deadline: true } });
      const eligible = week ? await tx.seasonTeam.findMany({ where: { seasonId: week.seasonId, teamId: { in: teamIds }, isFbs: true, isEligible: true }, select: { teamId: true } }) : [];
      const writeTime = new Date();
      const validated = validateBallotWrite({ teamIds, eligibleTeamIds: eligible.map((entry) => entry.teamId), submit, week, now: writeTime });
      if (!validated.success && validated.reason === "week") throw new Error("WEEK_CLOSED");
      if (!validated.success && validated.reason === "eligibility") throw new Error("INELIGIBLE_TEAM");
      if (!validated.success) throw new Error("INVALID_SELECTION");
      const ballot = await tx.ballot.upsert({
        where: { userId_weekId: { userId: user.id, weekId } },
        create: { userId: user.id, weekId, status: submit ? "submitted" : "draft", submittedAt: submit ? writeTime : null, displayNameSnapshot: submit ? user.displayName ?? user.name : null },
        update: submit ? { status: "submitted", submittedAt: writeTime, displayNameSnapshot: user.displayName ?? user.name } : {},
        select: { id: true, submittedAt: true },
      });
      await tx.ballotEntry.deleteMany({ where: { ballotId: ballot.id } });
      if (teamIds.length) await tx.ballotEntry.createMany({ data: teamIds.map((teamId, index) => ({ ballotId: ballot.id, teamId, rank: index + 1 })) });
      return submit ? writeTime.toISOString() : ballot.submittedAt?.toISOString();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/current");
    return { ok: true, message: submit ? "Ballot submitted." : "Draft saved.", submittedAt };
  } catch (error) {
    if (error instanceof Error && error.message === "APPROVAL_REQUIRED") return { ok: false, message: "Your account must be approved to vote." };
    if (error instanceof Error && error.message === "WEEK_CLOSED") return { ok: false, message: "This week is closed or its deadline has passed." };
    if (error instanceof Error && error.message === "INELIGIBLE_TEAM") return { ok: false, message: "A selected team is not eligible for this season." };
    return { ok: false, message: "The ballot could not be saved. Refresh and try again." };
  }
}

export async function saveBallotDraft(weekId: string, teamIds: unknown) {
  return persistBallot(weekId, teamIds, false);
}

export async function submitBallot(weekId: string, teamIds: unknown) {
  return persistBallot(weekId, teamIds, true);
}
