// SMTP delivery + the HTML shell every notification email shares.
//
// Mail is the storage layer in this MVP: there is no database and no object
// store, so whatever leaves here is the only copy of a submission. Sending
// straight over SMTP to the agency's own mailbox also means no third party
// keeps a copy of the customers' documents.
//
// Required env (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO
// With SMTP_HOST unset outside production the mail is logged to the console
// instead of sent, so the forms are fully testable without credentials.

import nodemailer, { type Transporter } from "nodemailer";
import { SITE } from "@/lib/site";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type Row = { label: string; value: string };

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is not configured");
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    // Port 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  return cached;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendMail(opts: {
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const to = process.env.MAIL_TO || SITE.email;
  const from =
    process.env.MAIL_FROM || `"${SITE.brand}" <${process.env.SMTP_USER || SITE.email}>`;

  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST is not configured");
    }
    // Dev preview — no credentials needed to exercise the whole flow.
    console.log(
      [
        "",
        "──────── MAIL PREVIEW (SMTP not configured) ────────",
        `to:      ${to}`,
        `from:    ${from}`,
        `replyTo: ${opts.replyTo ?? "—"}`,
        `subject: ${opts.subject}`,
        "",
        opts.text,
        (opts.attachments ?? [])
          .map((a) => `[attachment] ${a.filename} · ${a.contentType} · ${a.content.length} bytes`)
          .join("\n"),
        "────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  await transporter().sendMail({
    to,
    from,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    // Replying in the mail client answers the customer directly.
    replyTo: opts.replyTo,
    attachments: opts.attachments,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Table-based RTL email. Mail clients ignore most modern CSS, so everything is
 * inline and the layout is a plain table — this renders correctly in Gmail,
 * Outlook and the iOS mail app.
 */
export function renderEmail(opts: {
  heading: string;
  subheading: string;
  rows: Row[];
  attachmentNames?: string[];
  footnote?: string;
}): { html: string; text: string } {
  const { heading, subheading, rows, attachmentNames = [], footnote } = opts;

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #DDE6EE;color:#5C7390;font-size:13px;width:190px;vertical-align:top;">${escapeHtml(r.label)}</td>
          <td style="padding:11px 0;border-bottom:1px solid #DDE6EE;color:#1E4164;font-size:15px;vertical-align:top;white-space:pre-wrap;">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join("");

  const attachHtml = attachmentNames.length
    ? `<p style="margin:24px 0 0;color:#1E4164;font-size:14px;">
         <strong>קבצים מצורפים (${attachmentNames.length}):</strong><br>
         ${attachmentNames.map((n) => escapeHtml(n)).join("<br>")}
       </p>`
    : "";

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <body style="margin:0;padding:24px;background:#F4F8FB;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #DDE6EE;border-radius:6px;">
      <tr>
        <td style="background:#1E4164;padding:22px 28px;border-radius:6px 6px 0 0;">
          <div style="color:#C6E3EE;font-size:11px;letter-spacing:.14em;">${escapeHtml(SITE.brand)}</div>
          <div style="color:#ffffff;font-size:21px;font-weight:bold;padding-top:6px;">${escapeHtml(heading)}</div>
          <div style="color:rgba(255,255,255,.72);font-size:13px;padding-top:6px;">${escapeHtml(subheading)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
          ${attachHtml}
          ${footnote ? `<p style="margin:22px 0 0;color:#5C7390;font-size:12px;line-height:1.6;">${escapeHtml(footnote)}</p>` : ""}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    subheading,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    attachmentNames.length ? `\nקבצים מצורפים:\n${attachmentNames.join("\n")}` : "",
    footnote ? `\n${footnote}` : "",
  ].join("\n");

  return { html, text };
}
