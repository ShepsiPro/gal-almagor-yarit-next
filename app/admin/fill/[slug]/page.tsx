import Link from "next/link";
import { notFound } from "next/navigation";
import FormRenderer from "@/components/FormRenderer";
import { getForm, officeFillable, prefillableFields } from "@/lib/forms";
import { caseOpenedBy, requestPrefillFromSimulator } from "@/lib/home-case";
import { computeHomeQuote, decodeSnapshot, encodeSnapshot, roundShekel } from "@/lib/home-quote";
import { requireAdmin } from "../../session";

export const metadata = { title: "מילוי במשרד", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A customer's form filled in the office, with the customer beside the agent,
 * instead of sending them a link (owner, 2026-11-06). It posts through the admin
 * door, so the request is filed as the agent's own, the customer is registered
 * in Mslahtk and the office gets its email, as when a customer sends it. The
 * customer's details typed on the forms page arrive in the query and fill the
 * form; a request that comes from the calculator brings its numbers too.
 */
export default async function OfficeFillPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  const { slug } = await params;
  await requireAdmin(`/admin/fill/${slug}`);
  const form = getForm(slug);
  if (!form || !officeFillable(form)) notFound();

  const query = await searchParams;
  const prefill: Record<string, string> = {};
  const contact = new URLSearchParams();
  for (const key of prefillableFields(form)) {
    const value = first(query[key]);
    if (!value) continue;
    prefill[key] = value.slice(0, 120);
    contact.set(key, prefill[key]);
  }

  // From the calculator: its estimate above the form, its numbers in the answers they fill.
  let estimate: { total: number | null; back: string } | null = null;
  let context: Record<string, unknown> | undefined;
  if (caseOpenedBy(form)) {
    const input = decodeSnapshot(first(query.sim));
    if (input) {
      const result = computeHomeQuote(input);
      Object.assign(prefill, requestPrefillFromSimulator(input));
      context = { simulator: encodeSnapshot(input) };
      const back = new URLSearchParams(contact);
      back.set("sim", encodeSnapshot(input));
      estimate = { total: result.blocked ? null : roundShekel(result.total), back: `/admin/fill/calculator/home?${back}` };
    }
  }

  return (
    <main className="adm__main">
      <Link className="adm__back" href="/admin/send">
        → חזרה לטפסים ולמחשבונים
      </Link>
      <div className="adm__head">
        <div>
          <span className="adm__eyebrow">מילוי במשרד · {form.eyebrow}</span>
          <h1 className="adm__title">{form.title}</h1>
          <p className="adm__muted">
            ממלאים יחד עם הלקוח, בלי לשלוח לו קישור. בשמירה הפנייה נפתחת במערכת על שמך, הלקוח נרשם במסלחתק והמשרד מקבל את
            המייל כרגיל.
          </p>
        </div>
      </div>
      {estimate && (
        <div className="adm__sim">
          <span>
            הערכה מהמחשבון:{" "}
            {estimate.total === null ? (
              <strong>לפי חתם</strong>
            ) : (
              <>
                <strong>{estimate.total.toLocaleString("he-IL")} ₪</strong> לשנה
              </>
            )}
          </span>
          <Link className="adm__btn adm__btn--sm" href={estimate.back}>
            לשינוי הנתונים במחשבון
          </Link>
        </div>
      )}
      <div className="adm__card adm__fill">
        <FormRenderer
          form={form}
          prefill={prefill}
          action={`/admin/forms/${form.slug}`}
          context={context}
          mode="agency"
          keepDraft={false}
          doneHref="/admin/{id}"
          doneLabel="פתיחת התיק"
          doneTitle="הפנייה נשמרה"
          doneBody="הפנייה נפתחה במערכת על שמך והלקוח נרשם במסלחתק. בתיק אפשר להמשיך לטפל בה."
          doneSecondary={{ href: "/admin/send", label: "לטופס נוסף" }}
        />
      </div>
    </main>
  );
}
