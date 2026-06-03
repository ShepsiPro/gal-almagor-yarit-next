import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="header">
      <div className="container header__inner">
        <Link href="/" className="header__brand">
          <Image
            src="/assets/gal-almagor-logo.svg"
            alt="גל אלמגור"
            className="header__logo-img"
            width={260}
            height={32}
            priority
          />
        </Link>
        <nav className="header__nav">
          <Link href="/#about">אודות</Link>
          <Link href="/#categories">תחומי ביטוח</Link>
          <Link href="/#quote">הצעת מחיר</Link>
          <Link href="/#why">למה אנחנו</Link>
          <Link href="/#partners">חברות הביטוח</Link>
          <Link href="/#contact">צור קשר</Link>
        </nav>
        <Link href="/#contact" className="header__cta">
          קביעת פגישה
        </Link>
      </div>
    </header>
  );
}
