import Link from "next/link";
import { notFound } from "next/navigation";
import AnsweredForm from "@/components/AnsweredForm";
import FormRenderer from "@/components/FormRenderer";
import { getForm } from "@/lib/forms";
import { loadCase, offerPrefill } from "@/lib/home-case";
import { encodeSnapshot, roundShekel } from "@/lib/home-quote";
import { answersOf } from "@/lib/submissions";
import { currentAdmin } from "../../session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Form 2, filled with the customer's request open beside it.
 *
 * Everything the request already answered is filled in on the offer, and if
 * the customer came through the simulator, its estimate seeds the premium and
 * the deductibles. The agent edits, saves; the case moves to "offer prepared".
 */
export default async function OfferPage({ params }: { params: Promise<{ leadId: string }> }) {
  const admin = await currentAdmin();
  if (!admin) notFound();

  const { leadId } = await params;
  const file = await loadCase(leadId);
  if (!file) notFound();
  const requestForm = getForm(file.request.formSlug);
  const offerForm = getForm(file.def.offer);
  if (!requestForm || !offerForm) notFound();

  const requestAnswers = answersOf(file.request);
  const prefill = offerPrefill(file, file.latestOffer ? answersOf(file.latestOffer) : undefined);
  const sim = file.simulator;

  return (
    <main className="adm__main adm__main--wide">
      <Link className="adm__back" href={`/admin/${file.request.id}`}>
        ← חזרה לתיק
      </Link>
      <div className="adm__head">
        <div>
          <h1 className="adm__title">{file.latestOffer ? "עריכת ההצעה" : "הכנת הצעה"} (טופס 2)</h1>
          <p className="adm__muted">
            {file.request.name || "ללא שם"} · {file.def.title}
            {file.latestOffer && " · שמירה יוצרת גרסה חדשה של ההצעה; הקודמת נשמרת בתיק"}
          </p>
        </div>
      </div>

      <div className="adm__split">
        <aside className="adm__split-side" aria-label="הבקשה של הלקוח">
          <h2 className="adm__sectiontitle">הבקשה של הלקוח (טופס 1)</h2>
          {sim && (
            <div className="adm__sim">
              <span>
                הערכה מהמחשבון: <strong>{roundShekel(sim.result.total).toLocaleString("he-IL")} ₪</strong> לשנה
              </span>
              <a className="adm__btn adm__btn--sm" href={`/simulator/home?sim=${encodeURIComponent(encodeSnapshot(sim.input))}`} target="_blank" rel="noopener noreferrer">
                פתיחה במחשבון
              </a>
            </div>
          )}
          <AnsweredForm form={requestForm} fields={requestAnswers} files={file.request.files} />
        </aside>

        <section className="adm__split-main" aria-label="ההצעה">
          <FormRenderer
            form={offerForm}
            prefill={prefill}
            action={`/admin/forms/${offerForm.slug}`}
            extra={{ _parent: file.request.id }}
            mode="agency"
            doneHref={`/admin/${file.request.id}`}
            doneLabel="חזרה לתיק"
          />
        </section>
      </div>
    </main>
  );
}
