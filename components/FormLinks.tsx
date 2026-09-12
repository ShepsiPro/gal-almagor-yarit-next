"use client";

import { useState } from "react";
import { FORMS, identityField } from "@/lib/forms";
import { SITE } from "@/lib/site";

/**
 * Internal helper for the agency: pick a form, optionally type the customer's
 * name and phone, and hand out the link over WhatsApp. The name/phone only
 * become query parameters that pre-fill the form — nothing is stored anywhere.
 */
export default function FormLinks() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : SITE.url;

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

  function waLink(slug: string, title: string) {
    const digits = phone.replace(/\D/g, "");
    // 05… → 9725…, so the chat opens on the right contact when a number is typed.
    const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
    const text = `שלום${name.trim() ? ` ${name.trim()}` : ""}, כאן ${SITE.brand}.\nלמילוי הטופס "${title}":\n${linkFor(slug)}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(linkFor(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flinks">
      <div className="flinks__prefill">
        <div className="field">
          <label htmlFor="fl-name">שם הלקוח (אופציונלי)</label>
          <input
            id="fl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ישראל ישראלי"
          />
        </div>
        <div className="field">
          <label htmlFor="fl-phone">טלפון הלקוח (אופציונלי)</label>
          <input
            id="fl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-0000000"
            dir="ltr"
          />
        </div>
      </div>

      <ul className="flinks__list">
        {FORMS.map((f) => (
          <li className="flinks__item" key={f.slug}>
            <div className="flinks__meta">
              <div className="crow__label">{f.eyebrow}</div>
              <div className="flinks__title">{f.title}</div>
              <code className="flinks__url" dir="ltr">
                /forms/{f.slug}
              </code>
            </div>
            <div className="flinks__actions">
              <a
                className="map-btn map-btn--primary"
                href={waLink(f.slug, f.title)}
                target="_blank"
                rel="noopener noreferrer"
              >
                שליחה בווטסאפ
              </a>
              <button type="button" className="map-btn" onClick={() => copy(f.slug)}>
                {copied === f.slug ? "הועתק ✓" : "העתקת קישור"}
              </button>
              <a className="map-btn" href={`/forms/${f.slug}`} target="_blank" rel="noopener noreferrer">
                תצוגה מקדימה
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
