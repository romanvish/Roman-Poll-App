"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { publishWeek, transitionWeek, type WeekActionState } from "@/app/admin/weeks/actions";

const initialState: WeekActionState = { status: "idle", message: "" };

export function WeekControls({ weekId, status, canReopen }: { weekId: string; status: string; canReopen: boolean }) {
  const [state, formAction, pending] = useActionState(transitionWeek, initialState);
  const [publishState, publishAction, publishing] = useActionState(publishWeek, initialState);
  const action = status === "draft" ? "open" : status === "open" ? "close" : status === "published" ? "unpublish" : null;
  return <div className="week-controls">
    {action && <form action={formAction}>
      <input type="hidden" name="weekId" value={weekId} /><input type="hidden" name="action" value={action} />
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Updating…" : action === "open" ? "Open" : action === "close" ? "Close" : "Unpublish"}</Button>
    </form>}
    {status === "closed" && <div className="week-transition-buttons">
      {canReopen && <form action={formAction}><input type="hidden" name="weekId" value={weekId} /><input type="hidden" name="action" value="reopen" /><Button type="submit" variant="outline" disabled={pending}>Reopen</Button></form>}
      <form action={publishAction}><input type="hidden" name="weekId" value={weekId} /><Button type="submit" disabled={publishing}>Publish</Button></form>
    </div>}
    {status !== "closed" && !action && <span className="week-status-label">{status}</span>}
    {[state, publishState].filter((value) => value.message).map((value) => <span key={value.message} className={value.status === "error" ? "form-message-error" : "form-message-success"} role={value.status === "error" ? "alert" : "status"}>{value.message}</span>)}
  </div>;
}
