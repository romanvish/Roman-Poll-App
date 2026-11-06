"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getDatabase } from "@/lib/server/db";
import { getSignedInUser } from "@/lib/server/authorization";
import { profileUpdateSchema } from "@/lib/schemas/profile";

export type ProfileActionState = { status: "idle" | "success" | "error"; message: string };

export async function saveProfile(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await getSignedInUser();
  if (!user || user.status !== "approved") return { status: "error", message: "Your session expired or your account is awaiting approval." };

  const parsed = profileUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: "Check each profile field and try again." };

  const db = getDatabase();
  const favoriteTeamId = parsed.data.favoriteTeamId;
  if (favoriteTeamId !== null) {
    const eligible = await db.seasonTeam.findFirst({
      where: { teamId: favoriteTeamId, isFbs: true, isEligible: true, season: { isCurrent: true } },
      select: { teamId: true },
    });
    if (!eligible) return { status: "error", message: "Select a team eligible for the current season." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      displayName: parsed.data.displayName,
      avatarPath: parsed.data.avatarPath,
      tagline: parsed.data.tagline || null,
      bio: parsed.data.bio,
      title: parsed.data.title || null,
      affiliation: parsed.data.affiliation || null,
      location: parsed.data.location || null,
      specialties: parsed.data.specialties,
      links: parsed.data.links,
      favoriteTeamId,
    },
  });
  updateTag("public-voters");
  updateTag(`public-voter-${user.id}`);
  revalidatePath("/profile");
  return { status: "success", message: "Profile saved." };
}
