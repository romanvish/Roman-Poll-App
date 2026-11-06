import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { AuthConfigurationError, getAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

const appUserSelect = {
  id: true,
  email: true,
  name: true,
  displayName: true,
  image: true,
  avatarPath: true,
  favoriteTeamId: true,
  role: true,
  status: true,
  bio: true,
  tagline: true,
  title: true,
  affiliation: true,
  location: true,
  specialties: true,
  links: true,
} satisfies Prisma.UserSelect;

export type AppUser = Prisma.UserGetPayload<{ select: typeof appUserSelect }>;

export async function getSignedInUser(): Promise<AppUser | null> {
  let session;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return null;
    throw error;
  }
  if (!session) return null;

  // Re-read approval and role from PostgreSQL on every protected request.
  const user = await getDatabase().user.findUnique({ where: { id: session.user.id }, select: appUserSelect });
  return user?.status === "disabled" ? null : user;
}

export async function requireSignedInUser(): Promise<AppUser> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireApprovedUser(): Promise<AppUser> {
  const user = await requireSignedInUser();
  if (user.status !== "approved") redirect("/waiting");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireApprovedUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
