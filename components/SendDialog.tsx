"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AdminIcon from "@/components/AdminIcon";
import { agencyFillFields, agencyMustFill, getForm } from "@/lib/forms";
import type { Channel, SendOutcome } from "@/lib/send-types";
import type { SendFormAction } from "./FormLinks";

/** What the dialog sends: a form, or the calculator that leads to one. */
export type SendItem = {
  slug: string;
  kind: "form" | "simulator";
  title: string;
  /** Opens only from the personal link a send makes: no general link to copy. */
  linkOnly: boolean;
  /** The general link, for copying when no customer details are given. */
  publicUrl: string;
};

export type Contact = { name: string; phone: string; email: string };

/**
 * "Send to the customer", as a pop-up over the forms page: the customer's
 * details (shared with the page), what the agency fills in for them, and three
 * ways to send. Afterwards it says what happened, with the one tap that
 * finishes a send the system could not do by itself (WhatsApp from the
 * agent's own phone).
 */
export default function SendDialog({
  item,
  contact,
  onContact,
  send,
  onClose,
}: {
  item: SendItem;
  contact: Contact;
  onContact: (next: Contact) => void;
  send: SendFormAction;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [fills, setFills] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Channel | "copy" | null>(null);
  const [result, setResult] = useState<SendOutcome | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const form = getForm(item.slug);
  const fillFields = item.kind === "form" && form ? agencyFillFields(form) : [];
  const mustGive = item.kind === "form" && form ? agencyMustFill(form) : [];
  const missing = mustGive.filter((f) => !(fills[f.name] ?? "").trim());
  const phone = contact.phone.trim();
  const email = contact.email.trim();
  const hasContact = Boolean(phone || email);
  const blocked = missing.length ? `יש להזין קודם: ${missing.map((f) => f.label).join(", ")}` : null;

  function flashCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  /** Register the customer and send over one channel, or (with "copy") only make their personal link. */
  async function go(how: Channel | "copy") {
    setBusy(how);
    try {
      const request = send({ slug: item.slug, kind: item.kind, ...contact, channels: how === "copy" ? [] : [how], prefill: fills });
      // Safari and iOS take back the click's permission to use the clipboard once
      // anything is awaited, so the clipboard is handed the PROMISE of the link now.
      const promised =
        how === "copy" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
          ? navigator.clipboard
              .write([
                new ClipboardItem({
                  "text/plain": request.then((o) => {
                    if (!o.ok) throw new Error(o.error);
                    return new Blob([o.link], { type: "text/plain" });
                  }),
                }),
              ])
              .then(
                () => true,
                () => false,
              )
          : Promise.resolve(false);
      const out = await request;
      setResult(out);
      if (how === "copy" && out.ok) {
        if (await promised) flashCopied();
        else await copyText(out.link);
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      setCopied(false);
    }
  }

  function field(key: keyof Contact, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="field">
        <label htmlFor={`sd-${key}`}>{label}</label>
        <input
          id={`sd-${key}`}
          value={contact[key]}
          onChange={(e) => onContact({ ...contact, [key]: e.target.value })}
          autoComplete="off"
          disabled={busy !== null}
          {...props}
        />
      </div>
    );
  }

  return (
    <dialog
      ref={ref}
      className="sdlg"
      aria-labelledby="sdlg-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside its box) closes it.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="sdlg__box">
        <div className="sdlg__head">
          <div>
            <span className="sdlg__eyebrow">שליחה ללקוח</span>
            <h2 className="sdlg__title" id="sdlg-title">
              {item.title}
            </h2>
          </div>
          <button type="button" className="sdlg__x" aria-label="סגירה" onClick={() => ref.current?.close()}>
            <AdminIcon name="close" size={20} />
          </button>
        </div>

        {!result ? (
          <>
            <div className="sdlg__fields">
              {field("name", "שם הלקוח", { placeholder: "ישראל ישראלי" })}
              {field("phone", "טלפון", { placeholder: "050-0000000", dir: "ltr", inputMode: "tel" })}
              {field("email", "דוא״ל (לא חובה)", { placeholder: "name@example.com", dir: "ltr", inputMode: "email" })}
            </div>

            {fillFields.length > 0 && (
              <fieldset className="sdlg__fills">
                <legend>ממלאים בשביל הלקוח</legend>
                <div className="sdlg__fills-grid">
                  {fillFields.map((f) => (
                    <div className="field" key={f.name}>
                      <label htmlFor={`sd-fill-${f.name}`}>
                        {f.label}
                        {mustGive.includes(f) && <span className="fform__req" aria-hidden="true">*</span>}
                      </label>
                      {f.type === "select" ? (
                        <select id={`sd-fill-${f.name}`} value={fills[f.name] ?? ""} onChange={(e) => setFills((s) => ({ ...s, [f.name]: e.target.value }))}>
                          <option value="">לא נבחר</option>
                          {f.options?.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input id={`sd-fill-${f.name}`} value={fills[f.name] ?? ""} onChange={(e) => setFills((s) => ({ ...s, [f.name]: e.target.value }))} dir="ltr" autoComplete="off" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="sdlg__note">הלקוח יראה אותם מלאים בטופס ויוכל לתקן.</p>
              </fieldset>
            )}

            <div className="sdlg__actions">
              <button type="button" className="sdlg__go sdlg__go--wa" disabled={busy !== null || !phone || Boolean(blocked)} onClick={() => go("whatsapp")}>
                <AdminIcon name="message" size={20} />
                <span>{busy === "whatsapp" ? "שולח…" : "שליחה בווטסאפ"}</span>
              </button>
              <button type="button" className="sdlg__go" disabled={busy !== null || !email || Boolean(blocked)} onClick={() => go("email")}>
                <AdminIcon name="mail" size={20} />
                <span>{busy === "email" ? "שולח…" : "שליחה במייל"}</span>
              </button>
              {hasContact ? (
                <button type="button" className="sdlg__go" disabled={busy !== null || Boolean(blocked)} onClick={() => go("copy")}>
                  <AdminIcon name="copy" size={20} />
                  <span>{busy === "copy" ? "מכין קישור…" : "העתקת קישור אישי"}</span>
                </button>
              ) : (
                <button type="button" className="sdlg__go" disabled={item.linkOnly || Boolean(blocked)} onClick={() => copyText(item.publicUrl)}>
                  <AdminIcon name={copied ? "check" : "copy"} size={20} />
                  <span>{copied ? "הקישור הועתק" : "העתקת קישור כללי"}</span>
                </button>
              )}
            </div>
            <p className="sdlg__note" role={blocked ? "alert" : undefined}>
              {blocked ??
                (!hasContact
                  ? item.linkOnly
                    ? "הטופס נפתח רק מקישור אישי: יש להזין טלפון או דוא״ל של הלקוח."
                    : "בלי טלפון או דוא״ל אפשר רק להעתיק קישור כללי, והלקוח יירשם כשימלא."
                  : "הלקוח נרשם במסלחתק ברגע השליחה, ותיק הפנייה נפתח על שמך.")}
            </p>
          </>
        ) : result.ok ? (
          <div className="sdlg__done" role="status">
            {result.registration?.ok && (
              <p className="sdlg__ok">
                <AdminIcon name="check" /> הלקוח נרשם במסלחתק
              </p>
            )}
            {result.registration && !result.registration.ok && !result.registration.skipped && (
              <p className="sdlg__warn">הרישום במסלחתק לא הושלם כרגע. הפנייה נשמרה כאן, והרישום ינוסה שוב.</p>
            )}
            {result.reused && <p className="sdlg__line">נמצאה שליחה קודמת ללקוח שעוד לא נענתה, ולכן נשלח אותו תיק.</p>}
            {result.outcomes.map((o) =>
              o.state === "sent" ? (
                <p className="sdlg__ok" key={o.channel}>
                  <AdminIcon name="check" /> {o.channel === "whatsapp" ? "נשלח בווטסאפ העסקי" : "נשלח במייל"}
                  {o.to && (
                    <>
                      {" "}
                      <bdi dir="ltr">{o.to}</bdi>
                    </>
                  )}
                </p>
              ) : o.state === "prepared" && o.href ? (
                <div className="sdlg__finish" key={o.channel}>
                  <a className={`sdlg__go${o.channel === "whatsapp" ? " sdlg__go--wa" : ""}`} href={o.href} target="_blank" rel="noopener noreferrer">
                    <AdminIcon name={o.channel === "whatsapp" ? "message" : "mail"} size={20} />
                    <span>{o.channel === "whatsapp" ? "פתיחה בווטסאפ ושליחה" : "פתיחה במייל ושליחה"}</span>
                  </a>
                  <p className="sdlg__note">{o.detail}</p>
                </div>
              ) : (
                <p className="sdlg__line" key={o.channel}>
                  {o.detail}
                </p>
              ),
            )}
            <div className="sdlg__link">
              <span className="sdlg__link-label">הקישור האישי של הלקוח</span>
              <div className="sdlg__link-row">
                <code dir="ltr">{result.link}</code>
                <button type="button" className="map-btn" onClick={() => copyText(result.link)}>
                  {copied ? "הועתק" : "העתקה"}
                </button>
              </div>
            </div>
            <div className="sdlg__foot">
              <Link className="map-btn map-btn--primary" href={`/admin/${result.id}`}>
                פתיחת התיק
              </Link>
              <button type="button" className="map-btn" onClick={() => ref.current?.close()}>
                סיום
              </button>
            </div>
          </div>
        ) : (
          <div className="sdlg__done">
            <p className="adm__err" role="alert">
              {result.error}
            </p>
            <div className="sdlg__foot">
              <button type="button" className="map-btn map-btn--primary" onClick={() => setResult(null)}>
                חזרה
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
