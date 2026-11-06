"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { teamEligibilitySchema } from "@/lib/schemas/teams";
import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";
import { recordAdminAction } from "@/lib/server/audit";

export type TeamActionState = { status: "idle" | "success" | "error"; message: string };

export async function setTeamEligibility(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const actor = await getSignedInUser();
  if (!actor || actor.status !== "approved" || actor.role !== "admin") return { status: "error", message: "An approved admin session is required." };
  const input = teamEligibilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { status: "error", message: "The team eligibility update is invalid." };

  try {
    await getDatabase().$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true } });
      if (!currentActor || currentActor.role !== "admin" || currentActor.status !== "approved") throw new Error("ADMIN_REQUIRED");
      const existing = await tx.seasonTeam.findUnique({ where: { seasonId_teamId: { seasonId: input.data.seasonId, teamId: input.data.teamId } } });
      if (!existing) throw new Error("TEAM_NOT_FOUND");
      await tx.seasonTeam.update({ where: { seasonId_teamId: { seasonId: input.data.seasonId, teamId: input.data.teamId } }, data: { isEligible: input.data.isEligible } });
      await recordAdminAction(tx, {
        actorId: actor.id, action: "team.eligibility", targetType: "season_team", targetId: `${input.data.seasonId}:${input.data.teamId}`,
        details: { before: existing.isEligible, after: input.data.isEligible },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.message === "TEAM_NOT_FOUND" ? "That team is not in the current season." : "The eligibility change could not be saved." };
  }
  revalidatePath("/admin/teams");
  revalidatePath("/profile");
  revalidatePath("/current");
  return { status: "success", message: "Eligibility updated." };
}
