"use client";

import { useState } from "react";
import { CASES, FORMS, formAudience, identityField, publicForms } from "@/lib/forms";
import { SITE } from "@/lib/site";

/**
 * Internal helper for the agency: pick a form, optionally type the customer's
 * name and phone, and hand out the link over WhatsApp. The name/phone only
 * become query parameters that pre-fill the form; nothing is stored here.
 */
export default function FormLinks() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : SITE.url;
  const forms = publicForms();
  // Forms that only exist inside a case: named here so nobody looks for them.
  const caseOnly = FORMS.filter((f) => formAudience(f) === "agency" || f.requiresToken);

  function linkFor(slug: string) {
    const q = new URLSearchParams();
    const form = FORMS.find((f) => f.slug === slug);
    // Each form spells its name field differently; ask it rather than guess.
    const nameKey = form && identityField(form, "name")?.name;
    if (nameKey && name.trim()) q.set(nameKey, name.trim());
    if (phone.trim()) q.set("phone", phone.trim());
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

  function Item({ id, eyebrow, title, path, url }: { id: string; eyebrow: string; title: string; path: string; url: string }) {
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
          <a className="map-btn map-btn--primary" href={waHref(url, title)} target="_blank" rel="noopener noreferrer">
            שליחה בווטסאפ
          </a>
          <button type="button" className="map-btn" onClick={() => copy(id, url)}>
            {copied === id ? "הועתק ✓" : "העתקת קישור"}
          </button>
          <a className="map-btn" href={path} target="_blank" rel="noopener noreferrer">
            תצוגה מקדימה
          </a>
        </div>
      </li>
    );
  }

  return (
    <div className="flinks">
      <div className="flinks__prefill">
        <div className="field">
          <label htmlFor="fl-name">שם הלקוח (אופציונלי)</label>
          <input id="fl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" />
        </div>
        <div className="field">
          <label htmlFor="fl-phone">טלפון הלקוח (אופציונלי)</label>
          <input id="fl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" dir="ltr" />
        </div>
      </div>

      <ul className="flinks__list">
        {CASES.filter((c) => c.simulatorPath).map((c) => (
          <Item
            key={`sim-${c.key}`}
            id={`sim-${c.key}`}
            eyebrow={c.title}
            title="מחשבון ביטוח דירה (הערכה ראשונית, ואז טופס הבקשה)"
            path={c.simulatorPath!}
            url={`${origin}${c.simulatorPath}`}
          />
        ))}
        {forms.map((f) => (
          <Item key={f.slug} id={f.slug} eyebrow={f.eyebrow} title={f.title} path={`/forms/${f.slug}`} url={linkFor(f.slug)} />
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
