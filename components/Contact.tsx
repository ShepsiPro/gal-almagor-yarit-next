"use client";

import { FormEvent } from "react";

const PHONE_DISPLAY = "053-337-7779";
const PHONE_E164 = "+972533377779";
const WA_NUMBER = "972533377779";
const EMAIL = "office@almagor-yaarit.com";
const ADDRESS = "קניון שלומי (תצפית)";

// "שלומי סנטר" (Tatzpit-owned) is how Google/Waze index this mall — routes precisely.
const MAPS_PLACE = "שלומי סנטר, שלומי";
// Embedded preview uses OpenStreetMap (keyless, frameable). Google retired its
// keyless iframe embed — maps.google.com/...&output=embed now returns 404 +
// X-Frame-Options: SAMEORIGIN, i.e. a blank frame. The navigate buttons below
// still deep-link to Google Maps / Waze for turn-by-turn routing.
const MAP_LAT = 33.0752; // קניון שלומי (תצפית) — כביש 899, סמוך לבניין המועצה
const MAP_LON = 35.1441;
const MAP_BBOX = "35.1391,33.0722,35.1491,33.0782";
const MAPS_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${MAP_BBOX}&layer=mapnik&marker=${MAP_LAT},${MAP_LON}`;
const MAPS_VIEW = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_PLACE)}`;
const MAPS_GOOGLE = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(MAPS_PLACE)}`;
const MAPS_WAZE = `https://waze.com/ul?q=${encodeURIComponent(MAPS_PLACE)}&navigate=yes`;

const CONTACT_ROWS: { label: string; value: string; href?: string; ltr?: boolean }[] = [
  { label: "טלפון", value: PHONE_DISPLAY, href: `tel:${PHONE_E164}`, ltr: true },
  { label: "ווטסאפ", value: PHONE_DISPLAY, href: `https://wa.me/${WA_NUMBER}`, ltr: true },
  { label: "דוא״ל", value: EMAIL, href: `mailto:${EMAIL}`, ltr: true },
  { label: "כתובת", value: ADDRESS, href: MAPS_VIEW },
  { label: "שעות", value: "ב׳–ה׳ 09:00–16:00 · ו׳ 09:00–13:00" },
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
                {r.href ? (
                  <a
                    className="crow__value crow__link"
                    href={r.href}
                    dir={r.ltr ? "ltr" : undefined}
                    target={r.href.startsWith("http") ? "_blank" : undefined}
                    rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {r.value}
                  </a>
                ) : (
                  <div className="crow__value">{r.value}</div>
                )}
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

      <div className="container contact__map-wrap">
        <div className="contact__map-bar">
          <div className="contact__map-where">
            <span className="crow__label">המשרד שלנו</span>
            <span className="contact__map-addr">{ADDRESS} · שלומי</span>
          </div>
          <div className="contact__map-actions">
            <a className="map-btn map-btn--primary" href={MAPS_GOOGLE} target="_blank" rel="noopener noreferrer">
              ניווט · Google&nbsp;Maps
            </a>
            <a className="map-btn" href={MAPS_WAZE} target="_blank" rel="noopener noreferrer">
              ניווט · Waze
            </a>
          </div>
        </div>
        <div className="contact__map">
          <iframe
            src={MAPS_EMBED}
            title={`מפת המשרד — ${ADDRESS}, שלומי`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
