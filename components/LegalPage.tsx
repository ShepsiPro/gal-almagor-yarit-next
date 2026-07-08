import { ReactNode } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE, TEL_HREF, MAIL_HREF } from "@/lib/site";

export default function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1} className="legal">
        <div className="legal__inner">
          <nav className="info-crumbs" aria-label="פירורי לחם">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">{eyebrow}</span>
          </nav>

          <div className="eyebrow">{eyebrow}</div>
          <h1 className="legal__title">{title}</h1>
          {intro && <p className="legal__intro">{intro}</p>}
          {updated && (
            <p className="legal__updated">עודכן לאחרונה: {updated}</p>
          )}

          <div className="legal__body">{children}</div>

          <aside className="legal__contactbox">
            <h2 className="legal__contactbox-title">שאלות? דברו איתנו</h2>
            <p>
              לכל שאלה בנוגע למסמך זה או ליצירת קשר עם הסוכנות, אנחנו כאן:
            </p>
            <ul className="legal__contactbox-list">
              <li>
                טלפון:{" "}
                <a href={TEL_HREF} dir="ltr">
                  {SITE.phoneDisplay}
                </a>
              </li>
              <li>
                דוא״ל:{" "}
                <a href={MAIL_HREF} dir="ltr">
                  {SITE.email}
                </a>
              </li>
              <li>כתובת: {SITE.address}</li>
            </ul>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
