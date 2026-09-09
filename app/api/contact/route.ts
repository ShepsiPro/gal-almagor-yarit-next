// Homepage contact form. Same mail-only delivery as the standalone forms, but
// JSON in and no attachments — this is the short "call me back" path.

import { NextResponse } from "next/server";
import { renderEmail, sendMail, type Row } from "@/lib/mailer";

export const runtime = "nodejs";

const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "name", label: "שם מלא", required: true },
  { key: "phone", label: "טלפון", required: true },
  { key: "email", label: "דוא״ל" },
  { key: "topic", label: "תחום הביטוח" },
  { key: "message", label: "הודעה" },
];

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
  let replyTo: string | undefined;
  let name = "";

  for (const f of FIELDS) {
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
    rows.push({ label: f.label, value });
  }

  const submitted = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  rows.push({ label: "התקבל בתאריך", value: submitted });

  const { html, text } = renderEmail({
    heading: "פנייה חדשה מטופס יצירת קשר",
    subheading: `${name} · ${submitted}`,
    rows,
  });

  try {
    await sendMail({ subject: `פנייה מהאתר · ${name}`, html, text, replyTo });
  } catch (err) {
    console.error("[contact] send failed", err);
    return NextResponse.json(
      { ok: false, error: "השליחה נכשלה. נסו שוב או התקשרו אלינו." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
