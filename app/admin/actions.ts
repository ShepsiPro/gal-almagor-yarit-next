"use server";

import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE, readSession, type AdminIdentity } from "@/lib/admin-auth";
import { cleanChannels, cleanRecipient, mintAnswerLink, resendInvite, retryMslahtkSync, sendAnswer, sendInvite } from "@/lib/case-invite";
import { db } from "@/lib/db";
import { agencyFillFor, allFields, formAudience, getForm } from "@/lib/forms";
import { caseOpenedBy } from "@/lib/home-case";
import { mintPrefillToken } from "@/lib/prefill";
import { publicOrigin } from "@/lib/request";
import type { SendOutcome } from "@/lib/send-types";
import { SITE } from "@/lib/site";
import { accessToId, alertColleague, claimIfUnclaimed, colleagues, nameOf, notYoursMessage, type FileAccess } from "@/lib/staff";
import { answersOf, getSubmission } from "@/lib/submissions";

export type ResendResult = { url: string; locked: number; prefilled: number } | { error: string };

/**
 * The file this person may work, or why not. Each employee works their own
 * files, the ones shared with them, and the ones nobody has taken yet
 * (lib/staff.ts); the owner of the business works every file.
 */
async function workable(who: AdminIdentity, id: string): Promise<{ ok: true; access: FileAccess } | { ok: false; error: string }> {
  const access = await accessToId(who, id).catch(() => null);
  if (!access) return { ok: false, error: "הפנייה לא נמצאה" };
  if (!access.see) return { ok: false, error: notYoursMessage(access) };
  return { ok: true, access };
}

/** Working a file nobody has takes it: it moves to this person's section, and its news reaches them. */
async function workOn(access: FileAccess): Promise<void> {
  if (access.unclaimed) await claimIfUnclaimed(access.root.id, access.viewer, access.team);
}

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
  const who = readSession(jar.get(ADMIN_COOKIE)?.value);
  if (!who) return { error: "אין הרשאה, התחברו מחדש" };
  if (!submissionId) return { error: "חסר מזהה טופס" };

  const sub = await getSubmission(submissionId).catch(() => null);
  if (!sub) return { error: "הפנייה לא נמצאה" };
  const may = await workable(who, sub.id);
  if (!may.ok) return { error: may.error };

  const form = getForm(sub.formSlug);
  if (!form) return { error: `טופס לא מזוהה: ${sub.formSlug}` };
  await workOn(may.access);

  // Only fields this form declares, so a stale tab cannot smuggle a key into
  // the token that the renderer would then faithfully display.
  // A signature is drawn afresh each time; its stored marker is not an answer to replay.
  const known = new Set(allFields(form).filter((f) => f.type !== "signature").map((f) => f.name));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersOf(sub))) {
    if (known.has(k) && v.trim()) values[k] = v;
  }
  const safeLocked = (Array.isArray(locked) ? locked : []).filter((n) => known.has(n) && values[n]);

  // The link names who made it, so the alert when the customer files it reaches them.
  const by = who.sub && who.sub !== "unknown" ? who.sub : undefined;
  const token = mintPrefillToken({ slug: form.slug, values, locked: safeLocked, fromLeadId: sub.id, ...(by ? { by } : {}) });

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
  const who = readSession(jar.get(ADMIN_COOKIE)?.value);
  if (!who) return { error: "אין הרשאה, התחברו מחדש" };
  if (!caseId) return { error: "חסר מזהה תיק" };
  const may = await workable(who, caseId);
  if (!may.ok) return { error: may.error };
  await workOn(may.access);
  const minted = await mintAnswerLink(caseId, publicOrigin(await headers(), SITE.url), who);
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
  // What the customer must answer in the form, the agency must give before it can send it (the vehicle number of an accident notice).
  const { prefill, missing } = agencyFillFor(form, input.prefill);
  if (missing.length) return { ok: false, error: `יש להזין לפני השליחה: ${missing.map((f) => f.label).join(", ")}` };
  const origin = publicOrigin(await headers(), SITE.url);
  return sendInvite({ form, kind, to: to.value, channels: cleanChannels(input.channels), agency: who, origin, page: "/admin/send", prefill });
}

/** Send a form the customer has not filled yet once more: a fresh link to the same file. */
export async function resendToCustomer(submissionId: string, channels: string[]): Promise<SendOutcome> {
  const who = await admin();
  if (!who) return NO_SESSION;
  if (!submissionId) return { ok: false, error: "חסר מזהה פנייה" };
  const may = await workable(who, submissionId);
  if (!may.ok) return { ok: false, error: may.error };
  await workOn(may.access);
  return resendInvite({ id: submissionId, channels: cleanChannels(channels), origin: publicOrigin(await headers(), SITE.url), agency: who });
}

/** Send form 3 to the phone and email the customer gave in form 1. */
export async function sendAnswerToCustomer(caseId: string, channels: string[]): Promise<SendOutcome> {
  const who = await admin();
  if (!who) return NO_SESSION;
  if (!caseId) return { ok: false, error: "חסר מזהה תיק" };
  const may = await workable(who, caseId);
  if (!may.ok) return { ok: false, error: may.error };
  await workOn(may.access);
  return sendAnswer({ caseId, channels: cleanChannels(channels), origin: publicOrigin(await headers(), SITE.url), agency: who });
}

/** "Try again" on the notice that says Mslahtk did not take the customer: register a sent file, or fill in a filled one. */
export async function retryMslahtk(submissionId: string): Promise<{ ok: true; note: string } | { ok: false; error: string }> {
  const who = await admin();
  if (!who) return { ok: false, error: "אין הרשאה, התחברו מחדש" };
  if (!submissionId) return { ok: false, error: "חסר מזהה פנייה" };
  const may = await workable(who, submissionId);
  if (!may.ok) return { ok: false, error: may.error };
  return retryMslahtkSync(submissionId);
}

// ── Whose file it is ────────────────────────────────────────────────────────
//
// Each employee has their own section (lib/staff.ts). These are the three moves
// on a file: take one nobody has, hand one over, and choose who it is shared
// with. Taking is open to anyone who can see the file; handing over and sharing
// are for its owner and the owner of the business.

export type PeopleResult = { ok: true } | { ok: false; error: string };

/** "Take it": a file nobody has becomes yours. */
export async function takeFile(fileId: string): Promise<PeopleResult> {
  const who = await admin();
  if (!who) return { ok: false, error: "אין הרשאה, התחברו מחדש" };
  const may = await workable(who, String(fileId ?? ""));
  if (!may.ok) return may;
  const { access } = may;
  if (!access.viewer.id) return { ok: false, error: "לא זוהה מי מחובר/ת. התחברו מחדש דרך מסלחתק." };
  if (!access.unclaimed) return { ok: false, error: `הפנייה כבר אצל ${nameOf(access.team, access.root.ownerId)}` };
  if (!(await claimIfUnclaimed(access.root.id, access.viewer, access.team))) return { ok: false, error: "מישהו אחר לקח את הפנייה הרגע" };
  return { ok: true };
}

/** Hand the file to a colleague: it moves to their section, and they are told on their phone. */
export async function assignFile(fileId: string, userId: string): Promise<PeopleResult> {
  const who = await admin();
  if (!who) return { ok: false, error: "אין הרשאה, התחברו מחדש" };
  const may = await workable(who, String(fileId ?? ""));
  if (!may.ok) return may;
  const { access } = may;
  if (!access.manage) return { ok: false, error: "רק מי שהפנייה אצלו, או בעלי העסק, יכולים להעביר אותה" };
  const target = colleagues(access.team).find((p) => p.id === String(userId ?? ""));
  if (!target) return { ok: false, error: "העובד/ת לא נמצא/ה ברשימת הצוות" };
  if (target.id === access.root.ownerId) return { ok: true };
  await db.$transaction([
    db.submission.update({ where: { id: access.root.id }, data: { ownerId: target.id } }),
    // The new owner has it as their own now, not as a share.
    db.submissionShare.deleteMany({ where: { submissionId: access.root.id, userId: target.id } }),
  ]);
  if (target.id !== access.viewer.id) {
    await alertColleague(
      target.id,
      {
        title: "פנייה הועברה אליך",
        body: `${access.root.name || "לקוח"}: ${access.root.formTitle}. הועברה על ידי ${nameOf(access.team, access.viewer.id)}`,
        to: `/admin/${access.root.id}`,
        leadId: access.root.mslahtkLeadId || undefined,
      },
      access.team,
    );
  }
  return { ok: true };
}

/** Choose who the file is shared with (the whole list): those added are told on their phone. */
export async function shareFile(fileId: string, userIds: string[]): Promise<PeopleResult> {
  const who = await admin();
  if (!who) return { ok: false, error: "אין הרשאה, התחברו מחדש" };
  const may = await workable(who, String(fileId ?? ""));
  if (!may.ok) return may;
  const { access } = may;
  if (!access.manage) return { ok: false, error: "רק מי שהפנייה אצלו, או בעלי העסק, יכולים לשתף אותה" };
  const team = colleagues(access.team);
  const asked = new Set((Array.isArray(userIds) ? userIds : []).map(String));
  // Only colleagues on the team, and never the file's own owner (it is already theirs).
  const wanted = team.filter((p) => asked.has(p.id) && p.id !== access.root.ownerId).map((p) => p.id);
  const had = access.root.shares.map((s) => s.userId);
  const added = wanted.filter((id) => !had.includes(id));
  const removed = had.filter((id) => !wanted.includes(id));
  if (!added.length && !removed.length) return { ok: true };
  await db.$transaction([
    db.submissionShare.deleteMany({ where: { submissionId: access.root.id, userId: { in: removed } } }),
    db.submissionShare.createMany({
      data: added.map((userId) => ({ submissionId: access.root.id, userId, sharedBy: access.viewer.id || null })),
      skipDuplicates: true,
    }),
  ]);
  for (const id of added) {
    if (id === access.viewer.id) continue;
    await alertColleague(
      id,
      {
        title: "שותפה איתך פנייה",
        body: `${access.root.name || "לקוח"}: ${access.root.formTitle}. שותפה על ידי ${nameOf(access.team, access.viewer.id)}`,
        to: `/admin/${access.root.id}`,
        leadId: access.root.mslahtkLeadId || undefined,
      },
      access.team,
    );
  }
  return { ok: true };
}
