"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/#about", label: "אודות" },
  { href: "/#categories", label: "תחומי ביטוח" },
  { href: "/#quote", label: "הצעת מחיר" },
  { href: "/#why", label: "למה אנחנו" },
  { href: "/#partners", label: "חברות הביטוח" },
  { href: "/#contact", label: "צור קשר" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="header">
      <div className="container header__inner">
        <Link href="/" className="header__brand" onClick={close}>
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
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <Link href="/#contact" className="header__cta">
          קביעת פגישה
        </Link>

        <button
          type="button"
          className={`header__toggle${open ? " is-open" : ""}`}
          aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="header__toggle-bar" />
          <span className="header__toggle-bar" />
          <span className="header__toggle-bar" />
        </button>
      </div>

      <div id="mobile-menu" className={`header__mobile${open ? " is-open" : ""}`}>
        <nav className="header__mobile-nav">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close}>
              {l.label}
            </Link>
          ))}
          <Link href="/#contact" className="header__mobile-cta" onClick={close}>
            קביעת פגישה
          </Link>
        </nav>
      </div>
    </header>
  );
}
