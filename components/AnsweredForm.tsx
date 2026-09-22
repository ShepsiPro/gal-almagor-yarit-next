import type { SubmissionFile } from "@prisma/client";
import { isFieldVisible, type FormDef } from "@/lib/forms";

/**
 * A filled form, read back through its definition.
 *
 * The stored answers are keyed by field name. The definition holds the Hebrew
 * label, the section it belongs to and the conditions under which it was ever
 * shown, so a field the customer never saw is not rendered as an ominous
 * blank, and the document reads back in the order it was filled.
 */
export default function AnsweredForm({
  form,
  fields,
  files = [],
}: {
  form: FormDef;
  fields: Record<string, string>;
  /** The submission's stored documents; a drawn signature is shown from here. */
  files?: SubmissionFile[];
}) {
  const signatureFile = (name: string) => files.find((f) => f.fieldName === name && f.mimeType.startsWith("image/"));
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
                  <dt>{field.label || field.name}</dt>
                  <dd className={field.type === "consent" ? "adm__yes" : undefined}>
                    {field.type === "consent" ? (
                      "אושר ✓"
                    ) : field.type === "signature" && signatureFile(field.name) ? (
                      // The only door to a document: the session-checked file route.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="adm__sigimg" src={`/admin/files/${signatureFile(field.name)!.id}`} alt="חתימה" />
                    ) : (
                      value
                    )}
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
