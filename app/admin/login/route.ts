import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, connectionSecret, readSession } from "@/lib/admin-auth";
import { enterThroughMslahtkUrl } from "@/lib/mslahtk";
import { publicOrigin } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The staff entry. The back-office has no password of its own: its door opens
 * with a short-lived token that Mslahtk signs for a logged-in user. So this
 * route is a hop, never a form:
 *
 *   signed in here already  -> straight to the page asked for
 *   not signed in           -> Mslahtk's /go/app, which mints the token for
 *                              whoever is logged in there (logging in first
 *                              if needed) and comes back to /admin/entry
 *
 * Linked from the site footer ("כניסת צוות") and from the "link expired"
 * page, and every back-office page sends a signed-out visitor here with the
 * page it wanted in `to`, so a bookmark works in one click.
 */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req.headers, req.nextUrl.origin);
  const asked = req.nextUrl.searchParams.get("to") || "";
  // Only ever our own back-office, like /admin/entry.
  const to = /^\/admin(\/|$)/.test(asked) && !asked.startsWith("/admin/login") ? asked : "/admin";

  if (readSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.redirect(new URL(to, origin));
  }

  const via = connectionSecret() ? enterThroughMslahtkUrl(origin, to) : null;
  if (!via) return NextResponse.redirect(new URL("/admin/denied", origin));
  return NextResponse.redirect(via);
}
