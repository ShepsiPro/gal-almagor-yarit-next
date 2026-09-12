import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBytes, getForm, isFieldVisible, type FormDef } from "@/lib/forms";
import { getStoredLead, type StoredFile } from "@/lib/mslahtk";
import { currentAdmin } from "../session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function whenHe(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Render the answers through the form definition.
 *
 * This is the whole reason the back-office lives on this site rather than in
 * Mslahtk: `fields` there is fifty keys like `youngest_birth` with no order and
 * no meaning. The definition holds the Hebrew label, the section it belongs to
 * and the conditions under which it was ever shown — so a field the customer
 * never saw is not rendered as an ominous blank, and the document reads back in
 * the order it was filled.
 */
function Rendered({ form, fields }: { form: FormDef; fields: Record<string, string> }) {
  return (
    <>
      {form.sections.map((section, si) => {
        const rows = section.fields
          .filter((f) => f.type !== "statement")
          .filter((f) => isFieldVisible(form, f, fields))
          .map((f) => ({ field: f, value: (fields[f.name] ?? "").trim() }))
          .filter((r) => r.value !== "");

        if (!rows.length) return null;
        return (
          <section className="adm__section" key={si}>
            {section.title && <h2 className="adm__sectiontitle">{section.title}</h2>}
            <dl className="adm__dl">
              {rows.map(({ field, value }) => (
                <div className="adm__dlrow" key={field.name}>
                  <dt>{field.label}</dt>
                  <dd className={field.type === "consent" ? "adm__yes" : undefined}>
                    {field.type === "consent" ? "אושר ✓" : value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </>
  );
}

function FileCard({ file }: { file: StoredFile }) {
  const isImage = (file.mimeType || "").startsWith("image/");
  return (
    <a className="adm__file" href={file.url} target="_blank" rel="noopener noreferrer">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="adm__filethumb" src={file.url} alt={file.filename || "קובץ"} loading="lazy" />
      ) : (
        <span className="adm__filethumb adm__filethumb--doc" aria-hidden="true">
          PDF
        </span>
      )}
      <span className="adm__filemeta">
        <span className="adm__filename">{file.filename || "ללא שם"}</span>
        {file.size != null && <span className="adm__muted">{formatBytes(file.size)}</span>}
      </span>
    </a>
  );
}

export default async function LeadDetail({ params }: { params: Promise<{ leadId: string }> }) {
  const admin = await currentAdmin();
  if (!admin) notFound();

  const { leadId } = await params;

  let detail: Awaited<ReturnType<typeof getStoredLead>>;
  try {
    detail = await getStoredLead(leadId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(msg)) notFound();
    return (
      <main className="adm__main">
        <div className="adm__card adm__card--warn">
          <h1 className="adm__title">שגיאה בקריאת הטופס</h1>
          <p className="adm__muted" dir="ltr">
            {msg}
          </p>
        </div>
      </main>
    );
  }

  const { lead, customer, files } = detail;
  const slug = (lead.category || "").replace(/^form:/, "");
  const form = getForm(slug);

  return (
    <main className="adm__main">
      <Link className="adm__back" href="/admin">
        ← לכל הטפסים
      </Link>

      <div className="adm__head">
        <div>
          <h1 className="adm__title">{lead.name || customer?.name || "ללא שם"}</h1>
          <p className="adm__muted">
            {form?.title || lead.ctaLabel || slug} · {whenHe(lead.createdAt)}
          </p>
        </div>
        <div className="adm__actions">
          <Link className="adm__btn adm__btn--primary" href={`/admin/${lead.id}/resend`}>
            שליחה מחדש לעדכון
          </Link>
        </div>
      </div>

      <div className="adm__contact">
        {lead.phone && (
          <a className="adm__chip" href={`tel:${lead.phone}`} dir="ltr">
            {lead.phone}
          </a>
        )}
        {lead.email && (
          <a className="adm__chip" href={`mailto:${lead.email}`} dir="ltr">
            {lead.email}
          </a>
        )}
      </div>

      {files.length > 0 && (
        <section className="adm__section">
          <h2 className="adm__sectiontitle">מסמכים ({files.length})</h2>
          <div className="adm__files">
            {files.map((f) => (
              <FileCard file={f} key={f.id} />
            ))}
          </div>
        </section>
      )}

      {form ? (
        <Rendered form={form} fields={lead.fields} />
      ) : (
        // A form that has since been renamed or removed: show the raw answers
        // rather than nothing, because the submission is still a record.
        <section className="adm__section">
          <h2 className="adm__sectiontitle">תשובות (טופס לא מזוהה: {slug || "—"})</h2>
          <dl className="adm__dl">
            {Object.entries(lead.fields).map(([k, v]) => (
              <div className="adm__dlrow" key={k}>
                <dt dir="ltr">{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
