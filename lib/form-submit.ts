// The one submission pipeline behind every form, public and back-office.
//
// Validates against the form definition, then, in this order:
//   1. writes the submission to this site's own database (the record),
//   2. puts the attached documents into the site's own storage (R2),
//   3. works the CRM: a customer form files a Mslahtk lead; a case's offer or
//      answer moves the case's EXISTING lead and writes its summary onto it,
//   4. emails the agency mailbox (customer forms only; the agency does not
//      need mail about what it just typed).
// Each step degrades on its own and says so in the email. The request fails
// only when NOTHING captured the submission: telling a customer their form
// failed when it is already on record just makes them fill it in twice.
//
// Two doors lead here: /api/forms/<slug> (the public one, customer forms only)
// and /admin/forms/<slug> (under the admin session cookie, for agency forms).

import { NextResponse } from "next/server";
import type { AdminIdentity } from "./admin-auth";
import { db } from "./db";
import {
  ACCEPTED_MIME,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MAX_FILES_PER_FIELD,
  SIGNATURE_MAX_BYTES,
  allFields,
  conflictingOptions,
  formAudience,
  formatBytes,
  getForm,
  isFieldVisible,
  isValidIsraeliId,
  type FormField,
} from "./forms";
import {
  caseOfChildForm,
  caseOpenedBy,
  decisionLabel,
  decisionOf,
  leadFieldsForAnswer,
  leadFieldsForOffer,
  leadStatusForDecision,
  simulatorAnswerFields,
} from "./home-case";
import { computeHomeQuote, decodeSnapshot, roundShekel } from "./home-quote";
import { renderEmail, sendMail, type MailAttachment, type Row } from "./mailer";
import { dashboardLeadUrl, notifyOwner, setLeadStage, submitLead, updateLead } from "./mslahtk";
import { verifyPrefillToken } from "./prefill";
import { createSubmission, storeFiles, type IncomingFile, type StoreResult } from "./submissions";

// In-memory throttle. Single container, so this is enough to stop casual abuse;
// it resets on redeploy, which is an acceptable trade.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude bound on memory growth
  return recent.length > MAX_PER_WINDOW;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Keeps Hebrew intact; strips only what could confuse a mail client or shell. */
function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]/g, "_").slice(-80);
}

function labelledName(field: FormField, file: File, index: number, total: number) {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const suffix = total > 1 ? ` (${index + 1})` : "";
  return safeFilename(`${field.label}${suffix}${ext}`);
}

export type SubmitOptions = {
  /** The signed-in admin when the post came through the back-office door. */
  agency?: AdminIdentity | null;
  /** The page recorded as the submission's source. */
  page: string;
};

export async function handleFormSubmission(req: Request, slug: string, opts: SubmitOptions): Promise<NextResponse> {
  const form = getForm(slug);
  if (!form) return bad("הטופס לא נמצא", 404);
  const isAgency = Boolean(opts.agency);
  // An agency form does not exist as far as the public door is concerned.
  if (formAudience(form) === "agency" && !isAgency) return bad("הטופס לא נמצא", 404);

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!isAgency && rateLimited(ip)) return bad("נשלחו יותר מדי פניות. נסו שוב בעוד מספר דקות.", 429);

  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    return bad("לא ניתן לקרוא את הטופס. ייתכן שהקבצים גדולים מדי.", 413);
  }

  // Honeypot: a bot fills every input it finds. Answer 200 so it learns nothing.
  if (!isAgency && (data.get("_hp") as string | null)?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const rows: Row[] = [];
  const attachments: MailAttachment[] = [];
  // The same bytes, keyed by field, for the site's own storage.
  const incoming: IncomingFile[] = [];
  // Machine-keyed copy of the answers. Keyed by field name, not label, so a
  // later report survives a label edit; lib/forms.ts is the map back to the
  // Hebrew wording.
  const answers: Record<string, string> = {};
  let totalBytes = 0;
  let replyTo: string | undefined;
  let customerName = "";
  let customerPhone = "";

  // Snapshot the submitted answers BEFORE validating, so conditional visibility
  // is evaluated against the same state the browser evaluated it against.
  const answered: Record<string, string | string[]> = {};
  for (const field of allFields(form)) {
    if (field.type === "file" || field.type === "statement" || field.type === "signature") continue;
    const vals = data
      .getAll(field.name)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    answered[field.name] = vals.length > 1 ? vals : (vals[0] ?? "");
  }

  // If the agency sent this form pre-filled with locked answers, the signed
  // token is the authority on those answers, not whatever arrived in the body.
  // The browser renders them read-only, but a read-only input is a suggestion:
  // anyone can POST here directly.
  const sent = verifyPrefillToken(data.get("_prefill") as string | null);
  const tokenOk = Boolean(sent && sent.slug === slug);
  if (form.requiresToken && !tokenOk) {
    return bad("הקישור לטופס אינו תקין או שפג תוקפו. בקשו מהסוכנות קישור חדש.", 403);
  }
  let resentFromRef: string | undefined;
  if (sent && tokenOk) {
    resentFromRef = sent.fromLeadId;
    for (const name of sent.locked) answered[name] = sent.values[name];
  }

  for (const field of allFields(form)) {
    if (field.type === "statement") continue;
    if (!isFieldVisible(form, field, answered)) continue;
    if (field.type === "file") {
      const files = data
        .getAll(field.name)
        .filter((v): v is File => v instanceof File && v.size > 0);
      if (!files.length) continue;
      if (files.length > MAX_FILES_PER_FIELD) {
        return bad(`ניתן לצרף עד ${MAX_FILES_PER_FIELD} קבצים בשדה "${field.label}"`);
      }
      for (const [i, file] of files.entries()) {
        if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
          return bad(`סוג הקובץ "${file.name}" אינו נתמך. ניתן לצרף תמונות או PDF בלבד.`);
        }
        if (file.size > MAX_FILE_BYTES) {
          return bad(`הקובץ "${file.name}" גדול מ־${formatBytes(MAX_FILE_BYTES)}`);
        }
        totalBytes += file.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return bad(`סך הקבצים חורג מ־${formatBytes(MAX_TOTAL_BYTES)}`);
        }
        const content = Buffer.from(await file.arrayBuffer());
        const filename = labelledName(field, file, i, files.length);
        attachments.push({ filename, content, contentType: file.type });
        incoming.push({ fieldName: field.name, filename, contentType: file.type, content });
      }
      const fileSummary = files.length === 1 ? "קובץ אחד מצורף" : `${files.length} קבצים מצורפים`;
      rows.push({ label: field.label, value: fileSummary });
      answers[field.name] = files.map((f) => f.name).join(", ");
      continue;
    }

    if (field.type === "signature") {
      // Drawn in the browser, posted as a small PNG under the field's name.
      // Filed with the documents (so the back-office shows it) and attached to
      // the email (so it survives a storage outage like every other document).
      const file = data.get(field.name);
      if (!(file instanceof File) || file.size === 0) {
        if (field.required) return bad(`יש לחתום: ${field.label}`);
        continue;
      }
      if (file.type !== "image/png" || file.size > SIGNATURE_MAX_BYTES) {
        return bad(`החתימה בשדה "${field.label}" אינה תקינה. נקו וחתמו שוב.`);
      }
      totalBytes += file.size;
      const content = Buffer.from(await file.arrayBuffer());
      const filename = safeFilename(`${field.label}.png`);
      attachments.push({ filename, content, contentType: "image/png" });
      incoming.push({ fieldName: field.name, filename, contentType: "image/png", content });
      rows.push({ label: field.label, value: "נחתם (החתימה מצורפת)" });
      answers[field.name] = "נחתם";
      continue;
    }

    if (field.type === "consent") {
      const agreed = data.get(field.name) === "on";
      if (!agreed) return bad(`יש לאשר: ${field.label}`);
      rows.push({
        label: field.label.length > 90 ? `${field.label.slice(0, 90)}...` : field.label,
        value: "אושר",
      });
      answers[field.name] = "אושר";
      continue;
    }

    const raw = answered[field.name];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const value = values.join(", ");

    if (!value) {
      if (field.required) return bad(`שדה חובה חסר: ${field.label}`);
      continue;
    }
    if (value.length > 5000) return bad(`הערך בשדה "${field.label}" ארוך מדי`);
    if (field.type === "id" && !isValidIsraeliId(value)) {
      return bad(`מספר תעודת הזהות בשדה "${field.label}" אינו תקין`);
    }
    if (field.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return bad(`כתובת הדוא״ל בשדה "${field.label}" אינה תקינה`);
    }
    if (field.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) return bad(`הערך בשדה "${field.label}" אינו מספר`);
      if (field.min !== undefined && n < field.min) {
        return bad(`הערך בשדה "${field.label}" חייב להיות ${field.min} ומעלה`);
      }
      if (field.max !== undefined && n > field.max) {
        return bad(`הערך בשדה "${field.label}" חייב להיות עד ${field.max}`);
      }
    }
    if (field.exclusive) {
      for (const chosen of values) {
        const clash = conflictingOptions(field, chosen).find((o) => values.includes(o));
        if (clash) {
          return bad(`לא ניתן לבחור גם "${chosen}" וגם "${clash}" בשדה "${field.label}"`);
        }
      }
    }

    if (field.type === "email" && !replyTo) replyTo = value;
    if (field.type === "tel" && !customerPhone) customerPhone = value;
    if (field.identity === "name" && !customerName) customerName = value;
    answers[field.name] = value;
    rows.push({ label: field.label, value });
  }

  const submitted = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  rows.push({ label: "התקבל בתאריך", value: submitted });

  // ── The case this belongs to ──────────────────────────────────────────────
  // An offer names its request in the body (it was posted from that request's
  // page, under the admin session); an answer carries it inside the signed
  // token. Either way the parent must exist and must be THAT case's request.
  const childCase = caseOfChildForm(form);
  let parent: { id: string; mslahtkLeadId: string | null; phone: string | null; email: string | null; name: string | null } | null = null;
  if (childCase) {
    const ref = isAgency ? String(data.get("_parent") ?? "").trim() : (sent?.caseId ?? "");
    if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      const row = await db.submission
        .findUnique({ where: { id: ref }, select: { id: true, formSlug: true, mslahtkLeadId: true, phone: true, email: true, name: true } })
        .catch(() => null);
      if (row && row.formSlug === childCase.request) parent = row;
    }
    // An offer without its case is a mistake, not a record worth keeping. A
    // customer's signed answer is kept regardless: it is their decision, and
    // the back-office can attach it by hand.
    if (!parent && isAgency) return bad("התיק שההצעה שייכת אליו לא נמצא");
    if (parent) rows.push({ label: "תיק", value: parent.id });
  }

  // ── The simulator snapshot a request arrives with ─────────────────────────
  // Recomputed here from the inputs; the estimate the browser showed is never
  // trusted as a number, only the inputs are kept.
  if (caseOpenedBy(form)) {
    const ctxRaw = data.get("_context");
    if (typeof ctxRaw === "string" && ctxRaw && ctxRaw.length < 8000) {
      try {
        const ctx = JSON.parse(ctxRaw) as { simulator?: unknown };
        const input = typeof ctx?.simulator === "string" ? decodeSnapshot(ctx.simulator) : null;
        if (input) {
          const result = computeHomeQuote(input);
          Object.assign(answers, simulatorAnswerFields(input, result));
          rows.push({ label: "הערכה ראשונית מהמחשבון", value: `${roundShekel(result.total).toLocaleString("he-IL")} ₪ לשנה` });
        }
      } catch {
        /* a malformed context is simply not stored */
      }
    }
  }

  // A re-send updates an earlier submission.
  let resentFromId: string | null = null;
  if (resentFromRef) {
    const prev = await db.submission
      .findFirst({ where: { OR: [{ id: resentFromRef }, { mslahtkLeadId: resentFromRef }] }, select: { id: true } })
      .catch(() => null);
    resentFromId = prev?.id ?? null;
    rows.push({ label: "עדכון לפנייה קודמת", value: prev?.id ?? resentFromRef });
    answers._resentFrom = prev?.id ?? resentFromRef;
  }

  // 1. The record.
  let submission: { id: string } | null = null;
  try {
    submission = await createSubmission({
      formSlug: form.slug,
      formTitle: form.title,
      name: customerName || parent?.name || undefined,
      // A case's children carry the request's contact details so the list and
      // the WhatsApp buttons work from any row of the file.
      phone: customerPhone || parent?.phone || undefined,
      email: replyTo || parent?.email || undefined,
      answers,
      source: {
        page: opts.page,
        referrer: req.headers.get("referer") ?? undefined,
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
        ...(isAgency ? { agency: opts.agency?.email || opts.agency?.sub } : {}),
        ...(resentFromRef && !resentFromId ? { resentFromRef } : {}),
      },
      resentFromId,
      parentId: parent?.id ?? null,
    });
  } catch (err) {
    console.error("[forms] database write failed", { slug, error: err instanceof Error ? err.message : String(err) });
  }

  // 2. The documents. Non-fatal: the same bytes ride the email below.
  let stored: StoreResult | null = null;
  if (submission && incoming.length) {
    stored = await storeFiles(submission.id, incoming);
    if (stored.failed) {
      console.error("[forms] file storage incomplete", {
        slug,
        submissionId: submission.id,
        stored: stored.stored,
        failed: stored.failed,
        errors: stored.errors,
      });
    }
  }

  // 3. The CRM.
  let leadOk = false;
  let leadSkipped = false;
  const role = form.caseRole;
  if (parent?.mslahtkLeadId && (role === "offer" || role === "answer")) {
    // The case's lead already exists: move it and write the summary onto it.
    const leadId = parent.mslahtkLeadId;
    const decision = role === "answer" ? decisionOf(answers) : null;
    const status = role === "offer" ? "qualified" : leadStatusForDecision(decision);
    const via = role === "offer" ? "הצעת ביטוח דירה (טופס 2)" : `תשובת הלקוח (טופס 3): ${decisionLabel(decision)}`;
    const fields = role === "offer" ? leadFieldsForOffer(answers) : leadFieldsForAnswer(answers);
    const [stage, update] = await Promise.all([setLeadStage(leadId, status, via), updateLead(leadId, { fields })]);
    leadOk = stage.ok;
    leadSkipped = Boolean(!stage.ok && stage.skipped);
    if (!stage.ok && !stage.skipped) console.error("[forms] mslahtk stage failed", { slug, leadId, error: stage.error });
    if (!update.ok && !update.skipped) console.error("[forms] mslahtk update failed", { slug, leadId, error: update.error });
    if (submission) {
      await db.submission
        .update({
          where: { id: submission.id },
          data: stage.ok ? { mslahtkStatus: status, mslahtkSyncedAt: new Date() } : { mslahtkError: stage.skipped ? null : stage.error },
        })
        .catch(() => undefined);
      // The parent mirrors the pipeline; keep it current without waiting for the sweep.
      if (stage.ok) {
        await db.submission.update({ where: { id: parent.id }, data: { mslahtkStatus: status, mslahtkSyncedAt: new Date() } }).catch(() => undefined);
      }
    }
    rows.push({ label: "כרטיס לקוח", value: dashboardLeadUrl(leadId) });
  } else if (role !== "offer") {
    // A customer form files a lead. (An answer whose case has no lead falls
    // through to here too, so the decision is never lost in the CRM.)
    const lead = await submitLead({
      name: customerName || parent?.name || undefined,
      phone: customerPhone || parent?.phone || undefined,
      email: replyTo || parent?.email || undefined,
      message: `טופס: ${form.title}`,
      fields: submission ? { ...answers, _submissionId: submission.id } : answers,
      ctaId: `form_${form.slug}`,
      ctaLabel: form.title,
      category: `form:${form.slug}`,
      source: { page: opts.page, referrer: req.headers.get("referer") ?? undefined },
    });
    leadOk = lead.ok;
    leadSkipped = Boolean(!lead.ok && lead.skipped);
    if (submission) {
      const submissionId = submission.id;
      await db.submission
        .update({
          where: { id: submissionId },
          data: lead.ok
            ? { mslahtkLeadId: lead.leadId, mslahtkStatus: "new", mslahtkSyncedAt: new Date() }
            : { mslahtkError: lead.skipped ? null : lead.error },
        })
        .catch((err) => console.error("[forms] could not record the lead link", { submissionId, error: err instanceof Error ? err.message : String(err) }));
    }
    if (lead.ok) {
      rows.push({ label: "כרטיס לקוח", value: dashboardLeadUrl(lead.leadId) });
    } else if (!lead.skipped) {
      console.error("[forms] mslahtk lead failed", { slug, error: lead.error });
      rows.push({ label: "כרטיס לקוח", value: `לא נוצר: ${lead.error}` });
    }
  }

  // 3b. The customer answered the offer (form 3): the one moment in a case that
  // arrives from outside while nobody is looking. Tell the owner on the phone,
  // through Mslahtk; the tap opens this case in the back-office, signed in.
  // Never blocks the customer's submit: a failure is logged, the row and the
  // mail below stand either way.
  if (role === "answer" && parent) {
    const told = await notifyOwner({
      title: "הלקוח השיב להצעה",
      body: `${parent.name || "לקוח"}: ${decisionLabel(decisionOf(answers))}`,
      to: `/admin/${parent.id}`,
      leadId: parent.mslahtkLeadId || undefined,
    });
    if (!told.ok && !told.skipped) console.error("[forms] owner notify failed", { slug, error: told.error });
  }

  // 4. The notification. Only for what a customer sent: the agency does not
  // need an email about the offer it just saved.
  if (formAudience(form) === "customer") {
    if (incoming.length) {
      const n = incoming.length;
      rows.push(
        stored && stored.stored === n
          ? { label: "מסמכים", value: `${n} נשמרו בתיק הפנייה במערכת (וגם מצורפים כאן)` }
          : { label: "מסמכים", value: `${stored?.stored ?? 0} מתוך ${n} נשמרו במערכת. כל הקבצים מצורפים למייל זה, שמרו אותו.` },
      );
    }

    const decision = role === "answer" ? decisionOf(answers) : null;
    const heading = role === "answer" ? `${form.title}: ${decisionLabel(decision)}` : form.title;
    const { html, text } = renderEmail({
      heading,
      subheading: customerName ? `${customerName} · ${submitted}` : submitted,
      rows,
      attachmentNames: attachments.map((a) => a.filename),
      footnote: submission
        ? leadOk
          ? "נשלח אוטומטית מטופס באתר. הפנייה שמורה במערכת הסוכנות ובכרטיס הלקוח במסלחתק."
          : "נשלח אוטומטית מטופס באתר. הפנייה שמורה במערכת הסוכנות."
        : leadOk
          ? "נשלח אוטומטית מטופס באתר. הפנייה שמורה בכרטיס הלקוח במסלחתק."
          : "נשלח אוטומטית מטופס באתר. הודעה זו היא העותק היחיד של הפנייה.",
    });

    try {
      await sendMail({
        subject: `טופס ${heading}${customerName ? ` · ${customerName}` : ""}`,
        html,
        text,
        replyTo,
        attachments,
      });
      if (submission) {
        await db.submission.update({ where: { id: submission.id }, data: { emailSentAt: new Date() } }).catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[forms] send failed", { slug, submissionId: submission?.id ?? null, error: msg });
      if (submission) {
        await db.submission.update({ where: { id: submission.id }, data: { emailError: msg.slice(0, 500) } }).catch(() => undefined);
      }
      // Only fail the request when NOTHING captured it.
      if (!submission && !leadOk && !leadSkipped) {
        return bad("השליחה נכשלה. נסו שוב או צרו קשר טלפוני.", 502);
      }
    }
  } else if (!submission) {
    return bad("השמירה נכשלה. נסו שוב.", 502);
  }

  return NextResponse.json({ ok: true, id: submission?.id ?? null, caseId: parent?.id ?? null });
}
