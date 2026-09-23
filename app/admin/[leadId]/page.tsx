import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SubmissionFile } from "@prisma/client";
import AnsweredForm from "@/components/AnsweredForm";
import CasePanel from "@/components/CasePanel";
import StatusChip from "@/components/StatusChip";
import { CONTACT_FIELDS, CONTACT_FORM_SLUG } from "@/lib/contact-form";
import { allFields, formAudience, formatBytes, getForm } from "@/lib/forms";
import { whenHe } from "@/lib/format";
import { loadCase, parentCaseId } from "@/lib/home-case";
import { dashboardLeadUrl } from "@/lib/mslahtk";
import { answersOf, getSubmission } from "@/lib/submissions";
import { requireAdmin } from "../session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Answers with no form definition: the contact form's labels, or the raw keys. */
function RawAnswers({ slug, fields }: { slug: string; fields: Record<string, string> }) {
  const labels = new Map(slug === CONTACT_FORM_SLUG ? CONTACT_FIELDS.map((f) => [f.key, f.label] as const) : []);
  const entries = Object.entries(fields).filter(([k]) => !k.startsWith("_"));
  return (
    <section className="adm__section">
      <h2 className="adm__sectiontitle">{slug === CONTACT_FORM_SLUG ? "פרטי הפנייה" : `תשובות (טופס לא מזוהה: ${slug})`}</h2>
      <dl className="adm__dl">
        {entries.map(([k, v]) => (
          <div className="adm__dlrow" key={k}>
            <dt dir={labels.has(k) ? undefined : "ltr"}>{labels.get(k) ?? k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FileCard({ file }: { file: SubmissionFile }) {
  // The only door to a document: a session-checked route that answers with a
  // five-minute signed URL. Nothing here knows a bucket or a key.
  const href = `/admin/files/${file.id}`;
  const isImage = file.mimeType.startsWith("image/");
  return (
    <a className="adm__file" href={href} target="_blank" rel="noopener noreferrer">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="adm__filethumb" src={href} alt={file.filename} loading="lazy" />
      ) : (
        <span className="adm__filethumb adm__filethumb--doc" aria-hidden="true">
          PDF
        </span>
      )}
      <span className="adm__filemeta">
        <span className="adm__filename">{file.filename}</span>
        <span className="adm__muted">{formatBytes(file.size)}</span>
      </span>
    </a>
  );
}

export default async function SubmissionDetail({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const admin = await requireAdmin(`/admin/${leadId}`);

  const sub = await getSubmission(leadId);
  if (!sub) notFound();
  // Reached by the Mslahtk lead id (a launch token, an older link): settle on
  // the site's own id so every later link from this page is canonical.
  if (sub.id !== leadId) redirect(`/admin/${sub.id}`);

  const fields = answersOf(sub);
  const form = getForm(sub.formSlug);
  // A request opens a case; an offer or an answer belongs to one.
  const file = await loadCase(sub.id);
  const caseId = file ? null : await parentCaseId(sub);
  const resendable = Boolean(form && formAudience(form) === "customer" && !form.requiresToken);
  // A drawn signature is shown inside the form, beside its label, not as a document.
  const signatureFields = new Set(form ? allFields(form).filter((f) => f.type === "signature").map((f) => f.name) : []);
  const documents = sub.files.filter((f) => !signatureFields.has(f.fieldName));

  return (
    <main className="adm__main">
      <Link className="adm__back" href={caseId ? `/admin/${caseId}` : "/admin"}>
        {caseId ? "→ חזרה לתיק" : "→ לכל הפניות"}
      </Link>

      <div className="adm__head">
        <div>
          <h1 className="adm__title">{sub.name || "ללא שם"}</h1>
          <p className="adm__muted">
            {form?.title || sub.formTitle} · {whenHe(sub.createdAt)}
            {sub.resentFromId && (
              <>
                {" · "}
                <Link className="adm__link" href={`/admin/${sub.resentFromId}`}>
                  עדכון לפנייה קודמת
                </Link>
              </>
            )}
            {caseId && (
              <>
                {" · "}
                <Link className="adm__link" href={`/admin/${caseId}`}>
                  חלק מתיק ביטוח דירה
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="adm__actions">
          {resendable && (
            <Link className="adm__btn adm__btn--primary" href={`/admin/${sub.id}/resend`}>
              שליחה מחדש לעדכון
            </Link>
          )}
          {sub.mslahtkLeadId && (
            <a className="adm__btn" href={dashboardLeadUrl(sub.mslahtkLeadId)} target="_blank" rel="noopener noreferrer">
              כרטיס הלקוח במסלחתק
            </a>
          )}
        </div>
      </div>

      <div className="adm__contact">
        {sub.phone && (
          <a className="adm__chip" href={`tel:${sub.phone}`} dir="ltr">
            {sub.phone}
          </a>
        )}
        {sub.email && (
          <a className="adm__chip" href={`mailto:${sub.email}`} dir="ltr">
            {sub.email}
          </a>
        )}
        <StatusChip leadId={sub.mslahtkLeadId} status={sub.mslahtkStatus} />
      </div>

      {file && <CasePanel file={file} />}

      {documents.length > 0 && (
        <section className="adm__section">
          <h2 className="adm__sectiontitle">מסמכים ({documents.length})</h2>
          <div className="adm__files">
            {documents.map((f) => (
              <FileCard file={f} key={f.id} />
            ))}
          </div>
        </section>
      )}

      {form ? <AnsweredForm form={form} fields={fields} files={sub.files} /> : <RawAnswers slug={sub.formSlug} fields={fields} />}
    </main>
  );
}
