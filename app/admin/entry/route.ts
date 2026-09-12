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
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const identity = verifyEntryToken(token);
  if (!identity) {
    return NextResponse.redirect(new URL("/admin/denied", req.url));
  }

  const to = req.nextUrl.searchParams.get("to");
  // Only ever our own back-office: an attacker-supplied absolute URL here would
  // make this an open redirect wearing a trusted domain.
  const dest = to && /^\/admin(\/|$)/.test(to) ? to : "/admin";

  const res = NextResponse.redirect(new URL(dest, req.url));
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
