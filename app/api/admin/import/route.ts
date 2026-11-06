import { revalidatePath, revalidateTag } from "next/cache";
import { getSignedInUser } from "@/lib/server/authorization";
import { getDatabase } from "@/lib/server/db";
import { recordAdminAction } from "@/lib/server/audit";
import { seasonArchiveSchema } from "@/lib/schemas/season-archive";
import { seasonImportRequestSchema } from "@/lib/schemas/season-import";
import { legacyArchiveSchema } from "@/lib/schemas/legacy-archive";
import { checkArchiveImport, importSeasonArchive } from "@/lib/server/season-archive";
import { checkLegacyArchiveImport, importLegacyArchive } from "@/lib/server/legacy-archive";

const maxImportBytes = 5 * 1024 * 1024;
export const maxDuration = 60;

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > maxImportBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

export async function POST(request: Request) {
  const actor = await getSignedInUser();
  if (!actor || actor.status !== "approved" || actor.role !== "admin") return Response.json({ error: "An approved admin session is required." }, { status: 401 });
  if (!request.headers.get("origin") || request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Send a JSON archive." }, { status: 415 });
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxImportBytes) return Response.json({ error: "Import files must be 5 MB or smaller." }, { status: 413 });
  const raw = await readLimitedBody(request);
  if (raw === null) return Response.json({ error: "Import files must be 5 MB or smaller." }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); }
  catch { return Response.json({ error: "The file is not valid JSON." }, { status: 400 }); }
  const requestInput = seasonImportRequestSchema.safeParse(json);
  if (!requestInput.success) return Response.json({ error: "Choose a dry run or commit for a season archive." }, { status: 400 });
  if (requestInput.data.mode === "legacy") {
    const archive = legacyArchiveSchema.safeParse(requestInput.data.archive);
    if (!archive.success) {
      await getDatabase().$transaction(async (tx) => {
        const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { status: true, role: true } });
        if (!admin || admin.status !== "approved" || admin.role !== "admin") throw new Error("ADMIN_REQUIRED");
        await recordAdminAction(tx, { actorId: actor.id, action: "season.legacy_import.invalid", targetType: "legacy_season", targetId: "unknown", details: { issueCount: archive.error.issues.length } });
      });
      return Response.json({ error: "The legacy archive failed validation.", issueCount: archive.error.issues.length, issues: archive.error.issues.slice(0, 30).map((issue) => issue.message) }, { status: 400 });
    }
    if (requestInput.data.action === "dryRun") {
      const result = await getDatabase().$transaction(async (tx) => {
        const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { status: true, role: true } });
        if (!admin || admin.status !== "approved" || admin.role !== "admin") throw new Error("ADMIN_REQUIRED");
        const check = await checkLegacyArchiveImport(tx, archive.data);
        await recordAdminAction(tx, { actorId: actor.id, action: "season.legacy_import.dry_run", targetType: "legacy_season", targetId: String(archive.data.season), details: { valid: check.valid, summary: check.summary, issueCount: check.issues.length } });
        return check;
      });
      return Response.json({ ok: result.valid, mode: "dryRun", summary: result.summary, issues: result.issues }, { status: result.valid ? 200 : 409, headers: { "Cache-Control": "no-store" } });
    }
    try {
      const summary = await getDatabase().$transaction(async (tx) => {
        const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { status: true, role: true } });
        if (!admin || admin.status !== "approved" || admin.role !== "admin") throw new Error("ADMIN_REQUIRED");
        return importLegacyArchive(tx, actor.id, archive.data);
      });
      for (const week of archive.data.weeks) revalidateTag(`published-week-${archive.data.season}-${week.week}`, "max");
      revalidateTag(`published-season-${archive.data.season}`, "max");
      revalidateTag("published-latest", "max");
      revalidateTag("published-polls-list", "max");
      revalidateTag("public-voters", "max");
      revalidateTag("legacy-teams", "max");
      revalidatePath("/");
      revalidatePath("/polls");
      revalidatePath("/about");
      revalidatePath("/teams");
      return Response.json({ ok: true, mode: "commit", summary }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error && error.message === "ADMIN_REQUIRED" ? "An approved admin session is required." : "The legacy archive could not be imported.";
      return Response.json({ error: message }, { status: error instanceof Error && error.message === "ADMIN_REQUIRED" ? 401 : 500, headers: { "Cache-Control": "no-store" } });
    }
  }
  const archive = seasonArchiveSchema.safeParse(requestInput.data.archive);
  if (!archive.success) return Response.json({ error: "The season archive failed validation.", issueCount: archive.error.issues.length, issues: archive.error.issues.slice(0, 20).map((issue) => issue.message) }, { status: 400 });

  if (requestInput.data.mode === "dryRun") {
    const result = await getDatabase().$transaction(async (tx) => {
      const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { status: true, role: true } });
      if (!admin || admin.status !== "approved" || admin.role !== "admin") throw new Error("ADMIN_REQUIRED");
      const check = await checkArchiveImport(tx, archive.data);
      await recordAdminAction(tx, {
        actorId: actor.id, action: "season.import.dry_run", targetType: "season", targetId: String(archive.data.season.year),
        details: { valid: check.valid, summary: check.summary, issueCount: check.issues.length },
      });
      return check;
    });
    return Response.json({ ok: result.valid, mode: "dryRun", summary: result.summary, issues: result.issues }, { status: result.valid ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await importSeasonArchive(actor.id, archive.data);
    for (const week of archive.data.weeks.filter((entry) => entry.status === "published")) {
      revalidateTag(`published-week-${archive.data.season.year}-${week.number}`, "max");
    }
    revalidateTag(`published-season-${archive.data.season.year}`, "max");
    revalidateTag("published-latest", "max");
    revalidateTag("published-polls-list", "max");
    revalidatePath("/");
    revalidatePath("/polls");
    return Response.json({ ok: true, mode: "commit", summary: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message === "IMPORT_CONFLICT" ? "The dry run found database conflicts. Review the new dry-run summary." : "The season archive could not be imported.";
    return Response.json({ error: message }, { status: error instanceof Error && error.message === "IMPORT_CONFLICT" ? 409 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
