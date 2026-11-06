"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignInButton({ nextPath }: { nextPath: string }) {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const destination = safeInternalPath(nextPath);
    const result = await authClient.signIn.social({ provider: "google", callbackURL: destination });
    if (result.error) setError("Google sign-in could not start. Check the app's OAuth setup and try again.");
  }

  return <div className="sign-in-actions">
    <Button type="button" onClick={signIn} className="w-full justify-center">Continue with Google</Button>
    {error && <p role="alert" className="form-message form-message-error">{error}</p>}
  </div>;
}

function safeInternalPath(value: string): string {
  try {
    const destination = new URL(value, "https://romanpoll.invalid");
    if (destination.origin !== "https://romanpoll.invalid") return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
