"use client";

import { useMemo, useState } from "react";
import type { ResendResult } from "@/app/admin/actions";
import { SITE } from "@/lib/site";

export type ResendField = { name: string; label: string; section: string; value: string };

/**
 * Pick what the customer may change, hand out the link.
 *
 * Everything starts LOCKED. A re-send exists because one or two answers were
 * wrong; unlocking the whole form invites a customer to retype forty correct
 * answers and get one of those wrong instead. So the agent opens exactly what
 * needs fixing, and the rest travels back untouched and signed.
 */
export default function ResendBuilder({
  leadId,
  fields,
  phone,
  customerName,
  formTitle,
  build: buildLink,
}: {
  leadId: string;
  fields: ResendField[];
  phone: string | null;
  customerName: string | null;
  formTitle: string;
  /** Server action — posts under /admin, where the session cookie lives. */
  build: (leadId: string, locked: string[]) => Promise<ResendResult>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sections = useMemo(() => {
    const by = new Map<string, ResendField[]>();
    for (const f of fields) {
      const list = by.get(f.section) || [];
      list.push(f);
      by.set(f.section, list);
    }
    return [...by.entries()];
  }, [fields]);

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setLink(null);
  }

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const locked = fields.map((f) => f.name).filter((n) => !open.has(n));
      const out = await buildLink(leadId, locked);
      if ("error" in out) throw new Error(out.error);
      setLink(out.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const waHref = useMemo(() => {
    if (!link || !phone) return null;
    const digits = phone.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
    const text = `שלום${customerName ? ` ${customerName}` : ""}, כאן ${SITE.brand}.\nנשמח לעדכון קצר בטופס "${formTitle}":\n${link}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }, [link, phone, customerName, formTitle]);

  return (
    <div className="adm__resend">
      <div className="adm__card adm__card--tight">
        <p className="adm__muted">
          כל השדות נעולים כברירת מחדל. סמנו רק את מה שהלקוח צריך לתקן — השאר
          יישלח חתום וללא אפשרות שינוי.
        </p>
        <p className="adm__muted">
          נפתחו לעריכה: <strong>{open.size}</strong> מתוך {fields.length}
        </p>
      </div>

      {sections.map(([title, list]) => (
        <section className="adm__section" key={title}>
          <h2 className="adm__sectiontitle">{title}</h2>
          <ul className="adm__picklist">
            {list.map((f) => (
              <li key={f.name}>
                <label className={`adm__pick${open.has(f.name) ? " is-open" : ""}`}>
                  <input
                    type="checkbox"
                    checked={open.has(f.name)}
                    onChange={() => toggle(f.name)}
                  />
                  <span className="adm__picklabel">{f.label}</span>
                  <span className="adm__pickvalue">{f.value}</span>
                  <span className="adm__pickstate">
                    {open.has(f.name) ? "ניתן לעריכה" : "נעול"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="adm__stickybar">
        <button className="adm__btn adm__btn--primary" onClick={build} disabled={busy}>
          {busy ? "מייצר…" : "יצירת קישור"}
        </button>
        {link && (
          <>
            <button
              className="adm__btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "הועתק ✓" : "העתקת קישור"}
            </button>
            {waHref && (
              <a className="adm__btn adm__btn--primary" href={waHref} target="_blank" rel="noopener noreferrer">
                שליחה בווטסאפ
              </a>
            )}
          </>
        )}
      </div>

      {error && <p className="adm__err">{error}</p>}
      {link && (
        <p className="adm__linkout" dir="ltr">
          {link}
        </p>
      )}
    </div>
  );
}
