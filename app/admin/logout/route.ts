import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { publicOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * End the back-office session. POST only (a form button), so a link on some
 * other page cannot sign anyone out. The cookie lives on path /admin, which is
 * why this route sits here: it is the only path the cookie is sent to.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", publicOrigin(req.headers, req.nextUrl.origin)), 303);
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: 0 });
  return res;
}
