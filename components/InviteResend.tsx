"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, SendOutcome } from "@/lib/send-types";
import { ChannelPicker, SendReport, defaultChannels } from "./SendControls";

/**
 * A form the agency sent and the customer has not filled yet: send it again.
 * It is the same file and the same Mslahtk lead, with a fresh link; nothing new
 * is opened.
 */
export default function InviteResend({
  submissionId,
  phone,
  email,
  send,
}: {
  submissionId: string;
  phone: string | null;
  email: string | null;
  send: (submissionId: string, channels: string[]) => Promise<SendOutcome>;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>(() => defaultChannels(phone, email));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setBusy(true);
    setError(null);
    try {
      setResult(await send(submissionId, channels));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sendbox">
      <ChannelPicker phone={phone} email={email} value={channels} onChange={setChannels} disabled={busy} />
      <div className="adm__linkbar">
        <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={onSend} disabled={busy || channels.length === 0}>
          {busy ? "שולח…" : "שליחה חוזרת"}
        </button>
      </div>
      {error && <p className="adm__err">{error}</p>}
      <SendReport result={result} />
    </div>
  );
}
