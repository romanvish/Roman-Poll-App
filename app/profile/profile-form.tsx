"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { saveProfile, type ProfileActionState } from "@/app/profile/profile-actions";
import { avatarOptions } from "@/lib/profile/avatars";

type Props = {
  profile: { displayName: string | null; avatarPath: string | null; tagline: string | null; bio: string[]; title: string | null; affiliation: string | null; location: string | null; specialties: string[]; favoriteTeamId: number | null; links: Array<{ label: string; url: string }> };
  teams: Array<{ id: number; name: string; abbreviation: string; conference: string | null }>;
  editable: boolean;
};

const initialState: ProfileActionState = { status: "idle", message: "" };

export function ProfileForm({ profile, teams, editable }: Props) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  return <form action={formAction} className="profile-form">
    <label>Display name<input name="displayName" required minLength={1} maxLength={40} defaultValue={profile.displayName ?? ""} disabled={!editable} /></label>
    <label>Profile portrait<select name="avatarPath" defaultValue={profile.avatarPath ?? ""} disabled={!editable}><option value="">Use the default portrait</option>{avatarOptions.map((avatar) => <option key={avatar.path} value={avatar.path}>{avatar.label}</option>)}</select>{profile.avatarPath && <Image className="profile-avatar-preview" src={profile.avatarPath} alt="Selected profile portrait" width={64} height={64} />}</label>
    <label>Favorite team<select name="favoriteTeamId" defaultValue={profile.favoriteTeamId?.toString() ?? ""} disabled={!editable}>
      <option value="">No favorite team</option>
      {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.conference ? ` · ${team.conference}` : ""}</option>)}
    </select></label>
    <label>Tagline<input name="tagline" maxLength={120} defaultValue={profile.tagline ?? ""} disabled={!editable} /></label>
    <label>Title<input name="title" maxLength={80} defaultValue={profile.title ?? ""} disabled={!editable} /></label>
    <label>Affiliation<input name="affiliation" maxLength={120} defaultValue={profile.affiliation ?? ""} disabled={!editable} /></label>
    <label>Location<input name="location" maxLength={100} defaultValue={profile.location ?? ""} disabled={!editable} /></label>
    <label>Specialties<span className="field-hint">One per line.</span><textarea name="specialties" rows={3} maxLength={500} defaultValue={profile.specialties.join("\n")} disabled={!editable} /></label>
    <label>Links<span className="field-hint">One per line, in the format Label | https://example.com</span><textarea name="links" rows={4} maxLength={1500} defaultValue={profile.links.map((link) => `${link.label} | ${link.url}`).join("\n")} disabled={!editable} /></label>
    <label>Bio<span className="field-hint">Use a blank line to start another paragraph.</span><textarea name="bio" rows={6} maxLength={2000} defaultValue={profile.bio.join("\n\n")} disabled={!editable} /></label>
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className={`form-message ${state.status === "error" ? "form-message-error" : "form-message-success"}`}>{state.message}</p>}
    {editable && <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>}
  </form>;
}
