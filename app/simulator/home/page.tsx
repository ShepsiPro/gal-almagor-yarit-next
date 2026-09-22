import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeQuoteSimulator from "@/components/HomeQuoteSimulator";
import { decodeSnapshot } from "@/lib/home-quote";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `מחשבון ביטוח דירה · ${SITE.brand}`,
  description:
    "הערכה ראשונית לעלות ביטוח הדירה שלכם תוך דקה: מבנה, תכולה, רעידת אדמה, נזקי מים והרחבות. ללא התחייבות, ובלי למסור פרטים.",
  alternates: { canonical: "/simulator/home" },
};

export default async function HomeSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const raw = Array.isArray(q.sim) ? q.sim[0] : q.sim;
  const initial = decodeSnapshot(raw);

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="fpage sim">
        <div className="fpage__inner fpage__inner--wide">
          <nav className="info-crumbs" aria-label="פירורי לחם">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <Link href="/insurance/home">ביטוח דירה</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">מחשבון</span>
          </nav>
          <div className="eyebrow">ביטוח דירה</div>
          <h1 className="fpage__title">מחשבון ביטוח דירה</h1>
          <p className="fpage__intro">
            כמה עולה לבטח את הדירה? מלאו את הפרטים הבסיסיים וקבלו הערכה ראשונית מיד, בלי למסור פרטים אישיים. מעוניינים
            בהצעה מסודרת? בסוף המחשבון עוברים לטופס בקשה קצר, והפרטים שכבר מילאתם עוברים איתכם.
          </p>
          <HomeQuoteSimulator initial={initial} />
        </div>
      </main>
      <Footer />
    </>
  );
}
