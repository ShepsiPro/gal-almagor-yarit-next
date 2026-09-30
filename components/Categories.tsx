"use client";

import Link from "next/link";
import { useState } from "react";
import LineArt, { type LineKind } from "@/components/LineArt";

const CATEGORIES: { id: LineKind; sub: string; title: string; desc: string; bullets: string[] }[] = [
  {
    id: "car",
    sub: "חובה, מקיף וצד ג׳",
    title: "ביטוח רכב",
    desc: "כיסוי מלא לרכב הפרטי או המשפחתי, כולל גרירה, רכב חלופי וכיסוי לנהגים צעירים. השוואת הצעות מכל החברות המובילות.",
    bullets: ["ביטוח חובה", "ביטוח מקיף", "צד ג׳ מורחב", "רכב חלופי"],
  },
  {
    id: "home",
    sub: "מבנה ותכולה",
    title: "ביטוח דירה",
    desc: "הגנה מקיפה על הבית והרכוש שבו, מפני נזקי טבע, גניבה, שריפה ומים. התאמה מדויקת לשווי ולסיכוני האזור.",
    bullets: ["ביטוח מבנה", "ביטוח תכולה", "צד ג׳ למבנה", "כיסוי תכשיטים"],
  },
  {
    id: "business",
    sub: "פתרונות לעסק שלכם",
    title: "ביטוח עסקים",
    desc: "ליווי צמוד לעסקים קטנים, בינוניים וגדולים. ביטוח רכוש, אחריות מקצועית, חבות מעבידים וסייבר, בהתאמה לענף.",
    bullets: ["רכוש עסקי", "חבות מעבידים", "אחריות מקצועית", "ביטוח סייבר"],
  },
  {
    id: "life",
    sub: "ביטחון למשפחה",
    title: "ביטוחי חיים ובריאות",
    desc: "תוכניות מותאמות אישית לכל שלב בחיים: ביטוח חיים, מחלות קשות, סיעוד וביטוחי בריאות פרטיים מהחברות המובילות.",
    bullets: ["ביטוח חיים", "מחלות קשות", "סיעוד", "בריאות פרטי"],
  },
  {
    id: "retirement",
    sub: "פנסיה וגמל",
    title: "תכנון פרישה",
    desc: "ניתוח מצב פנסיוני, אופטימיזציה של קופות גמל וקרנות השתלמות, ובניית תוכנית פרישה ארוכת טווח. ייעוץ אובייקטיבי.",
    bullets: ["פנסיה", "קופות גמל", "קרנות השתלמות", "ניהול תיקי השקעות"],
  },
  {
    id: "finance",
    sub: "ניהול הון משפחתי",
    title: "פיננסים",
    desc: "ייעוץ פיננסי כולל: משכנתאות, הלוואות, חיסכון לטווח ארוך והשקעות. בנייה של תמונה כלכלית בהירה למשפחה ולעסק.",
    bullets: ["משכנתאות", "ניהול חוב", "חיסכון", "השקעות"],
  },
];

/**
 * "What are you insuring?" The six lines as a list; pointing at (or tabbing
 * to) one opens its sheet beside the list, with its drawing under the gold
 * coverage roof. Below 1025px there is no room for a sheet, so every line is a
 * plain row with its drawing as a thumbnail, and a tap goes to its page.
 */
export default function Categories() {
  const [active, setActive] = useState(0);

  // A touch screen has no hover, but a tap still fires an emulated one just
  // before the click, so hover is only listened to where a pointer can really
  // hover. Where the sheet sits beside the list, the first tap on a line then
  // opens its sheet (the button inside goes to the page), the second follows it.
  function onHover(index: number) {
    if (window.matchMedia("(hover: hover)").matches) setActive(index);
  }
  // Tabbing to a line opens its sheet. A click or tap also focuses the link,
  // and that must not count: the tap logic below has to see the line as it was.
  function onFocusLine(e: React.FocusEvent<HTMLElement>, index: number) {
    let byKeyboard = true;
    try {
      byKeyboard = e.currentTarget.matches(":focus-visible");
    } catch {
      /* a browser without :focus-visible: treat every focus as the keyboard's */
    }
    if (byKeyboard) setActive(index);
  }
  function onTap(e: React.MouseEvent, index: number) {
    if (index !== active && window.matchMedia("(min-width: 1025px) and (hover: none)").matches) {
      e.preventDefault();
      setActive(index);
    }
  }

  return (
    <section id="categories" className="section section--bordered" aria-labelledby="lines-title">
      <div className="container">
        <div className="section__head">
          <div>
            <div className="eyebrow">תחומי הליווי</div>
            <h2 className="section__title" id="lines-title">
              שישה תחומים.
              <br />
              <em>תיק ביטוח אחד שלם.</em>
            </h2>
          </div>
          <p className="section__lede">
            במקום לפזר את הביטוחים בין סוכנים שונים, אצלנו כל התחומים מנוהלים תחת קורת גג אחת, עם איש קשר אישי שמכיר
            אתכם, את העסק ואת המשפחה. כך רואים את התמונה השלמה ומונעים כפילויות וחורים בכיסוי.
          </p>
        </div>

        <div className="lines__body">
          <p className="lines__ask" id="lines-ask">
            מה מבטחים?
          </p>
          <ul className="lines__list" aria-labelledby="lines-ask">
            {CATEGORIES.map((c, i) => (
              <li key={c.id} className={`line${i === active ? " is-active" : ""}`} onMouseEnter={() => onHover(i)}>
                <Link href={`/insurance/${c.id}`} className="line__link" onFocus={(e) => onFocusLine(e, i)} onClick={(e) => onTap(e, i)}>
                  <LineArt kind={c.id} className="line__thumb" />
                  <span className="line__text">
                    <span className="line__title">{c.title}</span>
                    <span className="line__sub">{c.sub}</span>
                  </span>
                  <svg className="line__chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M14.5 6l-6 6 6 6" />
                  </svg>
                </Link>

                <div className="line__panel" hidden={i !== active}>
                  <LineArt kind={c.id} className="line__art" />
                  <div className="line__sheet">
                    <h3 className="line__h">{c.title}</h3>
                    <p className="line__desc">{c.desc}</p>
                    <ul className="line__cover">
                      {c.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <div className="line__ctas">
                      <Link className="btn-primary line__go" href={`/insurance/${c.id}`}>
                        לכל הפרטים על {c.title}
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
