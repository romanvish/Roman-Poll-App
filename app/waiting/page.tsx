import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSignedInUser } from "@/lib/server/authorization";

export const instant = false;

export default async function WaitingPage() {
  await connection();
  const user = await requireSignedInUser();
  if (user.status === "approved") redirect("/");

  return <div className="page-shell auth-page"><Card><CardContent className="auth-card">
    <p className="eyebrow">Your account is set up</p>
    <h1>Waiting for approval.</h1>
    <p>An admin needs to approve <strong>{user.email}</strong> before you can submit a ballot. You can update your profile while you wait.</p>
    <div className="auth-card-actions"><a className="text-link" href="/profile">Edit your profile</a><SignOutButton /></div>
  </CardContent></Card></div>;
}
