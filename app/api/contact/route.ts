// Homepage contact form: the short "call me back" path, JSON in, no
// attachments. Same three homes as the standalone forms: this site's own
// database (the record), a Mslahtk lead (the customer card), the agency
// mailbox (the notification).

import { NextResponse } from "next/server";
import { CONTACT_FIELDS, CONTACT_FORM_SLUG, CONTACT_FORM_TITLE } from "@/lib/contact-form";
import { db } from "@/lib/db";
import { renderEmail, sendMail, type Row } from "@/lib/mailer";
import { dashboardLeadUrl, submitLead } from "@/lib/mslahtk";
import { createSubmission } from "@/lib/submissions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  if (typeof body._hp === "string" && body._hp.trim()) {
    return NextResponse.json({ ok: true }); // honeypot
  }

  const rows: Row[] = [];
  const answers: Record<string, string> = {};
  let replyTo: string | undefined;
  let name = "";
  let phone = "";

  for (const f of CONTACT_FIELDS) {
    const raw = body[f.key];
    const value = typeof raw === "string" ? raw.trim().slice(0, 3000) : "";
    if (!value) {
      if (f.required) {
        return NextResponse.json(
          { ok: false, error: `שדה חובה חסר: ${f.label}` },
          { status: 400 },
        );
      }
      continue;
    }
    if (f.key === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        return NextResponse.json(
          { ok: false, error: "כתובת הדוא״ל אינה תקינה" },
          { status: 400 },
        );
      }
      replyTo = value;
    }
    if (f.key === "name") name = value;
    if (f.key === "phone") phone = value;
    answers[f.key] = value;
    rows.push({ label: f.label, value });
  }

  const submitted = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  rows.push({ label: "התקבל בתאריך", value: submitted });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const referrer = req.headers.get("referer") ?? undefined;

  // 1. The record.
  let submission: { id: string } | null = null;
  try {
    submission = await createSubmission({
      formSlug: CONTACT_FORM_SLUG,
      formTitle: CONTACT_FORM_TITLE,
      name,
      phone,
      email: replyTo,
      answers,
      source: { page: "/", referrer, ip, userAgent: req.headers.get("user-agent") ?? undefined },
    });
  } catch (err) {
    console.error("[contact] database write failed", err instanceof Error ? err.message : err);
  }

  // 2. The CRM copy.
  const lead = await submitLead({
    name,
    phone,
    email: replyTo,
    message: [answers.topic, answers.message].filter(Boolean).join(": ") || "בקשה ליצירת קשר מהאתר",
    fields: submission ? { ...answers, _submissionId: submission.id } : answers,
    ctaId: "contact",
    ctaLabel: "יצירת קשר מהאתר",
    category: "contact",
    source: { page: "/", referrer },
  });
  if (submission) {
    const submissionId = submission.id;
    await db.submission
      .update({
        where: { id: submissionId },
        data: lead.ok
          ? { mslahtkLeadId: lead.leadId, mslahtkStatus: "new", mslahtkSyncedAt: new Date() }
          : { mslahtkError: lead.skipped ? null : lead.error },
      })
      .catch((err) => console.error("[contact] could not record the lead link", { submissionId, error: err instanceof Error ? err.message : String(err) }));
  }
  if (lead.ok) rows.push({ label: "כרטיס לקוח", value: dashboardLeadUrl(lead.leadId) });
  else if (!lead.skipped) console.error("[contact] mslahtk lead failed", lead.error);

  const { html, text } = renderEmail({
    heading: "פנייה חדשה מטופס יצירת קשר",
    subheading: `${name} · ${submitted}`,
    rows,
  });

  // 3. The notification.
  try {
    await sendMail({ subject: `פנייה מהאתר · ${name}`, html, text, replyTo });
    if (submission) {
      await db.submission.update({ where: { id: submission.id }, data: { emailSentAt: new Date() } }).catch(() => undefined);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contact] send failed", msg);
    if (submission) {
      await db.submission.update({ where: { id: submission.id }, data: { emailError: msg.slice(0, 500) } }).catch(() => undefined);
    }
    if (!submission && !lead.ok) {
      return NextResponse.json(
        { ok: false, error: "השליחה נכשלה. נסו שוב או התקשרו אלינו." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, id: submission?.id ?? null });
}
