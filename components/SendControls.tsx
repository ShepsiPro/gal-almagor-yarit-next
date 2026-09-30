"use client";

import { useState } from "react";
import type { Channel, SendOutcome } from "@/lib/send-types";

/**
 * The two pieces every "send to the customer" button shares: which of the
 * customer's channels to use (only the ones the customer gave us), and what
 * happened afterwards.
 */

/** The channels a contact has, all ticked: the default is to reach the customer every way we can. */
export function defaultChannels(phone?: string | null, email?: string | null): Channel[] {
  return [...(phone ? (["whatsapp"] as const) : []), ...(email ? (["email"] as const) : [])];
}

export function ChannelPicker({
  phone,
  email,
  value,
  onChange,
  disabled,
}: {
  phone?: string | null;
  email?: string | null;
  value: Channel[];
  onChange: (next: Channel[]) => void;
  disabled?: boolean;
}) {
  function toggle(c: Channel) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  }
  return (
    <div className="sendch" role="group" aria-label="באילו ערוצים לשלוח">
      <label className={`sendch__opt${phone ? "" : " is-off"}`}>
        <input type="checkbox" checked={value.includes("whatsapp") && Boolean(phone)} disabled={disabled || !phone} onChange={() => toggle("whatsapp")} />
        <span>ווטסאפ</span>
        <span className="sendch__to" dir="ltr">
          {phone || "אין טלפון"}
        </span>
      </label>
      <label className={`sendch__opt${email ? "" : " is-off"}`}>
        <input type="checkbox" checked={value.includes("email") && Boolean(email)} disabled={disabled || !email} onChange={() => toggle("email")} />
        <span>מייל</span>
        <span className="sendch__to" dir="ltr">
          {email || "אין דוא״ל"}
        </span>
      </label>
    </div>
  );
}

/** What a send did: registered or not, each channel's outcome, and a one-tap link where the system could not deliver. */
export function SendReport({ result, btn = "adm__btn adm__btn--sm" }: { result: SendOutcome | null; btn?: string }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  if (!result.ok) {
    return (
      <p className="adm__err" role="alert">
        {result.error}
      </p>
    );
  }

  const reg = result.registration;
  return (
    <div className="sendrep" role="status">
      {reg?.ok && <p className="sendrep__line sendrep__line--ok">נרשם במסלחתק ✓ הלקוח והתיק שלו כבר שם</p>}
      {reg && !reg.ok && !reg.skipped && (
        <p className="sendrep__line sendrep__line--warn">
          הרישום במסלחתק לא הושלם כרגע, והשליחה עצמה נמשכת. ננסה שוב בעת הבאה, ובכל מקרה הפנייה נשמרת כאן.
        </p>
      )}
      {result.reused && !reg && <p className="sendrep__line">נמצאה שליחה קודמת ללקוח שעדיין לא נענתה. נשלח אותו תיק, לא נפתח תיק נוסף.</p>}

      {result.outcomes.map((o) => (
        <div key={o.channel} className={`sendrep__row sendrep__row--${o.state}`}>
          <span className="sendrep__what">
            {o.state === "sent" ? "✓ " : ""}
            {o.channel === "whatsapp" ? "ווטסאפ" : "מייל"}
            {o.to && (
              <>
                {" "}
                <bdi dir="ltr">{o.to}</bdi>
              </>
            )}
            : {o.detail}
          </span>
          {o.state === "prepared" && o.href && (
            <a className={btn} href={o.href} target="_blank" rel="noopener noreferrer">
              {o.channel === "whatsapp" ? "פתיחה בווטסאפ" : "פתיחה במייל"}
            </a>
          )}
        </div>
      ))}

      <div className="sendrep__link">
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "הועתק ✓" : "העתקת הקישור"}
        </button>
        <span className="adm__linkout" dir="ltr">
          {result.link}
        </span>
      </div>
    </div>
  );
}
