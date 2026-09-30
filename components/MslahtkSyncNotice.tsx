"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Mslahtk did not take this customer (or their answers) when it was tried. The
 * file is safe here; this says so, shows why, and tries again on one press.
 */
export default function MslahtkSyncNotice({
  submissionId,
  error,
  retry,
}: {
  submissionId: string;
  error: string;
  retry: (submissionId: string) => Promise<{ ok: true; note: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onRetry() {
    setBusy(true);
    setMessage(null);
    try {
      const out = await retry(submissionId);
      setMessage({ ok: out.ok, text: out.ok ? out.note : out.error });
      if (out.ok) router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm__card adm__card--warn adm__card--tight" role="status">
      <p className="adm__muted">
        הרישום או העדכון במסלחתק לא הושלמו. הפנייה שמורה כאן במלואה, ואפשר לנסות שוב.{" "}
        <span dir="ltr" className="adm__muted">
          {error.slice(0, 160)}
        </span>
      </p>
      <div className="adm__linkbar">
        <button type="button" className="adm__btn adm__btn--sm" onClick={onRetry} disabled={busy}>
          {busy ? "מנסה…" : "ניסיון חוזר"}
        </button>
        {message && <span className={message.ok ? "adm__yes" : "adm__err"}>{message.text}</span>}
      </div>
    </div>
  );
}
