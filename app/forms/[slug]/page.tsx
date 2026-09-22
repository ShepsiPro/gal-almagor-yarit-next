import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormRenderer from "@/components/FormRenderer";
import { FORM_SLUGS, formAudience, getForm, prefillableFields } from "@/lib/forms";
import { caseOpenedBy, requestPrefillFromSimulator } from "@/lib/home-case";
import { computeHomeQuote, decodeSnapshot, encodeSnapshot, roundShekel, type HomeQuoteInput, type HomeQuoteResult } from "@/lib/home-quote";
import { SITE, TEL_HREF } from "@/lib/site";
import { verifyPrefillToken } from "@/lib/prefill";

type PageProps = {
  params: Promise<{ slug: string }>;
  // The agent can personalise a link before sending it, without any backend:
  // /forms/car?name=ישראל%20ישראלי&phone=0501234567
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return FORM_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) return {};
  return {
    title: `${form.title} · ${SITE.brand}`,
    description: form.intro,
    // Fill links are handed to a specific customer — they should never surface
    // in search results.
    robots: { index: false, follow: false },
  };
}

/** The estimate the customer brought along from the simulator. */
function EstimateCard({ input, result }: { input: HomeQuoteInput; result: HomeQuoteResult }) {
  const back = `/simulator/home?sim=${encodeURIComponent(encodeSnapshot(input))}`;
  return (
    <aside className="fform__estimate" aria-label="ההערכה הראשונית מהמחשבון">
      <div className="fform__estimate-main">
        <span className="fform__estimate-label">ההערכה הראשונית שלכם</span>
        <span className="fform__estimate-total">
          {result.blocked ? "לפי חתם" : `${roundShekel(result.total).toLocaleString("he-IL")} ₪`}
          {!result.blocked && <small> לשנה</small>}
        </span>
        <span className="fform__estimate-sub">
          {input.apartmentType} · {Math.round(input.areaM2)} מ״ר
          {input.buildingSum > 0 ? ` · מבנה ${Math.round(input.buildingSum).toLocaleString("he-IL")} ₪` : ""}
          {input.contentsSum > 0 ? ` · תכולה ${Math.round(input.contentsSum).toLocaleString("he-IL")} ₪` : ""}
        </span>
      </div>
      <div className="fform__estimate-side">
        <p>הערכה בלבד. ההצעה הסופית תישלח אליכם לאחר בדיקה, וכפופה לחיתום ולתנאי חברת הביטוח.</p>
        <Link href={back} className="fform__estimate-link">
          לשינוי הנתונים במחשבון
        </Link>
      </div>
    </aside>
  );
}

/** A token-only form opened without its link: say so, do not show a form that cannot be sent. */
function LinkExpired({ title }: { title: string }) {
  return (
    <div className="fform__expired" role="status">
      <h2 className="fform__done-title">הקישור אינו תקין או שפג תוקפו</h2>
      <p className="fform__done-body">
        הטופס &quot;{title}&quot; נפתח רק מקישור אישי שהסוכנות שולחת, ותוקפו שבועיים. בקשו מאיתנו קישור חדש ונשלח אותו
        מיד.
      </p>
      <div className="fform__done-actions">
        <a className="map-btn map-btn--primary" href={TEL_HREF} dir="ltr">
          {SITE.phoneDisplay}
        </a>
        <Link className="map-btn" href="/">
          לעמוד הבית
        </Link>
      </div>
    </div>
  );
}

export default async function FormPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const form = getForm(slug);
  // An agency form is filled in the back-office; on the public site it does not exist.
  if (!form || formAudience(form) === "agency") notFound();

  const query = await searchParams;
  const prefill: Record<string, string> = {};
  // Each form declares which of its own fields a link may fill, so a new form
  // is prefillable the day it is written rather than the day someone
  // remembers to add its field names to a list over here.
  for (const key of prefillableFields(form)) {
    const raw = query[key] ?? query[key.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) prefill[key] = value.slice(0, 120);
  }

  // A request that arrives from the simulator carries the inputs in `sim`. The
  // estimate is recomputed here, shown above the form, and the matching
  // answers are filled in so the customer does not type the same thing twice.
  let estimate: { input: HomeQuoteInput; result: HomeQuoteResult } | null = null;
  let context: Record<string, unknown> | undefined;
  if (caseOpenedBy(form)) {
    const rawSim = Array.isArray(query.sim) ? query.sim[0] : query.sim;
    const input = decodeSnapshot(rawSim);
    if (input) {
      estimate = { input, result: computeHomeQuote(input) };
      Object.assign(prefill, requestPrefillFromSimulator(input));
      context = { simulator: encodeSnapshot(input) };
    }
  }

  // A signed `?p=` token is the agency re-sending this form with answers already
  // filled, some of them locked. It wins over the loose query parameters above,
  // which anyone can type. The token itself is passed on to the renderer so it
  // travels back with the submission and the API can re-check the locks — a
  // lock enforced only in the browser is decoration.
  const rawToken = Array.isArray(query.p) ? query.p[0] : query.p;
  const sent = verifyPrefillToken(rawToken);
  const tokenOk = Boolean(sent && sent.slug === slug);
  const locked = sent && tokenOk ? sent.locked : [];
  if (sent && tokenOk) Object.assign(prefill, sent.values);

  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1} className="fpage">
        <div className="fpage__inner">
          <nav className="info-crumbs" aria-label="פירורי לחם">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">{form.eyebrow}</span>
          </nav>

          <div className="eyebrow">{form.eyebrow}</div>
          <h1 className="fpage__title">{form.title}</h1>
          <p className="fpage__intro">{form.intro}</p>
          <p className="fpage__meta">
            נתקעתם? התקשרו אלינו{" "}
            <a href={TEL_HREF} dir="ltr">
              {SITE.phoneDisplay}
            </a>{" "}
            ונשלים יחד.
          </p>

          {form.requiresToken && !tokenOk ? (
            <LinkExpired title={form.title} />
          ) : (
            <>
              {estimate && <EstimateCard input={estimate.input} result={estimate.result} />}
              <FormRenderer
                form={form}
                prefill={prefill}
                locked={locked}
                prefillToken={tokenOk ? rawToken : undefined}
                context={context}
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
