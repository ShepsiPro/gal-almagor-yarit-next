// Submission endpoint for /forms/<slug>.
//
// Validates against the form definition, then emails the answers plus every
// uploaded file to the agency mailbox. Nothing is written to disk or to a
// database — see lib/mailer.ts for why that is deliberate here.

import { NextResponse } from "next/server";
import {
  ACCEPTED_MIME,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MAX_FILES_PER_FIELD,
  allFields,
  conflictingOptions,
  formatBytes,
  getForm,
  isFieldVisible,
  isValidIsraeliId,
  type FormField,
} from "@/lib/forms";
import { renderEmail, sendMail, type MailAttachment, type Row } from "@/lib/mailer";
import { mslahtkConfigured, submitLead } from "@/lib/mslahtk";
import { verifyPrefillToken } from "@/lib/prefill";

export const runtime = "nodejs";

// In-memory throttle. Single container, so this is enough to stop casual abuse;
// it resets on redeploy, which is an acceptable trade for an MVP with no store.
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) return bad("הטופס לא נמצא", 404);

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return bad("נשלחו יותר מדי פניות. נסו שוב בעוד מספר דקות.", 429);

  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    return bad("לא ניתן לקרוא את הטופס. ייתכן שהקבצים גדולים מדי.", 413);
  }

  // Honeypot: a bot fills every input it finds. Answer 200 so it learns nothing.
  if ((data.get("_hp") as string | null)?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const rows: Row[] = [];
  const attachments: MailAttachment[] = [];
  // Machine-keyed copy of the answers for Mslahtk's schema-free `fields` blob.
  // Keyed by field name, not label, so a later report survives a label edit —
  // lib/forms.ts is the map back to the Hebrew wording.
  const answers: Record<string, string> = {};
  let totalBytes = 0;
  let replyTo: string | undefined;
  let customerName = "";
  let customerPhone = "";

  // Snapshot the submitted answers BEFORE validating, so conditional visibility
  // is evaluated against the same state the browser evaluated it against. Doing
  // it field-by-field would judge a field against a half-built picture and could
  // demand something the customer was never shown.
  const answered: Record<string, string | string[]> = {};
  for (const field of allFields(form)) {
    if (field.type === "file" || field.type === "statement") continue;
    const vals = data
      .getAll(field.name)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    answered[field.name] = vals.length > 1 ? vals : (vals[0] ?? "");
  }

  // If the agency sent this form pre-filled with locked answers, the signed
  // token is the authority on those answers — not whatever arrived in the body.
  // The browser renders them read-only, but a read-only input is a suggestion:
  // anyone can POST here directly. Overriding (rather than rejecting) also means
  // a stale tab or a browser that ignored `readOnly` still files a correct
  // declaration instead of an error the customer cannot act on.
  const sent = verifyPrefillToken(data.get("_prefill") as string | null);
  let resentFromLeadId: string | undefined;
  if (sent && sent.slug === slug) {
    resentFromLeadId = sent.fromLeadId;
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
        attachments.push({
          filename: labelledName(field, file, i, files.length),
          content: Buffer.from(await file.arrayBuffer()),
          contentType: file.type,
        });
      }
      const fileSummary =
        files.length === 1 ? "קובץ אחד מצורף" : `${files.length} קבצים מצורפים`;
      rows.push({ label: field.label, value: fileSummary });
      // Until the public lead-upload token lands, the files themselves travel
      // in the email only; the card still records what was attached.
      answers[field.name] = files.map((f) => f.name).join(", ");
      continue;
    }

    if (field.type === "consent") {
      const agreed = data.get(field.name) === "on";
      if (!agreed) return bad(`יש לאשר: ${field.label}`);
      // Use the statement's own wording, not a generic label: this form carries
      // eight separate declarations and an email that says "אישור" eight times
      // is no record of which one was actually agreed to.
      rows.push({
        label: field.label.length > 90 ? `${field.label.slice(0, 90)}…` : field.label,
        value: "אושר",
      });
      continue;
    }

    // Multi-select checkbox groups arrive as repeated entries. `answered`
    // already carries the locked overrides, so read from it rather than from
    // the raw body.
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
    if (field.name === "fullName") customerName = value;
    answers[field.name] = value;
    rows.push({ label: field.label, value });
  }

  const submitted = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  rows.push({ label: "התקבל בתאריך", value: submitted });
  if (resentFromLeadId) {
    rows.push({ label: "עדכון לפנייה קודמת", value: resentFromLeadId });
    answers._resentFrom = resentFromLeadId;
  }

  // Push into Mslahtk first so the email can report whether the customer card
  // was created. submitLead never throws — if the CRM is down or unconfigured
  // the mail still goes out, which is what keeps this migration safe.
  const lead = await submitLead({
    name: customerName || undefined,
    phone: customerPhone || undefined,
    email: replyTo,
    message: `טופס: ${form.title}`,
    fields: answers,
    ctaId: `form_${form.slug}`,
    ctaLabel: form.title,
    category: `form:${form.slug}`,
    source: { page: `/forms/${form.slug}`, referrer: req.headers.get("referer") ?? undefined },
  });

  if (lead.ok) {
    rows.push({ label: "כרטיס לקוח", value: `נוצר במערכת (${lead.leadId})` });
  } else if (!lead.skipped) {
    console.error("[forms] mslahtk lead failed", { slug, error: lead.error });
    rows.push({ label: "כרטיס לקוח", value: `לא נוצר — ${lead.error}` });
  }

  const { html, text } = renderEmail({
    heading: form.title,
    subheading: customerName ? `${customerName} · ${submitted}` : submitted,
    rows,
    attachmentNames: attachments.map((a) => a.filename),
    footnote: lead.ok
      ? "נשלח אוטומטית מטופס באתר. הפנייה נשמרה גם בכרטיס הלקוח במערכת."
      : mslahtkConfigured()
        ? "נשלח אוטומטית מטופס באתר. שמירת כרטיס הלקוח נכשלה — הודעה זו היא העותק היחיד."
        : "נשלח אוטומטית מטופס באתר. הודעה זו היא העותק היחיד של הפנייה.",
  });

  try {
    await sendMail({
      subject: `טופס ${form.title}${customerName ? ` · ${customerName}` : ""}`,
      html,
      text,
      replyTo,
      attachments,
    });
  } catch (err) {
    console.error("[forms] send failed", { slug, leadId: lead.ok ? lead.leadId : null, error: err });
    // The customer card is the record now, so a mail outage is no longer a lost
    // submission — only fail the request when NOTHING captured it. Telling
    // someone their form failed when the lead is already filed just makes them
    // fill it in twice.
    if (!lead.ok) {
      return bad("השליחה נכשלה. נסו שוב או צרו קשר טלפוני.", 502);
    }
  }

  return NextResponse.json({ ok: true });
}
