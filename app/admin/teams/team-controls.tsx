"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setTeamEligibility, type TeamActionState } from "@/app/admin/teams/actions";

const initialState: TeamActionState = { status: "idle", message: "" };

export function TeamControls({ seasonId, teamId, eligible }: { seasonId: string; teamId: number; eligible: boolean }) {
  const [state, formAction, pending] = useActionState(setTeamEligibility, initialState);
  return <form action={formAction} className="team-eligibility-form">
    <input type="hidden" name="seasonId" value={seasonId} />
    <input type="hidden" name="teamId" value={teamId} />
    <input type="hidden" name="isEligible" value={String(!eligible)} />
    <Button type="submit" variant="outline" disabled={pending}>{eligible ? "Make ineligible" : "Make eligible"}</Button>
    {state.message && <span className={state.status === "error" ? "form-message-error" : "form-message-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</span>}
  </form>;
}
