import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormLinks from "@/components/FormLinks";

export const metadata: Metadata = {
  title: "טפסים לשליחה ללקוח",
  robots: { index: false, follow: false },
};

export default function FormsIndexPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="fpage">
        <div className="fpage__inner">
          <div className="eyebrow">שימוש פנימי</div>
          <h1 className="fpage__title">טפסים לשליחה ללקוח</h1>
          <p className="fpage__intro">
            בחרו טופס ושלחו את הקישור ללקוח. אפשר למלא מראש שם וטלפון כדי שהלקוח
            יקבל טופס מותאם. הטופס המלא חוזר אלינו למייל, כולל הקבצים המצורפים.
          </p>
          <FormLinks />
        </div>
      </main>
      <Footer />
    </>
  );
}
