import Image from "next/image";

export default function Header() {
  return (
    <header className="header">
      <div className="container header__inner">
        <a href="#" className="header__brand">
          <Image
            src="/assets/group-logo.png"
            alt="גל אלמגור — קבוצה מבטחת"
            className="header__logo-img"
            width={200}
            height={41}
            priority
          />
          <span className="header__divider" />
          <div>
            <div className="header__sub-name">סוכנות יערית</div>
            <div className="header__sub-loc">שלומי · הגליל המערבי</div>
          </div>
        </a>
        <nav className="header__nav">
          <a href="#about">אודות</a>
          <a href="#categories">תחומי ביטוח</a>
          <a href="#why">למה אנחנו</a>
          <a href="#partners">חברות הביטוח</a>
          <a href="#contact">צור קשר</a>
        </nav>
        <a href="#contact" className="header__cta">
          קביעת פגישה
        </a>
      </div>
    </header>
  );
}
