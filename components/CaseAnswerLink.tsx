"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResendResult } from "@/app/admin/actions";
import { SITE } from "@/lib/site";

/**
 * Hand the customer form 3. One click mints the signed link (the offer's
 * numbers locked inside it), then it can be copied or sent over WhatsApp.
 */
export default function CaseAnswerLink({
  caseId,
  phone,
  customerName,
  build: buildLink,
}: {
  caseId: string;
  phone: string | null;
  customerName: string | null;
  build: (caseId: string) => Promise<ResendResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const out = await buildLink(caseId);
      if ("error" in out) throw new Error(out.error);
      setLink(out.url);
      router.refresh();
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
    const text = `שלום${customerName ? ` ${customerName}` : ""}, כאן ${SITE.brand}.\nהצעת ביטוח הדירה מוכנה. לאישור, לבקשת שינוי או לדחייה, מלאו וחתמו כאן:\n${link}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }, [link, phone, customerName]);

  return (
    <div>
      <div className="adm__linkbar">
        <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={build} disabled={busy}>
          {busy ? "מייצר…" : link ? "קישור חדש" : "יצירת קישור לטופס 3"}
        </button>
        {link && (
          <>
            <button
              className="adm__btn adm__btn--sm"
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
              {copied ? "הועתק ✓" : "העתקה"}
            </button>
            {waHref && (
              <a className="adm__btn adm__btn--sm" href={waHref} target="_blank" rel="noopener noreferrer">
                ווטסאפ
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
