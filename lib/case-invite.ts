// A form the agency SENDS opens the customer's file on the spot.
//
// Until now a customer existed only once they had filled the form: sending a
// link registered nothing anywhere, so a customer who had been sent form 1 and
// not yet opened it was invisible to the agency's own tools. From the moment
// the agency sends (the back-office "send" button) this module:
//
//   1. opens the row the customer's answers will complete later
//      (Submission.awaitingCustomer), picking up an unanswered earlier send to
//      the same person instead of opening a second one;
//   2. files the customer in Mslahtk as a lead right away, which also gives
//      them their customer card, and moves it to "contacted" (the agency has
//      reached out);
//   3. mints the personal link (signed, carrying the row's id) and delivers it
//      over WhatsApp and/or email, or hands the agent a one-tap fallback.
//
// When the customer files the form, lib/form-submit.ts completes THIS row and
// updates THIS lead. When the offer is saved and the customer answers, the same
// lead moves on (lib/home-case.ts). One customer, one file, one lead, from the
// send to the signature.
//
// Server-only: it reads and writes the database and calls Mslahtk.

import type { Prisma, Submission } from "@prisma/client";
import type { AdminIdentity } from "./admin-auth";
import { db } from "./db";
import { dmyHm } from "./dates";
import { allFields, answersForReading, cleanAgencyFill, getForm, identityField, type FormDef } from "./forms";
import { answerPrefill, caseOpenedBy, loadCase, markAnswerLinkSent } from "./home-case";
import { answerMessage, inviteMessage, type OutgoingMessage } from "./invite-messages";
import { customerMailMode, renderCustomerEmail, sendCustomerMail } from "./mailer";
import { sendWhatsappText, setLeadStage, submitLead, updateLeadFields, type WhatsappReason } from "./mslahtk";
import { phoneKey, toE164, waDigits } from "./phone";
import { mintPrefillToken } from "./prefill";
import { CHANNELS, type Channel, type ChannelOutcome, type Registration, type SendOutcome } from "./send-types";
import { answersOf, createSubmission } from "./submissions";

export type Recipient = { name: string; phone: string; email: string };

/** How long a send stays worth reusing: the same as its link. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60_000;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ── What the agent typed ────────────────────────────────────────────────────

export function cleanRecipient(input: { name?: unknown; phone?: unknown; email?: unknown }): { ok: true; value: Recipient } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const phone = String(input.phone ?? "").trim().slice(0, 40);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 200);
  if (phone && !toE164(phone)) return { ok: false, error: "מספר הטלפון אינו תקין" };
  if (email && !EMAIL.test(email)) return { ok: false, error: "כתובת הדוא״ל אינה תקינה" };
  if (!phone && !email) return { ok: false, error: "יש להזין טלפון או דוא״ל של הלקוח" };
  return { ok: true, value: { name, phone, email } };
}

export function cleanChannels(input: unknown): Channel[] {
  if (!Array.isArray(input)) return [];
  return CHANNELS.filter((c) => input.includes(c));
}

// ── Delivery ────────────────────────────────────────────────────────────────

const WHATSAPP_WHY: Record<WhatsappReason, string> = {
  not_configured: "אין כרגע חיבור למסלחתק. אפשר לשלוח בלחיצה אחת מכאן",
  no_permission: "האתר עוד לא קיבל הרשאה לשלוח בווטסאפ דרך מסלחתק. אפשר לשלוח בלחיצה אחת מכאן",
  window_closed: "ווטסאפ מאפשר שליחה אוטומטית רק ללקוח שכתב לווטסאפ העסקי ב-24 השעות האחרונות (או שהחיבור עדיין לא הושלם). אפשר לשלוח בלחיצה אחת מכאן",
  not_sent: "מסלחתק לא שלח את ההודעה. אפשר לשלוח בלחיצה אחת מכאן",
  unreachable: "אין כרגע חיבור למסלחתק. אפשר לשלוח בלחיצה אחת מכאן",
};

function mailtoFor(to: string, msg: OutgoingMessage): string {
  const body = [msg.greeting, "", ...msg.lines, "", msg.link].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Send `msg` over each requested channel. Never throws: a channel that cannot
 * deliver says why and gives the agent a link that finishes the job by hand.
 */
export async function deliver(channels: readonly Channel[], to: Recipient, msg: OutgoingMessage): Promise<ChannelOutcome[]> {
  const out: ChannelOutcome[] = [];
  for (const channel of channels) {
    if (channel === "whatsapp") {
      if (!to.phone) {
        out.push({ channel, state: "skipped", detail: "אין מספר טלפון" });
        continue;
      }
      const res = await sendWhatsappText(to.phone, msg.whatsapp);
      if (res.ok) {
        out.push({ channel, state: "sent", to: to.phone, detail: "נשלח בווטסאפ העסקי" });
      } else {
        console.error("[send] whatsapp not sent", { reason: res.reason, error: res.error });
        out.push({
          channel,
          state: "prepared",
          to: to.phone,
          detail: WHATSAPP_WHY[res.reason],
          href: `https://wa.me/${waDigits(to.phone)}?text=${encodeURIComponent(msg.whatsapp)}`,
        });
      }
      continue;
    }

    if (!to.email) {
      out.push({ channel, state: "skipped", detail: "אין כתובת דוא״ל" });
      continue;
    }
    const manual = mailtoFor(to.email, msg);
    if (customerMailMode() === "off") {
      out.push({ channel, state: "prepared", to: to.email, detail: "הדוא״ל של הסוכנות עוד לא מחובר לשליחה מהאתר. אפשר לשלוח בלחיצה אחת מכאן", href: manual });
      continue;
    }
    try {
      const { html, text } = renderCustomerEmail({ heading: msg.heading, greeting: msg.greeting, lines: msg.lines, ctaLabel: msg.ctaLabel, link: msg.link });
      const how = await sendCustomerMail({ to: to.email, subject: msg.subject, html, text });
      out.push({ channel, state: "sent", to: to.email, detail: how === "previewed" ? "נשלח (סביבת פיתוח: ההודעה הודפסה ליומן השרת)" : "נשלח במייל" });
    } catch (err) {
      console.error("[send] email failed", { error: err instanceof Error ? err.message : String(err) });
      out.push({ channel, state: "prepared", to: to.email, detail: "השליחה במייל נכשלה. אפשר לשלוח בלחיצה אחת מכאן", href: manual });
    }
  }
  return out;
}

// ── The log of what was sent, on the row ────────────────────────────────────

export type SendLogEntry = { at: string; channel: Channel; state: "sent" | "prepared" };

function objectOf(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function sendLogOf(sub: Pick<Submission, "source">): SendLogEntry[] {
  const raw = objectOf(sub.source).sends;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is SendLogEntry => Boolean(e) && typeof e === "object" && typeof (e as SendLogEntry).at === "string");
}

/**
 * What the agency filled in when it sent this row's form (the vehicle number, the
 * insurance company ...), kept on the row so that sending the form again carries
 * the same details.
 */
export function prefillOf(sub: Pick<Submission, "source">, form: FormDef): Record<string, string> {
  return cleanAgencyFill(form, objectOf(sub.source).prefill);
}

/** "נשלח בווטסאפ ובמייל 30/09/2026 13:05", or null when nothing has gone out. */
export function lastSendLine(sub: Pick<Submission, "source">): string | null {
  const log = sendLogOf(sub);
  if (!log.length) return null;
  const last = log[log.length - 1];
  const sameMoment = log.filter((e) => e.at === last.at);
  const sent = sameMoment.filter((e) => e.state === "sent").map((e) => (e.channel === "whatsapp" ? "בווטסאפ" : "במייל"));
  const prepared = sameMoment.filter((e) => e.state === "prepared").map((e) => (e.channel === "whatsapp" ? "ווטסאפ" : "מייל"));
  const parts = [sent.length ? `נשלח ${sent.join(" ו")}` : "", prepared.length ? `הוכן לשליחה ידנית (${prepared.join(", ")})` : ""].filter(Boolean);
  return parts.length ? `${parts.join(", ")} ${dmyHm(last.at)}` : null;
}

/** Append what just happened to the row's send log (the last 20 entries are kept). */
export async function recordSends(submissionId: string, outcomes: ChannelOutcome[], extra: Record<string, unknown> = {}): Promise<void> {
  const row = await db.submission.findUnique({ where: { id: submissionId }, select: { source: true } });
  if (!row) return;
  const prev = objectOf(row.source);
  const at = new Date().toISOString();
  const added: SendLogEntry[] = outcomes.filter((o) => o.state !== "skipped").map((o) => ({ at, channel: o.channel, state: o.state as "sent" | "prepared" }));
  const sends = [...sendLogOf({ source: row.source }), ...added].slice(-20);
  await db.submission.update({ where: { id: submissionId }, data: { source: { ...prev, ...extra, sends } as Prisma.InputJsonObject } });
}

// ── Opening the file ────────────────────────────────────────────────────────

/** The customer, filed in Mslahtk (which also gives them their customer card) and marked as contacted. */
async function registerLead(sub: { id: string }, form: FormDef, to: Recipient, page: string, prefill: Record<string, string> = {}): Promise<Registration> {
  const lead = await submitLead({
    name: to.name || undefined,
    phone: to.phone || undefined,
    email: to.email || undefined,
    message: `נשלח ללקוח: ${form.title}`,
    // What the agency already knows (its own details come first, so they never overwrite the system's keys).
    fields: { ...prefill, _submissionId: sub.id, form_stage: "נשלח ללקוח, ממתין למילוי", form_sentAt: dmyHm(new Date()) },
    ctaId: `form_${form.slug}`,
    ctaLabel: form.title,
    category: `form:${form.slug}`,
    source: { page },
  });
  if (!lead.ok) {
    await db.submission.update({ where: { id: sub.id }, data: { mslahtkError: lead.skipped ? null : lead.error } }).catch(() => undefined);
    if (!lead.skipped) console.error("[invite] mslahtk lead failed", { slug: form.slug, error: lead.error });
    return { ok: false, error: lead.error, skipped: lead.skipped };
  }
  await db.submission
    .update({ where: { id: sub.id }, data: { mslahtkLeadId: lead.leadId, mslahtkStatus: "new", mslahtkError: null, mslahtkSyncedAt: new Date() } })
    .catch((err) => console.error("[invite] could not record the lead link", { id: sub.id, error: err instanceof Error ? err.message : String(err) }));
  // The agency reached out: that is what "contacted" means on the pipeline.
  const stage = await setLeadStage(lead.leadId, "contacted", "נשלח טופס ללקוח");
  if (stage.ok) {
    await db.submission.update({ where: { id: sub.id }, data: { mslahtkStatus: "contacted" } }).catch(() => undefined);
  }
  return { ok: true, leadId: lead.leadId };
}

function normName(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Is this unanswered send the same customer as `to`? The same phone or email is
 * not enough on its own: a couple share a number and an office shares an
 * address, and two different names are two customers, each with their own file.
 */
export function sameInvitee(row: Pick<Submission, "name" | "phone" | "email">, to: Recipient): boolean {
  const key = to.phone ? phoneKey(to.phone) : "";
  const sameContact = Boolean(key && row.phone && phoneKey(row.phone) === key) || Boolean(to.email && row.email && row.email.toLowerCase() === to.email.toLowerCase());
  if (!sameContact) return false;
  const a = normName(row.name);
  const b = normName(to.name);
  return !a || !b || a === b;
}

/**
 * The row (and lead) for a form about to be sent. Idempotent per customer and
 * form: an earlier send that is still unanswered is picked up, so pressing
 * "send" twice, or re-sending a link, never opens a second file.
 */
export async function openInvite(input: {
  form: FormDef;
  to: Recipient;
  kind: "form" | "simulator";
  agency: AdminIdentity | null;
  page: string;
  /** What the agent filled in for the customer (FormField.agencyFills); anything else is ignored. */
  prefill?: Record<string, string>;
}): Promise<{ id: string; reused: boolean; registration?: Registration; prefill: Record<string, string> }> {
  const { form, to, kind, agency, page } = input;
  const typed = cleanAgencyFill(form, input.prefill);
  const hasTyped = Object.keys(typed).length > 0;

  const pending = await db.submission.findMany({
    where: { formSlug: form.slug, awaitingCustomer: true, parentId: null, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const found = pending.find((r) => sameInvitee(r, to));

  if (found) {
    // Pressing "send" again with nothing typed keeps what the first send carried.
    const prefill = hasTyped ? typed : prefillOf(found, form);
    const source = { ...objectOf(found.source), inviteKind: kind, ...(hasTyped ? { prefill } : {}) };
    await db.submission.update({
      where: { id: found.id },
      data: { name: to.name || found.name, phone: to.phone || found.phone, email: to.email || found.email, source: source as Prisma.InputJsonObject },
    });
    // A file whose lead never got created (Mslahtk was down) gets another try.
    const registration = found.mslahtkLeadId ? undefined : await registerLead(found, form, to, page, prefill);
    return { id: found.id, reused: true, registration, prefill };
  }

  const sub = await createSubmission({
    formSlug: form.slug,
    formTitle: form.title,
    name: to.name || undefined,
    phone: to.phone || undefined,
    email: to.email || undefined,
    answers: {},
    source: { page, invite: true, inviteKind: kind, ...(agency ? { agency: agency.email || agency.sub } : {}), ...(hasTyped ? { prefill: typed } : {}) },
    invite: true,
  });
  const registration = await registerLead(sub, form, to, page, typed);
  return { id: sub.id, reused: false, registration, prefill: typed };
}

/** The personal link: signed, carrying the row it completes, with what the agent already knows filled in. */
export function inviteLink(opts: { form: FormDef; id: string; to: Recipient; origin: string; kind: "form" | "simulator"; prefill?: Record<string, string> }): string {
  const { form, id, to, origin, kind } = opts;
  // A case that has a calculator can be sent starting from it: the customer
  // runs the estimate, and the "continue" button carries this same link on.
  const simulatorPath = caseOpenedBy(form)?.simulatorPath;
  const values: Record<string, string> = {};
  const nameKey = identityField(form, "name")?.name;
  if (nameKey && to.name) values[nameKey] = to.name;
  const names = new Set(allFields(form).map((f) => f.name));
  if (names.has("phone") && to.phone) values.phone = to.phone;
  if (names.has("email") && to.email) values.email = to.email;
  // What the agency filled in: the customer opens the form with it, and may correct it (nothing is locked).
  Object.assign(values, cleanAgencyFill(form, opts.prefill));
  const token = mintPrefillToken({ slug: form.slug, values, locked: [], inviteId: id });
  const path = kind === "simulator" && simulatorPath ? simulatorPath : `/forms/${form.slug}`;
  return `${origin}${path}?p=${encodeURIComponent(token)}`;
}

/** Open the file, mint the link and send it. The one call behind the back-office "send" button. */
export async function sendInvite(input: {
  form: FormDef;
  kind: "form" | "simulator";
  to: Recipient;
  channels: readonly Channel[];
  agency: AdminIdentity | null;
  origin: string;
  page: string;
  prefill?: Record<string, string>;
}): Promise<SendOutcome> {
  const { form, kind, to, channels, agency, origin, page } = input;
  const opened = await openInvite({ form, to, kind, agency, page, prefill: input.prefill });
  const link = inviteLink({ form, id: opened.id, to, origin, kind, prefill: opened.prefill });
  const outcomes = await deliver(channels, to, inviteMessage({ title: form.title, link, name: to.name, calculator: kind === "simulator" }));
  if (outcomes.length) await recordSends(opened.id, outcomes).catch(() => undefined);
  return { ok: true, id: opened.id, link, reused: opened.reused, registration: opened.registration, outcomes };
}

/** Send an unanswered form again: a fresh link to the SAME file, never a new one. */
export async function resendInvite(input: { id: string; channels: readonly Channel[]; origin: string }): Promise<SendOutcome> {
  const row = await db.submission.findUnique({ where: { id: input.id } });
  if (!row || !row.awaitingCustomer) return { ok: false, error: "הטופס כבר מולא או שהפנייה לא נמצאה" };
  const form = getForm(row.formSlug);
  if (!form) return { ok: false, error: "טופס לא מזוהה" };
  const to: Recipient = { name: row.name ?? "", phone: row.phone ?? "", email: row.email ?? "" };
  if (!to.phone && !to.email) return { ok: false, error: "אין טלפון או דוא״ל בפנייה" };
  const kind = objectOf(row.source).inviteKind === "simulator" ? "simulator" : "form";
  // The details the agency filled in at the first send travel again with the fresh link.
  const prefill = prefillOf(row, form);
  // A file whose lead was never created (Mslahtk was down at the first send) gets it now.
  const registration = row.mslahtkLeadId ? undefined : await registerLead(row, form, to, "/admin", prefill);
  const link = inviteLink({ form, id: row.id, to, origin: input.origin, kind, prefill });
  const outcomes = await deliver(input.channels, to, inviteMessage({ title: form.title, link, name: to.name, calculator: kind === "simulator" }));
  if (outcomes.length) await recordSends(row.id, outcomes).catch(() => undefined);
  return { ok: true, id: row.id, link, registration, outcomes };
}

// ── The customer files the form ─────────────────────────────────────────────

/** The unanswered row a signed link points at, or null when it is not one (already filled, another form, gone). */
export async function loadInvite(id: string | undefined, slug: string): Promise<Submission | null> {
  if (!id) return null;
  const row = await db.submission.findUnique({ where: { id } }).catch(() => null);
  return row && row.formSlug === slug && row.awaitingCustomer && !row.parentId ? row : null;
}

/**
 * Complete an invited row with what the customer filed. Returns null when
 * someone got there first (a double tap, two tabs): the caller then treats the
 * post as a fresh submission instead of overwriting a finished one.
 */
export async function completeInvite(
  invite: Submission,
  data: { name?: string; phone?: string; email?: string; answers: Record<string, string>; arrival: Record<string, unknown> },
): Promise<Submission | null> {
  const claimed = await db.submission.updateMany({
    where: { id: invite.id, awaitingCustomer: true },
    data: {
      name: data.name || invite.name,
      phone: data.phone || invite.phone,
      email: data.email || invite.email,
      answers: data.answers as Prisma.InputJsonObject,
      source: { ...objectOf(invite.source), ...data.arrival, invited: true } as Prisma.InputJsonObject,
      awaitingCustomer: false,
      // "Received" is now, not the moment the agency sent it.
      createdAt: new Date(),
    },
  });
  if (claimed.count !== 1) return null;
  return db.submission.findUnique({ where: { id: invite.id } });
}

/**
 * What the Mslahtk card learns when the customer files: their answers (dates day
 * first, the site's private keys left out) and where the file stands.
 */
export function leadFieldsFor(form: FormDef, answers: Record<string, string>, filledAt: Date | string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersForReading(form, answers))) {
    if (!k.startsWith("_") && v) out[k] = v;
  }
  out.form_stage = "הלקוח מילא את הטופס";
  out.form_filledAt = dmyHm(filledAt);
  return out;
}

export type FillResult = { ok: true; leadId: string; recreated: boolean } | { ok: false; error: string; skipped?: boolean };

/**
 * Put a filled row's answers on its Mslahtk lead. Called the moment the customer
 * files, and again when the agent presses "try again" after a failure.
 *
 *   - The row has no lead (it could not be created when the form was sent):
 *     file one now, with the answers.
 *   - The lead is gone from Mslahtk (deleted there): file a new one and point the
 *     row at it, so the customer is never left out of the CRM.
 *   - Otherwise merge the answers onto the lead it already has.
 *
 * Any other failure is recorded on the row (and shown in the back-office) and
 * leaves the link as it was: a merge is safe to repeat.
 */
export async function fillLeadFromRow(row: Submission, page = "/forms"): Promise<FillResult> {
  const form = getForm(row.formSlug);
  if (!form) return { ok: false, error: "unknown form" };
  const fields = leadFieldsFor(form, answersOf(row), row.createdAt);

  if (row.mslahtkLeadId) {
    const up = await updateLeadFields(row.mslahtkLeadId, fields);
    if (up.ok) {
      await db.submission.update({ where: { id: row.id }, data: { mslahtkError: null, mslahtkSyncedAt: new Date() } }).catch(() => undefined);
      return { ok: true, leadId: row.mslahtkLeadId, recreated: false };
    }
    if (up.skipped) return { ok: false, error: up.error, skipped: true };
    if (up.status !== 404) {
      await db.submission.update({ where: { id: row.id }, data: { mslahtkError: up.error.slice(0, 500) } }).catch(() => undefined);
      return { ok: false, error: up.error };
    }
    // 404: the lead was deleted in Mslahtk. Fall through and file a fresh one.
  }

  const lead = await submitLead({
    name: row.name || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    message: `טופס: ${form.title}`,
    fields: { ...fields, _submissionId: row.id },
    ctaId: `form_${form.slug}`,
    ctaLabel: form.title,
    category: `form:${form.slug}`,
    source: { page },
  });
  if (!lead.ok) {
    await db.submission.update({ where: { id: row.id }, data: { mslahtkError: lead.skipped ? null : lead.error.slice(0, 500) } }).catch(() => undefined);
    return { ok: false, error: lead.error, skipped: lead.skipped };
  }
  await db.submission
    .update({ where: { id: row.id }, data: { mslahtkLeadId: lead.leadId, mslahtkStatus: "new", mslahtkError: null, mslahtkSyncedAt: new Date() } })
    .catch((err) => console.error("[invite] could not record the lead link", { id: row.id, error: err instanceof Error ? err.message : String(err) }));
  return { ok: true, leadId: lead.leadId, recreated: true };
}

/** The "try again" behind the back-office notice: register a sent file, or fill in a filled one. */
export async function retryMslahtkSync(id: string): Promise<{ ok: true; note: string } | { ok: false; error: string }> {
  const row = await db.submission.findUnique({ where: { id } });
  if (!row || row.parentId) return { ok: false, error: "הפנייה לא נמצאה" };
  if (row.awaitingCustomer) {
    if (row.mslahtkLeadId) return { ok: true, note: "הלקוח כבר רשום במסלחתק" };
    const form = getForm(row.formSlug);
    if (!form) return { ok: false, error: "טופס לא מזוהה" };
    const done = await registerLead(row, form, { name: row.name ?? "", phone: row.phone ?? "", email: row.email ?? "" }, "/admin", prefillOf(row, form));
    return done.ok ? { ok: true, note: "הלקוח נרשם במסלחתק" } : { ok: false, error: done.skipped ? "החיבור למסלחתק לא מוגדר" : done.error };
  }
  const done = await fillLeadFromRow(row, "/admin");
  if (done.ok) return { ok: true, note: done.recreated ? "נפתח כרטיס חדש במסלחתק עם פרטי הפנייה" : "הכרטיס במסלחתק עודכן" };
  return { ok: false, error: done.skipped ? "החיבור למסלחתק לא מוגדר" : done.error };
}

// ── Form 3 ──────────────────────────────────────────────────────────────────

/** The signed link that hands a case's form 3 to the customer, stamping the offer as sent. */
export async function mintAnswerLink(caseId: string, origin: string): Promise<
  | { ok: true; url: string; locked: number; prefilled: number; offerId: string; to: Recipient }
  | { ok: false; error: string }
> {
  const file = await loadCase(caseId).catch(() => null);
  if (!file) return { ok: false, error: "התיק לא נמצא" };
  const pre = answerPrefill(file);
  if (!pre || !file.latestOffer) return { ok: false, error: "אין הצעה שמורה בתיק. שמרו הצעה (טופס 2) קודם." };
  const token = mintPrefillToken({ slug: file.def.answer, values: pre.values, locked: pre.locked, caseId: file.request.id });
  await markAnswerLinkSent(file.latestOffer.id).catch(() => undefined);
  return {
    ok: true,
    url: `${origin}/forms/${file.def.answer}?p=${encodeURIComponent(token)}`,
    locked: pre.locked.length,
    prefilled: Object.keys(pre.values).length,
    offerId: file.latestOffer.id,
    // Where it goes is what the customer wrote in form 1.
    to: { name: file.request.name ?? "", phone: file.request.phone ?? "", email: file.request.email ?? "" },
  };
}

/** Mint form 3's link and send it to the phone and email the customer gave in form 1. */
export async function sendAnswer(input: { caseId: string; channels: readonly Channel[]; origin: string }): Promise<SendOutcome> {
  const minted = await mintAnswerLink(input.caseId, input.origin);
  if (!minted.ok) return minted;
  const outcomes = await deliver(input.channels, minted.to, answerMessage({ link: minted.url, name: minted.to.name }));
  if (outcomes.length) await recordSends(minted.offerId, outcomes).catch(() => undefined);
  return { ok: true, id: input.caseId, link: minted.url, outcomes };
}
