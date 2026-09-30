import FormLinks from "@/components/FormLinks";
import { sendFormToCustomer } from "@/app/admin/actions";
import { requireAdmin } from "../session";

export const metadata = { title: "שליחת טופס ללקוח", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The "send a form" tool, inside the back-office. Unlike the public /forms page
 * (a plain link builder, kept for staff without a Mslahtk login) it is signed
 * in, so sending here registers the customer in Mslahtk on the spot and
 * delivers the link over WhatsApp and/or email.
 */
export default async function SendFormPage() {
  await requireAdmin("/admin/send");
  return (
    <main className="adm__main">
      <div className="adm__head">
        <div>
          <h1 className="adm__title">שליחת טופס ללקוח</h1>
          <p className="adm__muted">
            מזינים את פרטי הלקוח, בוחרים טופס ושולחים לווטסאפ ו/או למייל שלו. הלקוח נרשם במסלחתק כבר ברגע השליחה, והתיק נשאר פתוח עד שהתהליך מסתיים.
          </p>
        </div>
      </div>
      <div className="adm__card adm__send">
        <FormLinks send={sendFormToCustomer} />
      </div>
    </main>
  );
}
