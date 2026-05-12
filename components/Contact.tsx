"use client";

import { FormEvent } from "react";

const CONTACT_ROWS = [
  { label: "טלפון",  value: "04-XXX-XXXX" },
  { label: "ווטסאפ", value: "050-XXX-XXXX" },
  { label: "דוא״ל",  value: "office@galalmagor-yarit.co.il" },
  { label: "כתובת",  value: "שלומי, הגליל המערבי" },
  { label: "שעות",   value: "א׳–ה׳ 09:00–18:00 · ו׳ 09:00–13:00" },
];

const TOPICS = [
  "ביטוח רכב",
  "ביטוח דירה",
  "ביטוח עסקים",
  "ביטוחי חיים ובריאות",
  "תכנון פרישה",
  "פיננסים",
  "תיק ביטוח כולל",
];

export default function Contact({ defaultTopic = "" }: { defaultTopic?: string } = {}) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    alert("תודה! נחזור אליך בקרוב.");
  }

  return (
    <section id="contact" className="contact">
      <div className="container contact__grid">
        <div>
          <div className="eyebrow">צרו קשר</div>
          <h2 className="section__title">
            פגישת היכרות
            <br />
            <em>ללא עלות וללא התחייבות.</em>
          </h2>
          <p className="contact__lede">
            השאירו פרטים ונחזור אליכם תוך יום עסקים אחד. אפשר גם לקפוץ למשרד בשלומי או להתקשר ישירות.
          </p>

          <div className="contact__rows">
            {CONTACT_ROWS.map((r) => (
              <div className="crow" key={r.label}>
                <div className="crow__label">{r.label}</div>
                <div className="crow__value">{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="cf-name">שם מלא</label>
            <input id="cf-name" type="text" placeholder="ישראל ישראלי" />
          </div>
          <div className="field">
            <label htmlFor="cf-tel">טלפון</label>
            <input id="cf-tel" type="tel" placeholder="050-0000000" />
          </div>
          <div className="field">
            <label htmlFor="cf-email">דוא״ל</label>
            <input id="cf-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="cf-topic">תחום הביטוח</label>
            <select key={defaultTopic} id="cf-topic" defaultValue={defaultTopic}>
              <option value="" disabled>בחרו תחום…</option>
              {TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cf-msg">הודעה (אופציונלי)</label>
            <textarea id="cf-msg" placeholder="ספרו בקצרה על הצורך…" />
          </div>
          <button type="submit" className="form__submit">
            שליחה לסוכנות
          </button>
          <div className="form__note">הפרטים מוגנים ונשמרים אצלנו בלבד</div>
        </form>
      </div>
    </section>
  );
}
