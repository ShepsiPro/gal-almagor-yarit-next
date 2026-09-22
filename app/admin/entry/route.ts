import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, mintSessionCookie, verifyEntryToken } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * The landing point for Mslahtk's "open back-office" click.
 *
 * The link carries a short-lived signed token; we verify it, swap it for a
 * session cookie and redirect to a clean URL. The redirect matters: an entry
 * token that stays in the address bar ends up in history, in a screenshot, in
 * a pasted chat message, and while it only lives 15 minutes, there is no
 * reason for it to outlive its single use.
 */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req.headers, req.nextUrl.origin);
  const token = req.nextUrl.searchParams.get("t");
  const identity = verifyEntryToken(token);
  if (!identity) {
    return NextResponse.redirect(new URL("/admin/denied", origin));
  }

  const to = req.nextUrl.searchParams.get("to");
  // Only ever our own back-office: an attacker-supplied absolute URL here would
  // make this an open redirect wearing a trusted domain. Without an explicit
  // `to`, a token minted from one submission's page in Mslahtk lands on that
  // submission; a token from the dashboard header lands on the list.
  const dest = to && /^\/admin(\/|$)/.test(to)
    ? to
    : identity.lid
      ? await landingFor(identity.lid)
      : "/admin";

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

/**
 * A lead-placement token carries Mslahtk's lead id. The record here is keyed
 * by this site's own id, so resolve it; a lead this site never filed (one that
 * arrived before the store existed, or through another channel) lands on the
 * list with a note rather than on a 404.
 */
async function landingFor(lid: string): Promise<string> {
  const sub = await db.submission
    .findFirst({ where: { OR: [{ id: lid }, { mslahtkLeadId: lid }] }, select: { id: true } })
    .catch(() => null);
  return sub ? `/admin/${sub.id}` : `/admin?lookup=${encodeURIComponent(lid)}`;
}
