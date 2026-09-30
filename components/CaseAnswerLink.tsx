"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResendResult } from "@/app/admin/actions";
import type { Channel, SendOutcome } from "@/lib/send-types";
import { ChannelPicker, SendReport, defaultChannels } from "./SendControls";

/**
 * Hand the customer form 3. "Send to the customer" mints the signed link (the
 * offer's numbers and the customer's ID locked inside it) and sends it to the
 * phone and email the customer wrote in form 1; where the system cannot
 * deliver (WhatsApp outside its 24-hour window, mail not yet connected) the
 * agent gets a one-tap way to finish by hand. The plain copy-the-link button
 * stays for anyone who prefers to paste it themselves.
 */
export default function CaseAnswerLink({
  caseId,
  phone,
  email,
  build: buildLink,
  send,
}: {
  caseId: string;
  phone: string | null;
  email: string | null;
  build: (caseId: string) => Promise<ResendResult>;
  send: (caseId: string, channels: string[]) => Promise<SendOutcome>;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>(() => defaultChannels(phone, email));
  const [busy, setBusy] = useState<"send" | "copy" | null>(null);
  const [result, setResult] = useState<SendOutcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = channels.length > 0;

  async function onSend() {
    setBusy("send");
    setError(null);
    try {
      setResult(await send(caseId, channels));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onCopy() {
    setBusy("copy");
    setError(null);
    try {
      const out = await buildLink(caseId);
      if ("error" in out) throw new Error(out.error);
      await navigator.clipboard.writeText(out.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sendbox">
      {phone || email ? (
        <ChannelPicker phone={phone} email={email} value={channels} onChange={setChannels} disabled={busy !== null} />
      ) : (
        <p className="adm__muted">בטופס 1 לא נמסרו טלפון או דוא״ל. אפשר להעתיק את הקישור ולשלוח בכל דרך.</p>
      )}
      <div className="adm__linkbar">
        <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={onSend} disabled={busy !== null || !canSend}>
          {busy === "send" ? "שולח…" : "שליחה ללקוח"}
        </button>
        <button className="adm__btn adm__btn--sm" onClick={onCopy} disabled={busy !== null}>
          {copied ? "הועתק ✓" : busy === "copy" ? "מייצר…" : "העתקת קישור"}
        </button>
      </div>
      {error && <p className="adm__err">{error}</p>}
      <SendReport result={result} />
    </div>
  );
}
