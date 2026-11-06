"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminIcon from "@/components/AdminIcon";
import { CASES, FORMS, agencyMustFill, formAudience, getForm, identityField, opensFromLinkOnly, prefillableFields, publicForms, type FormDef } from "@/lib/forms";
import type { SendOutcome } from "@/lib/send-types";
import { SITE } from "@/lib/site";
import SendDialog, { type Contact, type SendItem } from "./SendDialog";

/** The back-office "send" button, handed in by the page that sits under the admin session. */
export type SendFormAction = (input: {
  slug: string;
  kind?: "form" | "simulator";
  name?: string;
  phone?: string;
  email?: string;
  channels?: string[];
  /** What the agent filled in for the customer, by field name (only the fields a form marks `agencyFills`). */
  prefill?: Record<string, string>;
}) => Promise<SendOutcome>;

type Card = SendItem & {
  id: string;
  eyebrow: string;
  /** One line under the title: what it does, or what sending it needs. */
  hint?: string;
  /** The office page that fills it with the customer present. */
  fillPath: string;
  /** The page the customer sees, for a look before sending. */
  previewPath: string;
};

/**
 * The back-office forms hub: every calculator and form the agency gives
 * customers, each with two ways to use it (owner, 2026-11-06). "Fill now" opens
 * it in the office with the customer beside the agent, no link sent; "Send to
 * the customer" opens a pop-up that sends it over WhatsApp or email, or copies
 * the link. The customer's details are typed once, at the top, and go with
 * either.
 */
export default function FormLinks({ send }: { send: SendFormAction }) {
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "" });
  const [sending, setSending] = useState<Card | null>(null);
  // The site's own address for the first render (server and browser agree, so
  // hydration matches), then the host this page is really open on.
  const [origin, setOrigin] = useState<string>(SITE.url);
  useEffect(() => setOrigin(window.location.origin), []);

  function formCard(form: FormDef): Card {
    const linkOnly = opensFromLinkOnly(form);
    const mustGive = agencyMustFill(form);
    const notes = [
      ...(form.quote ? ["בודק את המחיר בכל חברות הביטוח, כולל ההנחות הנוכחיות, והלקוח רואה רק את הנמוך"] : []),
      ...(linkOnly ? ["נשלח ללקוח כקישור אישי בלבד"] : []),
      ...(mustGive.length ? [`לפני שליחה מזינים: ${mustGive.map((f) => f.label).join(", ")}`] : []),
    ];
    return {
      id: form.slug,
      slug: form.slug,
      kind: "form",
      title: form.title,
      eyebrow: form.eyebrow,
      hint: notes.join(" · ") || undefined,
      linkOnly,
      publicUrl: `${origin}/forms/${form.slug}`,
      fillPath: `/admin/fill/${form.slug}`,
      previewPath: `/forms/${form.slug}`,
    };
  }

  const forms = publicForms();
  const calculators: Card[] = [
    ...CASES.filter((c) => c.simulatorPath).map(
      (c): Card => ({
        id: `sim-${c.key}`,
        slug: c.request,
        kind: "simulator",
        title: c.simulatorTitle ?? "מחשבון ביטוח דירה",
        // Its name is close to its request form's: the eyebrow says which one is the calculator.
        eyebrow: "מחשבון",
        hint: "הערכת מחיר מיידית לביטוח הדירה, וממנה טופס בקשה עם כל הנתונים",
        linkOnly: false,
        publicUrl: `${origin}${c.simulatorPath}`,
        fillPath: `/admin/fill/calculator/${c.key}`,
        previewPath: c.simulatorPath!,
      }),
    ),
    ...forms.filter((f) => f.quote).map(formCard),
  ];
  const others = forms.filter((f) => !f.quote).map(formCard);
  // Forms that only exist inside a case: named here so nobody looks for them.
  const caseOnly = FORMS.filter((f) => formAudience(f) === "agency" || f.requiresToken);

  /** The office page with the customer's details already in the form, each under that form's own field name. */
  function fillHref(card: Card) {
    const form = getForm(card.slug);
    const q = new URLSearchParams();
    if (form) {
      const keys = new Set(prefillableFields(form));
      const nameKey = identityField(form, "name")?.name;
      if (nameKey && contact.name.trim()) q.set(nameKey, contact.name.trim());
      if (keys.has("phone") && contact.phone.trim()) q.set("phone", contact.phone.trim());
      if (keys.has("email") && contact.email.trim()) q.set("email", contact.email.trim());
    }
    const qs = q.toString();
    return `${card.fillPath}${qs ? `?${qs}` : ""}`;
  }

  // A plain function, not a component: a component defined inside a component is
  // a new type on every render, which would remount the cards.
  function renderCard(card: Card) {
    return (
      <li className="hub__card" key={card.id}>
        <div className="hub__card-text">
          <span className="hub__eyebrow">{card.eyebrow}</span>
          <h3 className="hub__title">{card.title}</h3>
          {card.hint && <p className="hub__hint">{card.hint}</p>}
        </div>
        <div className="hub__actions">
          <Link className="hub__btn hub__btn--fill" href={fillHref(card)}>
            <AdminIcon name="pencil" size={18} />
            <span>מילוי עכשיו</span>
          </Link>
          <button type="button" className="hub__btn hub__btn--send" onClick={() => setSending(card)}>
            <AdminIcon name="send" size={18} />
            <span>שליחה ללקוח</span>
          </button>
          <a className="hub__btn hub__btn--look" href={card.previewPath} target="_blank" rel="noopener noreferrer" title="תצוגה מקדימה" aria-label={`תצוגה מקדימה: ${card.title}`}>
            <AdminIcon name="eye" size={18} />
          </a>
        </div>
      </li>
    );
  }

  return (
    <div className="hub">
      <section className="hub__client" aria-labelledby="hub-client">
        <div className="hub__client-head">
          <AdminIcon name="user" size={18} />
          <h2 className="hub__h" id="hub-client">
            פרטי הלקוח
          </h2>
        </div>
        <p className="hub__sub">נכנסים לטופס כשממלאים כאן, ולקישור כששולחים. אפשר גם להשאיר ריק ולמלא בתוך הטופס.</p>
        <div className="hub__fields">
          <div className="field">
            <label htmlFor="fl-name">שם הלקוח</label>
            <input id="fl-name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="ישראל ישראלי" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="fl-phone">טלפון</label>
            <input id="fl-phone" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="050-0000000" dir="ltr" inputMode="tel" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="fl-email">דוא״ל (לא חובה)</label>
            <input id="fl-email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder="name@example.com" dir="ltr" inputMode="email" autoComplete="off" />
          </div>
        </div>
      </section>

      <section className="hub__group" aria-labelledby="hub-calc">
        <h2 className="hub__h hub__group-h" id="hub-calc">
          <AdminIcon name="calculator" size={18} />
          מחשבונים ובדיקות מחיר
        </h2>
        <ul className="hub__list">{calculators.map(renderCard)}</ul>
      </section>

      <section className="hub__group" aria-labelledby="hub-forms">
        <h2 className="hub__h hub__group-h" id="hub-forms">
          <AdminIcon name="file" size={18} />
          טפסים
        </h2>
        <ul className="hub__list">{others.map(renderCard)}</ul>
      </section>

      {caseOnly.length > 0 && <p className="hub__caseonly">נשלחים מתוך התיק בניהול, לא מכאן: {caseOnly.map((f) => `${f.eyebrow} (${f.title})`).join(" · ")}.</p>}

      {sending && <SendDialog item={sending} contact={contact} onContact={setContact} send={send} onClose={() => setSending(null)} />}
    </div>
  );
}
