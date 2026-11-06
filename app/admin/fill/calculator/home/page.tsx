import Link from "next/link";
import HomeQuoteSimulator from "@/components/HomeQuoteSimulator";
import { getCase, getForm, prefillableFields } from "@/lib/forms";
import { decodeSnapshot } from "@/lib/home-quote";
import { requireAdmin } from "../../../session";

export const metadata = { title: "מחשבון ביטוח דירה במשרד", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The apartment calculator in the office, run with the customer beside the
 * agent (owner, 2026-11-06). It goes on to the back-office request form rather
 * than the public one, carrying the customer's details typed on the forms page;
 * nothing is saved until that request form is.
 */
export default async function OfficeCalculatorPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireAdmin("/admin/fill/calculator/home");
  const home = getCase("home")!;
  const request = getForm(home.request)!;
  const query = await searchParams;
  const carry = new URLSearchParams();
  for (const key of prefillableFields(request)) {
    const value = first(query[key]);
    if (value) carry.set(key, value.slice(0, 120));
  }

  return (
    <main className="adm__main adm__main--wide">
      <Link className="adm__back" href="/admin/send">
        → חזרה לטפסים ולמחשבונים
      </Link>
      <div className="adm__head">
        <div>
          <span className="adm__eyebrow">מילוי במשרד · ביטוח דירה</span>
          <h1 className="adm__title">{home.simulatorTitle ?? "מחשבון ביטוח דירה"}</h1>
          <p className="adm__muted">מחשבים יחד עם הלקוח וממשיכים לטופס הבקשה עם כל הנתונים. הפנייה נשמרת רק כשטופס הבקשה נשלח.</p>
        </div>
      </div>
      <div className="adm__card adm__calc">
        <HomeQuoteSimulator initial={decodeSnapshot(first(query.sim))} requestPath={`/admin/fill/${home.request}`} carry={carry.toString()} office />
      </div>
    </main>
  );
}
