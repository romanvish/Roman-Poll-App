import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { getSignedInUser } from "@/lib/server/authorization";

export const instant = false;

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  await connection();
  const [params, user] = await Promise.all([searchParams, getSignedInUser()]);
  if (user) redirect(user.status === "approved" ? "/" : "/waiting");

  const nextPath = params.next ?? "/";
  return <div className="page-shell auth-page">
    <Card><CardContent className="auth-card">
      <p className="eyebrow">A poll among friends</p>
      <h1>Welcome to the Roman Poll.</h1>
      <p>Sign in with Google to join the conversation. New accounts wait for an admin to approve them before voting.</p>
      {params.error === "auth" && <p role="alert" className="form-message form-message-error">Sign-in did not complete. Please try again.</p>}
      <SignInButton nextPath={nextPath} />
      <Link href="/" className="text-link">Back to the public poll</Link>
    </CardContent></Card>
  </div>;
}
