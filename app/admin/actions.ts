"use server";

import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE, readSession } from "@/lib/admin-auth";
import { allFields, getForm } from "@/lib/forms";
import { mintPrefillToken } from "@/lib/prefill";
import { publicOrigin } from "@/lib/request";
import { SITE } from "@/lib/site";
import { answersOf, getSubmission } from "@/lib/submissions";
import { answerPrefill, loadCase, markAnswerLinkSent } from "@/lib/home-case";

export type ResendResult = { url: string; locked: number; prefilled: number } | { error: string };

/**
 * Mint a re-send link for one past submission.
 *
 * A server action rather than a route handler so the request goes to a URL
 * under /admin, which is exactly the path the session cookie is scoped to.
 * Widening the cookie to "/" would have been one character, and would have put
 * an admin session on every public form request for no reason.
 *
 * The caller sends only the submission id and which fields stay locked, never
 * the answers: values are re-read here, so a tampered request cannot lock a
 * field to something the customer never said, and the signature covers what
 * is actually on record.
 */
export async function buildResendLink(submissionId: string, locked: string[]): Promise<ResendResult> {
  const jar = await cookies();
  if (!readSession(jar.get(ADMIN_COOKIE)?.value)) return { error: "אין הרשאה, התחברו מחדש" };
  if (!submissionId) return { error: "חסר מזהה טופס" };

  const sub = await getSubmission(submissionId).catch(() => null);
  if (!sub) return { error: "הפנייה לא נמצאה" };

  const form = getForm(sub.formSlug);
  if (!form) return { error: `טופס לא מזוהה: ${sub.formSlug}` };

  // Only fields this form declares, so a stale tab cannot smuggle a key into
  // the token that the renderer would then faithfully display.
  // A signature is drawn afresh each time; its stored marker is not an answer to replay.
  const known = new Set(allFields(form).filter((f) => f.type !== "signature").map((f) => f.name));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersOf(sub))) {
    if (known.has(k) && v.trim()) values[k] = v;
  }
  const safeLocked = (Array.isArray(locked) ? locked : []).filter((n) => known.has(n) && values[n]);

  const token = mintPrefillToken({ slug: form.slug, values, locked: safeLocked, fromLeadId: sub.id });

  // Prefer the host actually being browsed, so a link built on staging points
  // at staging rather than silently at production.
  const origin = publicOrigin(await headers(), SITE.url);

  return {
    url: `${origin}/forms/${form.slug}?p=${encodeURIComponent(token)}`,
    locked: safeLocked.length,
    prefilled: Object.keys(values).length,
  };
}

/**
 * Mint the link that hands a case's form 3 to the customer.
 *
 * The values come from the LATEST saved offer, never from the request: the
 * customer is answering the offer, so the insurer, the premium and the start
 * date it names are locked, and the token names the case so the answer files
 * as its child. Building the link also stamps the offer as "sent", which is
 * what moves the case to its third step.
 */
export async function buildAnswerLink(caseId: string): Promise<ResendResult> {
  const jar = await cookies();
  if (!readSession(jar.get(ADMIN_COOKIE)?.value)) return { error: "אין הרשאה, התחברו מחדש" };
  if (!caseId) return { error: "חסר מזהה תיק" };

  const file = await loadCase(caseId).catch(() => null);
  if (!file) return { error: "התיק לא נמצא" };
  const pre = answerPrefill(file);
  if (!pre || !file.latestOffer) return { error: "אין הצעה שמורה בתיק. שמרו הצעה (טופס 2) קודם." };

  const token = mintPrefillToken({ slug: file.def.answer, values: pre.values, locked: pre.locked, caseId: file.request.id });
  await markAnswerLinkSent(file.latestOffer.id).catch(() => undefined);

  const origin = publicOrigin(await headers(), SITE.url);
  return {
    url: `${origin}/forms/${file.def.answer}?p=${encodeURIComponent(token)}`,
    locked: pre.locked.length,
    prefilled: Object.keys(pre.values).length,
  };
}
