import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ResendBuilder, { type ResendField } from "@/components/ResendBuilder";
import { buildResendLink } from "../../actions";
import { getForm, isFieldVisible } from "@/lib/forms";
import { answersOf, getSubmission } from "@/lib/submissions";
import { requireAdmin } from "../../session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResendPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const admin = await requireAdmin(`/admin/${leadId}/resend`);

  const sub = await getSubmission(leadId);
  if (!sub) notFound();
  if (sub.id !== leadId) redirect(`/admin/${sub.id}/resend`);

  const form = getForm(sub.formSlug);
  if (!form) notFound();
  const answers = answersOf(sub);

  // Only fields that were actually answered and actually shown. Offering to
  // unlock a field the customer never saw would put a question in front of them
  // that their own answers say is irrelevant.
  const fields: ResendField[] = form.sections.flatMap((section, si) =>
    section.fields
      .filter((f) => f.type !== "statement" && f.type !== "file" && f.type !== "signature")
      .filter((f) => isFieldVisible(form, f, answers))
      .map((f) => ({
        name: f.name,
        label: f.label,
        section: section.title || `חלק ${si + 1}`,
        value: (answers[f.name] ?? "").trim(),
      }))
      .filter((f) => f.value !== ""),
  );

  return (
    <main className="adm__main">
      <Link className="adm__back" href={`/admin/${sub.id}`}>
        ← חזרה לטופס
      </Link>
      <div className="adm__head">
        <div>
          <h1 className="adm__title">שליחה מחדש לעדכון</h1>
          <p className="adm__muted">
            {sub.name || "ללא שם"} · {form.title}
          </p>
        </div>
      </div>

      <ResendBuilder
        leadId={sub.id}
        fields={fields}
        phone={sub.phone}
        customerName={sub.name}
        formTitle={form.title}
        build={buildResendLink}
      />
    </main>
  );
}
