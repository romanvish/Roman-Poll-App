"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { updateTag } from "next/cache";
import { aggregatePoll } from "@/lib/poll/aggregate";
import { submittedBallotSchema } from "@/lib/schemas/ballot";
import { createWeekSchema, weekTransitionSchema } from "@/lib/schemas/ballot";
import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";
import { recordAdminAction } from "@/lib/server/audit";

export type WeekActionState = { status: "idle" | "success" | "error"; message: string };

async function getActor() {
  const actor = await getSignedInUser();
  if (!actor || actor.status !== "approved" || actor.role !== "admin") return null;
  return actor;
}

export async function createWeek(_previous: WeekActionState, formData: FormData): Promise<WeekActionState> {
  const actor = await getActor();
  if (!actor) return { status: "error", message: "An approved admin session is required." };
  const input = createWeekSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!input.success || new Date(input.data.deadline) <= new Date()) return { status: "error", message: "Enter a valid week and a future deadline." };
  try {
    const week = await getDatabase().$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true } });
      if (!currentActor || currentActor.role !== "admin" || currentActor.status !== "approved") throw new Error("ADMIN_REQUIRED");
      const season = await tx.season.findFirst({ where: { isCurrent: true }, select: { id: true } });
      if (!season) throw new Error("SEASON_MISSING");
      const created = await tx.week.create({ data: { seasonId: season.id, number: input.data.number, label: input.data.label, deadline: new Date(input.data.deadline) } });
      await recordAdminAction(tx, { actorId: actor.id, action: "week.create", targetType: "week", targetId: created.id, details: { number: created.number, label: created.label, deadline: created.deadline.toISOString() } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/admin/weeks");
    revalidatePath("/current");
    return { status: "success", message: `Created ${week.label}.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.message === "SEASON_MISSING" ? "Create a current season first." : "That week number already exists or could not be created." };
  }
}

export async function transitionWeek(_previous: WeekActionState, formData: FormData): Promise<WeekActionState> {
  const actor = await getActor();
  if (!actor) return { status: "error", message: "An approved admin session is required." };
  const input = weekTransitionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { status: "error", message: "The week change is invalid." };
  const { weekId, action } = input.data;
  try {
    await getDatabase().$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true } });
      if (!currentActor || currentActor.role !== "admin" || currentActor.status !== "approved") throw new Error("ADMIN_REQUIRED");
      const week = await tx.week.findUnique({ where: { id: weekId } });
      if (!week) throw new Error("WEEK_MISSING");
      const now = new Date();
      if (action === "open" && (week.status !== "draft" || week.deadline <= now)) throw new Error("BAD_TRANSITION");
      if (action === "close" && week.status !== "open") throw new Error("BAD_TRANSITION");
      if (action === "reopen" && (week.status !== "closed" || week.deadline <= now)) throw new Error("BAD_TRANSITION");
      if (action === "unpublish" && week.status !== "published") throw new Error("BAD_TRANSITION");
      const updated = await tx.week.update({ where: { id: week.id }, data: action === "open" || action === "reopen"
        ? { status: "open", opensAt: now }
        : action === "close" ? { status: "closed" } : { status: "closed", publishedAt: null } });
      await recordAdminAction(tx, { actorId: actor.id, action: `week.${action}`, targetType: "week", targetId: week.id, details: { before: week.status, after: updated.status } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.message === "BAD_TRANSITION" ? "This week cannot make that status change." : "The week status could not be updated." };
  }
  revalidatePath("/admin/weeks");
  revalidatePath("/current");
  if (action === "unpublish") {
    const week = await getDatabase().week.findUnique({ where: { id: weekId }, select: { number: true, season: { select: { year: true } } } });
    if (week) {
      updateTag(`published-week-${week.season.year}-${week.number}`);
      updateTag(`published-season-${week.season.year}`);
      updateTag("published-latest");
      updateTag("published-polls-list");
      updateTag("public-voters");
      revalidatePath("/polls");
      revalidatePath(`/polls/${week.season.year}/${week.number}`);
      revalidatePath(`/ballots/${week.season.year}/week/${week.number}`);
      revalidatePath(`/compare/${week.season.year}/week/${week.number}`);
    }
  }
  return { status: "success", message: `Week ${action} completed.` };
}

export async function publishWeek(_previous: WeekActionState, formData: FormData): Promise<WeekActionState> {
  const actor = await getActor();
  if (!actor) return { status: "error", message: "An approved admin session is required." };
  const weekId = String(formData.get("weekId") ?? "");
  if (!weekId || weekId.length > 100) return { status: "error", message: "The week selection is invalid." };
  let published: { year: number; number: number };
  try {
    published = await getDatabase().$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true } });
      if (!currentActor || currentActor.role !== "admin" || currentActor.status !== "approved") throw new Error("ADMIN_REQUIRED");
      const week = await tx.week.findUnique({ where: { id: weekId }, include: { season: { select: { year: true } } } });
      if (!week || week.status !== "closed") throw new Error("WEEK_NOT_CLOSED");
      const ballots = await tx.ballot.findMany({ where: { weekId, status: "submitted" }, include: { entries: { include: { team: { select: { name: true } } }, orderBy: { rank: "asc" } } } });
      const teamIds = [...new Set(ballots.flatMap((ballot) => ballot.entries.map((entry) => entry.teamId)))];
      const eligible = await tx.seasonTeam.findMany({ where: { seasonId: week.seasonId, teamId: { in: teamIds }, isFbs: true, isEligible: true }, select: { teamId: true } });
      const eligibleIds = new Set(eligible.map((entry) => entry.teamId));
      for (const ballot of ballots) {
        const checked = submittedBallotSchema.safeParse(ballot.entries.map((entry) => entry.teamId));
        if (!checked.success || ballot.entries.some((entry) => !eligibleIds.has(entry.teamId))) throw new Error("INVALID_BALLOT");
      }
      const previousWeek = await tx.week.findFirst({ where: { seasonId: week.seasonId, number: { lt: week.number }, status: "published" }, orderBy: { number: "desc" }, include: { results: { select: { teamId: true, rank: true } } } });
      const previousRanks = new Map((previousWeek?.results ?? []).map((result) => [result.teamId, result.rank]));
      const rankings = aggregatePoll(ballots, previousRanks);
      await tx.weekResult.deleteMany({ where: { weekId } });
      if (rankings.length) await tx.weekResult.createMany({ data: rankings.map((team) => ({ weekId, teamId: team.teamId, rank: team.rank, points: team.points, firstPlaceVotes: team.firstPlaceVotes, previousRank: team.previousRank })) });
      await tx.week.update({ where: { id: weekId }, data: { status: "published", publishedAt: new Date() } });
      await recordAdminAction(tx, { actorId: actor.id, action: "week.publish", targetType: "week", targetId: weekId, details: { submittedBallots: ballots.length, rankedTeams: rankings.length } });
      return { year: week.season.year, number: week.number };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.message === "WEEK_NOT_CLOSED" ? "Only a closed week can be published." : error instanceof Error && error.message === "INVALID_BALLOT" ? "A submitted ballot is incomplete or contains an ineligible team." : "The poll could not be published." };
  }
  updateTag(`published-week-${published.year}-${published.number}`);
  updateTag(`published-season-${published.year}`);
  updateTag("published-latest");
  updateTag("published-polls-list");
  updateTag("public-voters");
  revalidatePath("/admin/weeks");
  revalidatePath("/current");
  revalidatePath("/");
  revalidatePath("/polls");
  revalidatePath(`/polls/${published.year}/${published.number}`);
  revalidatePath(`/ballots/${published.year}/week/${published.number}`);
  revalidatePath(`/compare/${published.year}/week/${published.number}`);
  return { status: "success", message: "Poll published." };
}
