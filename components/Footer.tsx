import Image from "next/image";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__col">
          <Image
            src="/assets/yarit-logo-white.png"
            alt="יערית · סוכנות לביטוח"
            className="footer__logo"
            width={678}
            height={246}
          />
          <div>
            <span className="footer__brand">סוכנות יערית · שלומי</span>
            חבר ב<span className="footer__group">קבוצת גל אלמגור</span>
          </div>
        </div>
        <div>© 2026 · רישיון סוכן ביטוח · רשות שוק ההון, ביטוח וחיסכון</div>
      </div>
    </footer>
  );
}
