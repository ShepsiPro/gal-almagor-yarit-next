import Image from "next/image";

export default function Header() {
  return (
    <header className="header">
      <div className="container header__inner">
        <a href="#" className="header__brand">
          <Image
            src="/assets/gal-almagor-logo.svg"
            alt="גל אלמגור"
            className="header__logo-img"
            width={260}
            height={32}
            priority
          />
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
