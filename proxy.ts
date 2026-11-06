import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// This is an optimistic page redirect only; each page, action, and route must
// still validate the current session, user status, and role on the server.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/profile/:path*", "/waiting/:path*", "/current/:path*", "/vote/:path*", "/admin/:path*"],
};
