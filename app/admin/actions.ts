"use server";

import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { isLastApprovedAdmin } from "@/lib/admin/access";
import { adminUserActionSchema } from "@/lib/schemas/admin";
import { getSignedInUser } from "@/lib/server/authorization";
import { recordAdminAction } from "@/lib/server/audit";
import { getDatabase } from "@/lib/server/db";

export type AdminActionState = { status: "idle" | "success" | "error"; message: string };

export async function manageUser(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await getSignedInUser();
  if (!actor || actor.status !== "approved" || actor.role !== "admin") {
    return { status: "error", message: "An approved admin session is required." };
  }

  const parsed = adminUserActionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: "The requested user change is invalid." };
  const { action, userId } = parsed.data;
  if (actor.id === userId && (action === "disable" || action === "demote")) {
    return { status: "error", message: "You cannot disable or demote your own account." };
  }

  const db = getDatabase();
  try {
    await db.$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true } });
      if (!currentActor || currentActor.role !== "admin" || currentActor.status !== "approved") throw new Error("ADMIN_REQUIRED");
      const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
      if (!target) throw new Error("USER_NOT_FOUND");

      if ((action === "disable" || action === "demote") && target.role === "admin" && target.status === "approved") {
        const activeAdmins = await tx.user.count({ where: { role: "admin", status: "approved" } });
        if (isLastApprovedAdmin(target.role, target.status, activeAdmins)) throw new Error("LAST_ADMIN");
      }

      const update = action === "approve" ? { status: "approved" as const }
        : action === "disable" ? { status: "disabled" as const }
        : action === "promote" ? { role: "admin" as const }
        : { role: "voter" as const };
      const updated = await tx.user.update({ where: { id: userId }, data: update, select: { role: true, status: true } });
      if (action === "disable") await tx.session.deleteMany({ where: { userId } });
      await recordAdminAction(tx, {
        actorId: actor.id,
        action: `user.${action}`,
        targetType: "user",
        targetId: userId,
        details: { before: { role: target.role, status: target.status }, after: { role: updated.role, status: updated.status } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") return { status: "error", message: "The last approved admin cannot be disabled or demoted." };
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return { status: "error", message: "That user no longer exists." };
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") return { status: "error", message: "Your admin access is no longer active." };
    return { status: "error", message: "The user change could not be saved. Refresh and try again." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  revalidatePath("/profile");
  updateTag("public-voters");
  updateTag(`public-voter-${userId}`);
  return { status: "success", message: "User access updated." };
}
