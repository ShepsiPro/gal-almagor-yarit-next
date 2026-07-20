import Image from "next/image";
import Link from "next/link";
import {
  SITE,
  NAV_LINKS,
  LEGAL_LINKS,
  FOOTER_INSURANCE,
  WA_HREF,
  TEL_HREF,
  MAIL_HREF,
} from "@/lib/site";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container footer__inner">
        {/* Brand */}
        <div className="footer__brandcol">
          <Image
            src="/assets/yarit-logo-white.png"
            alt="יערית · מקבוצת גל אלמגור"
            className="footer__logo"
            width={678}
            height={246}
          />
          <p className="footer__tagline">{SITE.tagline}</p>
          <div className="footer__group-row">
            חבר ב<span className="footer__group">{SITE.group}</span>
          </div>
          <p className="footer__tagline" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
            גל אלמגור סוכנות לביטוח 2008 בע״מ
          </p>
        </div>

        {/* Site navigation */}
        <nav className="footer__col" aria-label="ניווט באתר">
          <h2 className="footer__heading">ניווט</h2>
          <ul className="footer__links">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Insurance areas */}
        <nav className="footer__col" aria-label="תחומי ביטוח">
          <h2 className="footer__heading">תחומי ביטוח</h2>
          <ul className="footer__links">
            {FOOTER_INSURANCE.map((c) => (
              <li key={c.slug}>
                <Link href={`/insurance/${c.slug}`}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div className="footer__col">
          <h2 className="footer__heading">צרו קשר</h2>
          <ul className="footer__contact">
            <li>
              <span className="lbl">טלפון</span>
              <a href={TEL_HREF} dir="ltr">{SITE.phoneDisplay}</a>
            </li>
            <li>
              <span className="lbl">ווטסאפ</span>
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer" dir="ltr">
                {SITE.phoneDisplay}
              </a>
            </li>
            <li>
              <span className="lbl">דוא״ל</span>
              <a href={MAIL_HREF} dir="ltr">{SITE.email}</a>
            </li>
            <li>
              <span className="lbl">כתובת</span>
              <span className="val">{SITE.address}</span>
            </li>
            <li>
              <span className="lbl">שעות פעילות</span>
              <span className="val">{SITE.hours}</span>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <nav className="footer__col" aria-label="מידע ומסמכים">
          <h2 className="footer__heading">מידע משפטי</h2>
          <ul className="footer__links">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container footer__bottom">
        <p className="footer__legal">
          © {year} <strong>{SITE.legalName}</strong>. כל הזכויות שמורות.
          {" · "}
          רישיון סוכן ביטוח{SITE.licenseNo ? ` מס׳ ${SITE.licenseNo}` : ""}
          {SITE.companyId ? ` · ח.פ. ${SITE.companyId}` : ""}
          {" · "}
          בפיקוח רשות שוק ההון, ביטוח וחיסכון
        </p>
        <p className="footer__disclaimer">
          האמור באתר הוא מידע כללי בלבד, אינו מהווה ייעוץ, שיווק פנסיוני או המלצה
          כלשהי, ואינו תחליף לייעוץ אישי המתחשב בנתונים ובצרכים של כל אדם. הכיסוי
          הביטוחי בפועל, היקפו ותנאיו כפופים לתנאי הפוליסה, לחיתום ולתנאי חברת
          הביטוח, ובכל מקרה של סתירה — יגברו תנאי הפוליסה וההוראות של חברת הביטוח.
        </p>
      </div>
    </footer>
  );
}
