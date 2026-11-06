"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncNow() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const result = await response.json() as { ok?: boolean; teams?: number; games?: number; error?: string };
      setMessage(response.ok ? `Updated ${result.teams} teams and ${result.games} games.` : result.error ?? "Sync failed.");
    } catch {
      setMessage("Sync failed. Try again later.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="sync-now"><Button type="button" disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync now"}</Button>{message && <p role="status">{message}</p>}</div>;
}
