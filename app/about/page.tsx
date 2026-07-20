import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";
import { SITE, TEL_HREF, FOOTER_INSURANCE } from "@/lib/site";

export const metadata: Metadata = {
  title: "אודות · גל אלמגור יערית · שלומי",
  description:
    "גל אלמגור יערית — סוכנות הביטוח של שלומי והגליל המערבי, חברה בקבוצת גל אלמגור. ליווי אישי לתיק הביטוח של משפחות ועסקים.",
  openGraph: {
    title: "אודות · גל אלמגור יערית · שלומי",
    description:
      "סוכנות הביטוח של שלומי והגליל המערבי — ליווי אישי לתיק הביטוח של משפחות ועסקים.",
    type: "article",
    locale: "he_IL",
  },
};

const COVERAGE = [
  "ביטוח רכב — חובה, מקיף וצד ג׳",
  "ביטוח דירה ומשכנתא",
  "ביטוח עסקים ואחריות מקצועית",
  "ביטוחי חיים ובריאות",
  "ביטוח סיעודי ואובדן כושר עבודה",
  "ביטוח נסיעות לחו״ל",
  "תכנון פרישה, גמל והשתלמות",
  "ניהול תיקים וחיסכון פיננסי",
];

const VALUES = [
  "פגישת היכרות ללא עלות",
  "איש קשר אישי אחד",
  "ליווי מלא ברגע של תביעה",
  "השוואה שנתית של התיק",
  "שקיפות מלאה בתנאים",
  "זמינות אמיתית, בלי מוקד מתחלף",
];

export default function AboutPage() {
  return (
    <>
      <Header />

      <section id="main-content" tabIndex={-1} className="info-hero">
        <div className="container info-hero__inner">
          <nav className="info-crumbs" aria-label="breadcrumbs">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">אודות</span>
          </nav>

          <div className="info-hero__head">
            <span className="info-hero__eyebrow">אודותינו</span>
          </div>

          <h1 className="info-hero__title">
            סוכנות מקומית בשלומי, <em>עם הגב של קבוצה ארצית.</em>
          </h1>
          <p className="info-hero__intro">
            גל אלמגור יערית היא סוכנות הביטוח של שלומי והסביבה — פנים מוכרות, איש
            קשר אחד וליווי אישי לאורך כל חיי התיק. אנחנו חברה בקבוצת גל אלמגור,
            ומשלבים קרבה מקומית עם ליווי מקצועי מלא בכל תחומי הביטוח והפיננסים.
          </p>

          <div className="info-hero__ctas">
            <a href="#contact" className="btn-primary">
              שיחת ייעוץ ללא עלות
            </a>
            <Link href="/" className="btn-link">
              <span className="btn-link__arrow">←</span>
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </section>

      <section className="info-body">
        <div className="container info-body__inner">
          <div className="info-body__main">
            <article className="info-section">
              <div className="info-section__index">01</div>
              <div>
                <h2 className="info-section__title">הסוכנות שלנו בשלומי</h2>
                <p className="info-section__body">
                  יערית היא הבית הביטוחי של משפחות ועסקים בשלומי ובגליל המערבי.
                  אנחנו יושבים בקניון שלומי (תצפית), במרחק שיחה אחת, ומאמינים
                  שביטוח טוב מתחיל בהיכרות אישית — לא במוקד מתחלף ולא בטפסים בלי
                  סוף.
                </p>
                <p className="info-section__body">
                  כל לקוח מקבל איש קשר אחד שמלווה אותו לאורך השנים: מהפגישה
                  הראשונה ומיפוי התיק הקיים, דרך חידושים והשוואות שנתיות, ועד
                  רגע האמת של תביעה — שאותה אנחנו מנהלים מולכם, מול חברת הביטוח.
                </p>
              </div>
            </article>

            <article className="info-section">
              <div className="info-section__index">02</div>
              <div>
                <h2 className="info-section__title">תחומי הליווי שלנו</h2>
                <p className="info-section__body">
                  אנחנו מלווים אתכם בכל תחומי הביטוח והפיננסים תחת קורת גג אחת —
                  בודקים את התיק הקיים, מאתרים כפילויות וחורי כיסוי, ובונים כיסוי
                  שמתאים לחיים האמיתיים שלכם.
                </p>
                <h3 className="info-section__bullets-title">מה מכסים אצלנו</h3>
                <ul className="info-section__bullets">
                  {COVERAGE.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="info-section">
              <div className="info-section__index">03</div>
              <div>
                <h2 className="info-section__title">הדרך שלנו</h2>
                <p className="info-section__body">
                  אנחנו עובדים במודל משפחתי — נאמנות, זמינות ואחריות הדדית ללקוח
                  לאורך זמן. המטרה שלנו קבועה: שקט נפשי, דרך כיסוי מדויק בלי כפל
                  ביטוחים ובלי חורים בכיסוי, עם ליווי שנמצא שם גם ביום שאחרי.
                </p>
                <h3 className="info-section__bullets-title">מה שמנחה אותנו</h3>
                <ul className="info-section__bullets">
                  {VALUES.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </article>
          </div>

          <aside className="info-aside">
            <div className="info-aside__emblem">
              <Image
                src="/assets/yarit-shield.png"
                alt="סמל הסוכנות יערית"
                width={299}
                height={376}
              />
            </div>

            <div className="info-aside__card">
              <div className="info-aside__eyebrow">דברו איתנו</div>
              <h3 className="info-aside__title">
                רוצים לבדוק את תיק הביטוח שלכם?
              </h3>
              <p className="info-aside__desc">
                פגישת היכרות בשלומי, ללא עלות וללא התחייבות — עם איש קשר אישי
                שמלווה אתכם לאורך כל הדרך.
              </p>
              <a href="#contact" className="btn-primary info-aside__cta">
                לקביעת פגישה
              </a>
              <a href={TEL_HREF} className="info-aside__phone" dir="ltr">
                {SITE.phoneDisplay}
              </a>
            </div>

            <div className="info-related">
              <div className="info-related__eyebrow">תחומי הביטוח</div>
              <ul className="info-related__list">
                {FOOTER_INSURANCE.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/insurance/${r.slug}`}>
                      <span className="info-related__title">{r.label}</span>
                      <span className="info-related__arrow">←</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <Contact />
      <Footer />
    </>
  );
}
