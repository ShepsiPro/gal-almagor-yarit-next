// The back-office door for agency forms (a case's offer). It lives under
// /admin because that is the only path the admin session cookie is sent to,
// so a post here is a post by a signed-in agent, and the pipeline records who.

import { NextResponse } from "next/server";
import { handleFormSubmission } from "@/lib/form-submit";
import { currentAdmin } from "../../session";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "אין הרשאה, התחברו מחדש" }, { status: 401 });
  return handleFormSubmission(req, slug, { agency: admin, page: `/admin/forms/${slug}` });
}
