import FormLinks from "@/components/FormLinks";
import { requireAdmin } from "../session";

export const metadata = { title: "שליחת טופס ללקוח", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The "send a form" tool, inside the back-office: same tool as the public
 * /forms page (which stays for staff without a Mslahtk login), but reached
 * from the menu without leaving the back-office.
 */
export default async function SendFormPage() {
  await requireAdmin("/admin/send");
  return (
    <main className="adm__main">
      <div className="adm__head">
        <div>
          <h1 className="adm__title">שליחת טופס ללקוח</h1>
          <p className="adm__muted">
            בוחרים טופס ושולחים ללקוח בוואטסאפ או מעתיקים את הקישור. אפשר למלא מראש שם וטלפון, והטופס יגיע אליו מותאם.
          </p>
        </div>
      </div>
      <div className="adm__card adm__send">
        <FormLinks />
      </div>
    </main>
  );
}
