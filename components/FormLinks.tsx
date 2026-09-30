"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CASES, FORMS, formAudience, identityField, publicForms } from "@/lib/forms";
import type { SendOutcome } from "@/lib/send-types";
import { SITE } from "@/lib/site";
import { SendReport } from "./SendControls";

/** The back-office "send" button, handed in by the page that sits under the admin session. */
export type SendFormAction = (input: {
  slug: string;
  kind?: "form" | "simulator";
  name?: string;
  phone?: string;
  email?: string;
  channels?: string[];
}) => Promise<SendOutcome>;

/**
 * The agency's "send a form" tool: pick a form, type the customer's details,
 * send.
 *
 * In the back-office (`send` given) the customer is registered in Mslahtk the
 * moment the form is sent, and the link goes out over WhatsApp and/or email by
 * itself where the system can, or opens ready to send by hand where it cannot.
 * On the public /forms page (no `send`, no session) it stays what it always
 * was: a link builder whose name and phone only become query parameters, with
 * nothing stored and nothing registered.
 */
export default function FormLinks({ send }: { send?: SendFormAction }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wantWhatsapp, setWantWhatsapp] = useState(true);
  const [wantEmail, setWantEmail] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SendOutcome | undefined>>({});

  // The site's own address for the first render (server and browser agree, so
  // hydration matches), then the host this page is really open on.
  const [origin, setOrigin] = useState<string>(SITE.url);
  useEffect(() => setOrigin(window.location.origin), []);
  const forms = publicForms();
  // Forms that only exist inside a case: named here so nobody looks for them.
  const caseOnly = FORMS.filter((f) => formAudience(f) === "agency" || f.requiresToken);

  const hasContact = Boolean(phone.trim() || email.trim());
  const channels = [...(wantWhatsapp && phone.trim() ? (["whatsapp"] as const) : []), ...(wantEmail && email.trim() ? (["email"] as const) : [])];

  function linkFor(slug: string) {
    const q = new URLSearchParams();
    const form = FORMS.find((f) => f.slug === slug);
    // Each form spells its name field differently; ask it rather than guess.
    const nameKey = form && identityField(form, "name")?.name;
    if (nameKey && name.trim()) q.set(nameKey, name.trim());
    if (phone.trim()) q.set("phone", phone.trim());
    if (email.trim()) q.set("email", email.trim());
    const qs = q.toString();
    return `${origin}/forms/${slug}${qs ? `?${qs}` : ""}`;
  }

  function waHref(url: string, title: string) {
    const digits = phone.replace(/\D/g, "");
    // 05… → 9725…, so the chat opens on the right contact when a number is typed.
    const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
    const text = `שלום${name.trim() ? ` ${name.trim()}` : ""}, כאן ${SITE.brand}.\nלמילוי הטופס "${title}":\n${url}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }

  async function copy(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  /** Back-office: register the customer, then send (or, with `copyOnly`, just hand back the link). */
  async function sendItem(key: string, slug: string, kind: "form" | "simulator", copyOnly: boolean) {
    if (!send) return;
    setBusy(`${key}:${copyOnly ? "copy" : "send"}`);
    try {
      const request = send({ slug, kind, name, phone, email, channels: copyOnly ? [] : channels });
      // Safari and iOS take back the click's permission to use the clipboard
      // once anything is awaited, so the clipboard is handed the PROMISE of the
      // link now, not the link later. A browser that cannot do that copies after
      // the wait, and the result below always carries its own copy button.
      const promised =
        copyOnly && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
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
      setResults((r) => ({ ...r, [key]: out }));
      if (copyOnly && out.ok) {
        if (await promised) {
          setCopied(key);
          setTimeout(() => setCopied(null), 2000);
        } else {
          await copy(key, out.link);
        }
      }
    } catch (err) {
      setResults((r) => ({ ...r, [key]: { ok: false, error: err instanceof Error ? err.message : String(err) } }));
    } finally {
      setBusy(null);
    }
  }

  function Item({ id, eyebrow, title, slug, kind }: { id: string; eyebrow: string; title: string; slug: string; kind: "form" | "simulator" }) {
    const path = kind === "simulator" ? (CASES.find((c) => c.request === slug)?.simulatorPath ?? `/forms/${slug}`) : `/forms/${slug}`;
    const plain = kind === "simulator" ? `${origin}${path}` : linkFor(slug);
    const result = results[id];
    return (
      <li className="flinks__item">
        <div className="flinks__meta">
          <div className="crow__label">{eyebrow}</div>
          <div className="flinks__title">{title}</div>
          <code className="flinks__url" dir="ltr">
            {path}
          </code>
        </div>
        <div className="flinks__actions">
          {send ? (
            <>
              <button
                type="button"
                className="map-btn map-btn--primary"
                disabled={busy !== null || !hasContact || channels.length === 0}
                title={!hasContact ? "יש להזין טלפון או דוא״ל של הלקוח" : channels.length === 0 ? "יש לסמן לפחות ערוץ שליחה אחד" : undefined}
                onClick={() => sendItem(id, slug, kind, false)}
              >
                {busy === `${id}:send` ? "שולח…" : "שליחה ללקוח"}
              </button>
              {hasContact ? (
                <button type="button" className="map-btn" disabled={busy !== null} onClick={() => sendItem(id, slug, kind, true)}>
                  {copied === id ? "הועתק ✓" : busy === `${id}:copy` ? "מייצר…" : "העתקת קישור אישי"}
                </button>
              ) : (
                <button type="button" className="map-btn" onClick={() => copy(id, plain)} title="קישור כללי: לא נרשם במסלחתק עד שהלקוח ימלא">
                  {copied === id ? "הועתק ✓" : "העתקת קישור כללי"}
                </button>
              )}
            </>
          ) : (
            <>
              <a className="map-btn map-btn--primary" href={waHref(plain, title)} target="_blank" rel="noopener noreferrer">
                שליחה בווטסאפ
              </a>
              <button type="button" className="map-btn" onClick={() => copy(id, plain)}>
                {copied === id ? "הועתק ✓" : "העתקת קישור"}
              </button>
            </>
          )}
          <a className="map-btn" href={path} target="_blank" rel="noopener noreferrer">
            תצוגה מקדימה
          </a>
        </div>
        {result && (
          <div className="flinks__result">
            <SendReport result={result} btn="map-btn" />
            {result.ok && (
              <Link className="map-btn" href={`/admin/${result.id}`}>
                פתיחת התיק
              </Link>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="flinks">
      <div className="flinks__prefill">
        <div className="field">
          <label htmlFor="fl-name">שם הלקוח{send ? "" : " (אופציונלי)"}</label>
          <input id="fl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="fl-phone">טלפון הלקוח{send ? "" : " (אופציונלי)"}</label>
          <input id="fl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" dir="ltr" inputMode="tel" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="fl-email">דוא״ל הלקוח (אופציונלי)</label>
          <input id="fl-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" inputMode="email" autoComplete="off" />
        </div>
        {send && (
          <div className="flinks__channels">
            <span className="flinks__channels-label">לשלוח דרך</span>
            <label className={`sendch__opt${phone.trim() ? "" : " is-off"}`}>
              <input type="checkbox" checked={wantWhatsapp && Boolean(phone.trim())} disabled={!phone.trim()} onChange={(e) => setWantWhatsapp(e.target.checked)} />
              <span>ווטסאפ</span>
            </label>
            <label className={`sendch__opt${email.trim() ? "" : " is-off"}`}>
              <input type="checkbox" checked={wantEmail && Boolean(email.trim())} disabled={!email.trim()} onChange={(e) => setWantEmail(e.target.checked)} />
              <span>מייל</span>
            </label>
            <span className="flinks__channels-note">
              {hasContact ? "הלקוח נרשם במסלחתק ברגע השליחה, עוד לפני שפתח את הטופס." : "יש להזין טלפון או דוא״ל כדי לשלוח ולרשום את הלקוח."}
            </span>
          </div>
        )}
      </div>

      <ul className="flinks__list">
        {CASES.filter((c) => c.simulatorPath).map((c) => (
          <Item
            key={`sim-${c.key}`}
            id={`sim-${c.key}`}
            eyebrow={c.title}
            title="מחשבון ביטוח דירה (הערכה ראשונית, ואז טופס הבקשה)"
            slug={c.request}
            kind="simulator"
          />
        ))}
        {forms.map((f) => (
          <Item key={f.slug} id={f.slug} eyebrow={f.eyebrow} title={f.title} slug={f.slug} kind="form" />
        ))}
      </ul>

      {caseOnly.length > 0 && (
        <p className="form__note" style={{ marginTop: 18 }}>
          נשלחים מתוך התיק בניהול, לא מכאן: {caseOnly.map((f) => `${f.eyebrow} (${f.title})`).join(" · ")}.
        </p>
      )}
    </div>
  );
}
