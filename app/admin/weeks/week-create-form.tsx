"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createWeek, type WeekActionState } from "@/app/admin/weeks/actions";

const initialState: WeekActionState = { status: "idle", message: "" };

export function WeekCreateForm() {
  const [state, formAction, pending] = useActionState(createWeek, initialState);
  const localDeadline = useRef<HTMLInputElement>(null);
  const utcDeadline = useRef<HTMLInputElement>(null);
  return <form action={formAction} className="week-create-form" onSubmit={(event) => {
    if (!localDeadline.current?.value || !utcDeadline.current) { event.preventDefault(); return; }
    const value = new Date(localDeadline.current.value);
    if (!Number.isFinite(value.getTime())) { event.preventDefault(); return; }
    utcDeadline.current.value = value.toISOString();
  }}>
    <label>Week number<input name="number" type="number" min="0" max="25" required /></label>
    <label>Week label<input name="label" maxLength={40} placeholder="Week 1, Preseason, Final" required /></label>
    <label>Deadline (your local time)<input ref={localDeadline} type="datetime-local" required /></label>
    <input ref={utcDeadline} type="hidden" name="deadline" />
    <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create draft week"}</Button>
    {state.message && <p className={`form-message ${state.status === "error" ? "form-message-error" : "form-message-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </form>;
}
