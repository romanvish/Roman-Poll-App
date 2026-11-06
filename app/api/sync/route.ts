import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";
import { GameApiError, SyncConfigurationError, syncCurrentSeason } from "@/lib/server/sync";
import { recordAdminAction } from "@/lib/server/audit";
import { isValidCronBearer } from "@/lib/sync/authorization";

export const maxDuration = 60;

export async function POST(request: Request) {
  let actorId: string | null = null;
  const cronAuthorized = isValidCronBearer(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (!cronAuthorized) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const user = await getSignedInUser();
    if (!user || user.status !== "approved" || user.role !== "admin") {
      return Response.json({ error: "An admin session or valid sync token is required." }, { status: 401 });
    }
    actorId = user.id;
  }

  try {
    const result = await syncCurrentSeason(actorId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const userMessage = error instanceof SyncConfigurationError ? "Game sync is not configured." :
      error instanceof GameApiError ? "The game data provider did not complete the sync." :
      "The season sync failed.";
    try {
      const db = getDatabase();
      const season = await db.season.findFirst({ where: { isCurrent: true }, select: { id: true } });
      await db.$transaction(async (tx) => {
        await tx.syncLog.create({ data: { seasonId: season?.id, status: "error", error: userMessage } });
        if (actorId) await recordAdminAction(tx, {
          actorId, action: "sync.failed", targetType: "season", targetId: season?.id ?? "none",
          details: { error: userMessage },
        });
      });
    } catch {
      // Keep provider details and credentials out of the response and logs.
    }
    return Response.json({ error: userMessage }, { status: error instanceof SyncConfigurationError ? 503 : 502 });
  }
}
