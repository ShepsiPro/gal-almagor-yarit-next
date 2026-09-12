import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, mintSessionCookie, verifyEntryToken } from "@/lib/admin-auth";

/**
 * The landing point for Mslahtk's "open back-office" click.
 *
 * The link carries a short-lived signed token; we verify it, swap it for a
 * session cookie and redirect to a clean URL. The redirect matters: an entry
 * token that stays in the address bar ends up in history, in a screenshot, in
 * a pasted chat message — and while it only lives 15 minutes, there is no
 * reason for it to outlive its single use.
 */
/**
 * The public origin, which is NOT what `req.url` says.
 *
 * Behind Railway's proxy the app binds 0.0.0.0:8080 and that is the authority
 * Next reports, so `new URL(path, req.url)` builds a redirect to
 * https://0.0.0.0:8080/… — an address the visitor's browser cannot reach. The
 * forwarded headers carry the host the customer actually typed.
 */
function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const token = req.nextUrl.searchParams.get("t");
  const identity = verifyEntryToken(token);
  if (!identity) {
    return NextResponse.redirect(new URL("/admin/denied", origin));
  }

  const to = req.nextUrl.searchParams.get("to");
  // Only ever our own back-office: an attacker-supplied absolute URL here would
  // make this an open redirect wearing a trusted domain.
  const dest = to && /^\/admin(\/|$)/.test(to) ? to : "/admin";

  const res = NextResponse.redirect(new URL(dest, origin));
  const { value, maxAge } = mintSessionCookie(identity);
  res.cookies.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge,
  });
  return res;
}
