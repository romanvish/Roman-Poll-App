"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { manageUser, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };

export function UserAccessControls({ user }: { user: { id: string; role: "admin" | "voter"; status: "pending" | "approved" | "disabled" } }) {
  const [state, formAction, pending] = useActionState(manageUser, initialState);
  return <div className="user-access-controls">
    <form action={formAction}>
      <input type="hidden" name="userId" value={user.id} />
      <div className="user-action-buttons">
        {(user.status !== "approved") && <Button name="action" value="approve" disabled={pending}>Approve</Button>}
        {(user.status !== "disabled") && <Button name="action" value="disable" variant="outline" disabled={pending}>Disable</Button>}
        {user.role !== "admin" && <Button name="action" value="promote" variant="outline" disabled={pending}>Make admin</Button>}
        {user.role === "admin" && <Button name="action" value="demote" variant="outline" disabled={pending}>Make voter</Button>}
      </div>
    </form>
    {state.message && <p className={`form-message ${state.status === "error" ? "form-message-error" : "form-message-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </div>;
}
