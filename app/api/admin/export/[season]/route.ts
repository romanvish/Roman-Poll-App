import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";
import { buildSeasonArchive } from "@/lib/server/season-archive";
import { recordAdminAction } from "@/lib/server/audit";
import { z } from "zod";

type Context = { params: Promise<{ season: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await getSignedInUser();
  if (!actor || actor.status !== "approved" || actor.role !== "admin") return Response.json({ error: "An approved admin session is required." }, { status: 401 });
  const params = z.coerce.number().int().min(1900).max(2200).safeParse((await context.params).season);
  if (!params.success) return Response.json({ error: "Season not found." }, { status: 404 });
  try {
    const archive = await buildSeasonArchive(params.data);
    if (!archive) return Response.json({ error: "Season not found." }, { status: 404 });
    await getDatabase().$transaction(async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { status: true, role: true } });
      if (!currentActor || currentActor.status !== "approved" || currentActor.role !== "admin") throw new Error("ADMIN_REQUIRED");
      await recordAdminAction(tx, { actorId: actor.id, action: "season.export", targetType: "season", targetId: String(archive.season.year), details: { teams: archive.teams.length, weeks: archive.weeks.length } });
    });
    return new Response(JSON.stringify(archive, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="roman-poll-season-${archive.season.year}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "The season could not be exported." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
