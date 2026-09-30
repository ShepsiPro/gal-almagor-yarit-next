"use server";

import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE, readSession } from "@/lib/admin-auth";
import { cleanChannels, cleanRecipient, mintAnswerLink, resendInvite, retryMslahtkSync, sendAnswer, sendInvite } from "@/lib/case-invite";
import { allFields, cleanAgencyFill, formAudience, getForm } from "@/lib/forms";
import { caseOpenedBy } from "@/lib/home-case";
import { mintPrefillToken } from "@/lib/prefill";
import { publicOrigin } from "@/lib/request";
import type { SendOutcome } from "@/lib/send-types";
import { SITE } from "@/lib/site";
import { answersOf, getSubmission } from "@/lib/submissions";

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
 * customer is answering the offer, so the insurer, the premium, the start date
 * and the ID it names are locked, and the token names the case so the answer
 * files as its child. Building the link also stamps the offer as "sent", which
 * is what moves the case to its third step.
 */
export async function buildAnswerLink(caseId: string): Promise<ResendResult> {
  const jar = await cookies();
  if (!readSession(jar.get(ADMIN_COOKIE)?.value)) return { error: "אין הרשאה, התחברו מחדש" };
  if (!caseId) return { error: "חסר מזהה תיק" };
  const minted = await mintAnswerLink(caseId, publicOrigin(await headers(), SITE.url));
  if (!minted.ok) return { error: minted.error };
  return { url: minted.url, locked: minted.locked, prefilled: minted.prefilled };
}

// ── Sending to the customer ─────────────────────────────────────────────────
//
// Every action below is the back-office pressing "send": it needs the admin
// session, opens or completes the customer's file, and delivers the link over
// WhatsApp and/or email to the contact details on record, or hands the agent
// a one-tap way to finish by hand (lib/case-invite.ts).

const NO_SESSION: SendOutcome = { ok: false, error: "אין הרשאה, התחברו מחדש" };

async function admin() {
  const jar = await cookies();
  return readSession(jar.get(ADMIN_COOKIE)?.value);
}

/**
 * Send a form (or the calculator that leads to one) to a customer whose
 * details the agent typed. The customer is registered in Mslahtk right now,
 * before they have opened anything.
 */
export async function sendFormToCustomer(input: {
  slug: string;
  kind?: "form" | "simulator";
  name?: string;
  phone?: string;
  email?: string;
  channels?: string[];
  /** What the agent filled in for the customer (the fields a form marks `agencyFills`). */
  prefill?: Record<string, string>;
}): Promise<SendOutcome> {
  const who = await admin();
  if (!who) return NO_SESSION;
  const form = getForm(String(input?.slug ?? ""));
  if (!form || formAudience(form) !== "customer" || form.requiresToken) return { ok: false, error: "הטופס אינו ניתן לשליחה" };
  const kind = input.kind === "simulator" ? "simulator" : "form";
  if (kind === "simulator" && !caseOpenedBy(form)?.simulatorPath) return { ok: false, error: "לטופס הזה אין מחשבון" };
  const to = cleanRecipient(input);
  if (!to.ok) return { ok: false, error: to.error };
  const origin = publicOrigin(await headers(), SITE.url);
  return sendInvite({ form, kind, to: to.value, channels: cleanChannels(input.channels), agency: who, origin, page: "/admin/send", prefill: cleanAgencyFill(form, input.prefill) });
}

/** Send a form the customer has not filled yet once more: a fresh link to the same file. */
export async function resendToCustomer(submissionId: string, channels: string[]): Promise<SendOutcome> {
  if (!(await admin())) return NO_SESSION;
  if (!submissionId) return { ok: false, error: "חסר מזהה פנייה" };
  return resendInvite({ id: submissionId, channels: cleanChannels(channels), origin: publicOrigin(await headers(), SITE.url) });
}

/** Send form 3 to the phone and email the customer gave in form 1. */
export async function sendAnswerToCustomer(caseId: string, channels: string[]): Promise<SendOutcome> {
  if (!(await admin())) return NO_SESSION;
  if (!caseId) return { ok: false, error: "חסר מזהה תיק" };
  return sendAnswer({ caseId, channels: cleanChannels(channels), origin: publicOrigin(await headers(), SITE.url) });
}

/** "Try again" on the notice that says Mslahtk did not take the customer: register a sent file, or fill in a filled one. */
export async function retryMslahtk(submissionId: string): Promise<{ ok: true; note: string } | { ok: false; error: string }> {
  if (!(await admin())) return { ok: false, error: "אין הרשאה, התחברו מחדש" };
  if (!submissionId) return { ok: false, error: "חסר מזהה פנייה" };
  return retryMslahtkSync(submissionId);
}
