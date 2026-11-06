"use client";

import { useState } from "react";
import { seasonArchiveSchema, type SeasonArchive } from "@/lib/schemas/season-archive";
import { legacyArchiveSchema, type LegacyArchive } from "@/lib/schemas/legacy-archive";
import { Button } from "@/components/ui/button";

type ImportReply = { ok?: boolean; mode?: string; summary?: Record<string, unknown>; issues?: string[]; error?: string };

export function SeasonImportForm() {
  const [archive, setArchive] = useState<SeasonArchive | LegacyArchive | null>(null);
  const [archiveKind, setArchiveKind] = useState<"season" | "legacy">("season");
  const [fileName, setFileName] = useState("");
  const [reply, setReply] = useState<ImportReply | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(file?: File) {
    setArchive(null);
    setReply(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) { setReply({ error: "Import files must be 5 MB or smaller." }); return; }
    try {
      const parsedJson: unknown = JSON.parse(await file.text());
      const parsed = archiveKind === "legacy" ? legacyArchiveSchema.safeParse(parsedJson) : seasonArchiveSchema.safeParse(parsedJson);
      if (!parsed.success) { setReply({ error: `Archive validation failed (${parsed.error.issues.length} issue(s)).` }); return; }
      setArchive(parsed.data);
    } catch {
      setReply({ error: "Choose a valid JSON season archive." });
    }
  }

  async function send(mode: "dryRun" | "commit") {
    if (!archive) return;
    setBusy(true);
    setReply(null);
    try {
      const payload = archiveKind === "legacy" ? { mode: "legacy", action: mode, archive } : { mode, archive };
      const response = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as ImportReply;
      setReply(body);
    } catch {
      setReply({ error: "The import request failed." });
    } finally { setBusy(false); }
  }

  return <div className="season-import-form">
    <label>Archive type<select value={archiveKind} onChange={(event) => { setArchiveKind(event.target.value as "season" | "legacy"); setArchive(null); setReply(null); setFileName(""); }}><option value="season">Roman Poll season archive</option><option value="legacy">Legacy static-site bundle</option></select></label>
    <label>{archiveKind === "legacy" ? "Legacy archive bundle JSON" : "Season archive JSON"}<input type="file" accept="application/json,.json" onChange={(event) => chooseFile(event.target.files?.[0])} /></label>
    {fileName && <p className="field-hint">Selected: {fileName}</p>}
    <div className="import-buttons"><Button type="button" variant="outline" disabled={!archive || busy} onClick={() => send("dryRun")}>{busy ? "Checking…" : "Validate and preview"}</Button><Button type="button" disabled={!archive || !reply?.ok || reply.mode !== "dryRun" || busy} onClick={() => send("commit")}>Import season</Button></div>
    {reply?.summary && <dl className="import-summary">{Object.entries(reply.summary).map(([key, value]) => <div key={key}><dt>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</dt><dd>{String(value)}</dd></div>)}</dl>}
    {reply?.issues?.map((issue) => <p className="form-message form-message-error" key={issue} role="alert">{issue}</p>)}
    {reply?.error && <p className="form-message form-message-error" role="alert">{reply.error}</p>}
    {reply?.ok && reply.mode === "commit" && <p className="form-message form-message-success" role="status">Season import completed.</p>}
  </div>;
}
