import FormLinks from "@/components/FormLinks";
import { sendFormToCustomer } from "@/app/admin/actions";
import { requireAdmin } from "../session";

export const metadata = { title: "טפסים ומחשבונים", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The forms hub, inside the back-office: every calculator and form, filled here
 * with a customer who is in the office, or sent to one who is not. Signed in, so
 * either way the customer is registered in Mslahtk on the spot, and a send goes
 * out over WhatsApp and/or email.
 */
export default async function SendFormPage() {
  await requireAdmin("/admin/send");
  return (
    <main className="adm__main">
      <div className="adm__head">
        <div>
          <h1 className="adm__title">טפסים ומחשבונים</h1>
          <p className="adm__muted">
            לקוח במשרד? ממלאים יחד איתו כאן, בלי לשלוח קישור. לקוח מרחוק? שולחים לו בווטסאפ או במייל, או מעתיקים קישור. בשני
            המקרים הלקוח נרשם במסלחתק ותיק הפנייה נפתח על שמך.
          </p>
        </div>
      </div>
      <FormLinks send={sendFormToCustomer} />
    </main>
  );
}
