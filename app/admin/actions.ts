"use server";

import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE, readSession } from "@/lib/admin-auth";
import { allFields, getForm } from "@/lib/forms";
import { getStoredLead } from "@/lib/mslahtk";
import { mintPrefillToken } from "@/lib/prefill";
import { SITE } from "@/lib/site";

export type ResendResult = { url: string; locked: number; prefilled: number } | { error: string };

/**
 * Mint a re-send link for one past submission.
 *
 * A server action rather than a route handler so the request goes to a URL
 * under /admin — which is exactly the path the session cookie is scoped to.
 * Widening the cookie to "/" would have been one character, and would have put
 * an admin session on every public form request for no reason.
 *
 * The caller sends only the lead id and which fields stay locked, never the
 * answers: values are re-read here, so a tampered request cannot lock a field
 * to something the customer never said, and the signature covers what is
 * actually on record.
 */
export async function buildResendLink(leadId: string, locked: string[]): Promise<ResendResult> {
  const jar = await cookies();
  if (!readSession(jar.get(ADMIN_COOKIE)?.value)) return { error: "אין הרשאה — התחברו מחדש" };
  if (!leadId) return { error: "חסר מזהה טופס" };

  let detail: Awaited<ReturnType<typeof getStoredLead>>;
  try {
    detail = await getStoredLead(leadId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "קריאת הטופס נכשלה" };
  }

  const slug = (detail.lead.category || "").replace(/^form:/, "");
  const form = getForm(slug);
  if (!form) return { error: `טופס לא מזוהה: ${slug || "—"}` };

  // Only fields this form declares, so a stale tab cannot smuggle a key into
  // the token that the renderer would then faithfully display.
  const known = new Set(allFields(form).map((f) => f.name));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(detail.lead.fields)) {
    if (known.has(k) && typeof v === "string" && v.trim()) values[k] = v;
  }
  const safeLocked = (Array.isArray(locked) ? locked : []).filter((n) => known.has(n) && values[n]);

  const token = mintPrefillToken({ slug, values, locked: safeLocked, fromLeadId: leadId });

  // Prefer the host actually being browsed, so a link built on staging points
  // at staging rather than silently at production.
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : SITE.url;

  return {
    url: `${origin}/forms/${slug}?p=${encodeURIComponent(token)}`,
    locked: safeLocked.length,
    prefilled: Object.keys(values).length,
  };
}
