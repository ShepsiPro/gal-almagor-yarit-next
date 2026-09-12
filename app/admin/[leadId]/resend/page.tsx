import Link from "next/link";
import { notFound } from "next/navigation";
import ResendBuilder, { type ResendField } from "@/components/ResendBuilder";
import { buildResendLink } from "../../actions";
import { getForm, isFieldVisible } from "@/lib/forms";
import { getStoredLead } from "@/lib/mslahtk";
import { currentAdmin } from "../../session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResendPage({ params }: { params: Promise<{ leadId: string }> }) {
  const admin = await currentAdmin();
  if (!admin) notFound();

  const { leadId } = await params;

  let detail: Awaited<ReturnType<typeof getStoredLead>>;
  try {
    detail = await getStoredLead(leadId);
  } catch {
    notFound();
  }

  const { lead } = detail;
  const slug = (lead.category || "").replace(/^form:/, "");
  const form = getForm(slug);
  if (!form) notFound();

  // Only fields that were actually answered and actually shown. Offering to
  // unlock a field the customer never saw would put a question in front of them
  // that their own answers say is irrelevant.
  const fields: ResendField[] = form.sections.flatMap((section, si) =>
    section.fields
      .filter((f) => f.type !== "statement" && f.type !== "file")
      .filter((f) => isFieldVisible(form, f, lead.fields))
      .map((f) => ({
        name: f.name,
        label: f.label,
        section: section.title || `חלק ${si + 1}`,
        value: (lead.fields[f.name] ?? "").trim(),
      }))
      .filter((f) => f.value !== ""),
  );

  return (
    <main className="adm__main">
      <Link className="adm__back" href={`/admin/${lead.id}`}>
        ← חזרה לטופס
      </Link>
      <div className="adm__head">
        <div>
          <h1 className="adm__title">שליחה מחדש לעדכון</h1>
          <p className="adm__muted">
            {lead.name || "ללא שם"} · {form.title}
          </p>
        </div>
      </div>

      <ResendBuilder
        leadId={lead.id}
        fields={fields}
        phone={lead.phone}
        customerName={lead.name}
        formTitle={form.title}
        build={buildResendLink}
      />
    </main>
  );
}
