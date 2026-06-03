"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Frizbi "bafi" insurance simulator, embedded in referrer-frame mode.
 *
 * Each referrer_id is registered against a specific domain inside Frizbi:
 *   195 → www.almagor-yaarit.com      (production)
 *   196 → almagor-yaarit.mslahtk.ai   (development / preview)
 * We resolve the id from the live hostname so the embed keeps working in both
 * environments without a manual edit before launch. Unknown hosts (localhost,
 * other previews) fall back to the dev id.
 */
const FRIZBI_BASE =
  "https://frizbi.co.il/?url_mode=referrer_frame&group_id=889&project=bafi&referrer_id=";

function referrerIdFor(hostname: string): "195" | "196" {
  const h = hostname.toLowerCase();
  if (h === "www.almagor-yaarit.com" || h === "almagor-yaarit.com") return "195";
  return "196";
}

export default function Quote() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  // Resolve the right referrer_id on the client (it depends on the live host).
  // Rendering the iframe only after this also keeps lazy-loading honest.
  useEffect(() => {
    setSrc(FRIZBI_BASE + referrerIdFor(window.location.hostname));
  }, []);

  // If Frizbi reports its content height, grow the frame to fit so there is no
  // inner scrollbar. The fixed CSS height is the reliable fallback otherwise.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://frizbi.co.il") return;
      const d = e.data;
      let h: number | undefined;
      if (typeof d === "number") {
        h = d;
      } else if (d && typeof d === "object") {
        const rec = d as Record<string, unknown>;
        const c = rec.height ?? rec.frameHeight ?? rec.iframeHeight;
        if (typeof c === "number") h = c;
        else if (typeof c === "string" && /^\d+$/.test(c)) h = parseInt(c, 10);
      }
      if (h && h > 200 && h < 20000 && iframeRef.current) {
        iframeRef.current.style.height = `${h}px`;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section id="quote" className="section section--bordered quote">
      <div className="container">
        <div className="section__head">
          <div>
            <div className="eyebrow">הצעת מחיר אונליין</div>
            <h2 className="section__title section__title--md">
              סימולטור ביטוח.
              <br />
              <em>הצעה ראשונית תוך דקות.</em>
            </h2>
          </div>
          <p className="section__lede">
            מלאו את הפרטים בסימולטור והמערכת תפיק עבורכם הצעת מחיר ראשונית, ללא
            התחייבות. מעדיפים ליווי אישי?{" "}
            <a href="#contact" className="quote__link">השאירו פרטים</a> ונחזור אליכם.
          </p>
        </div>

        <div className="quote__frame">
          {src ? (
            <iframe
              ref={iframeRef}
              src={src}
              title="סימולטור ביטוח — קבלת הצעת מחיר"
              className="quote__iframe"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="quote__placeholder">טוען סימולטור…</div>
          )}
        </div>

        {src && (
          <p className="quote__fallback">
            הסימולטור לא נטען?{" "}
            <a href={src} target="_blank" rel="noopener noreferrer">
              פתחו אותו בכרטיסייה חדשה ←
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
