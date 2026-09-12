import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { listStoredLeads, mslahtkConfigured } from "@/lib/mslahtk";
import { currentAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE = 50;

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

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await currentAdmin();
  // 404 rather than a login page: an unauthenticated visitor should not learn
  // that a back-office lives here at all.
  if (!admin) notFound();

  if (!mslahtkConfigured()) {
    return (
      <main className="adm__main">
        <div className="adm__card adm__card--warn">
          <h1 className="adm__title">המערכת אינה מחוברת</h1>
          <p className="adm__muted">
            חסרים משתני הסביבה של מסלחתק. ללא חיבור אין מאיפה לקרוא את הטפסים.
          </p>
        </div>
      </main>
    );
  }

  const q = await searchParams;
  const offset = Math.max(Number(Array.isArray(q.offset) ? q.offset[0] : q.offset) || 0, 0);

  let page: Awaited<ReturnType<typeof listStoredLeads>>;
  try {
    page = await listStoredLeads({ limit: PAGE, offset });
  } catch (err) {
    return (
      <main className="adm__main">
        <div className="adm__card adm__card--warn">
          <h1 className="adm__title">שגיאה בקריאת הטפסים</h1>
          <p className="adm__muted" dir="ltr">
            {err instanceof Error ? err.message : String(err)}
          </p>
        </div>
      </main>
    );
  }

  const shown = offset + page.items.length;

  return (
    <main className="adm__main">
      <div className="adm__head">
        <h1 className="adm__title">טפסים שהתקבלו</h1>
        <span className="adm__count">{page.total} סה״כ</span>
      </div>

      {page.items.length === 0 ? (
        <div className="adm__card">
          <p className="adm__muted">עדיין לא התקבלו טפסים.</p>
        </div>
      ) : (
        <div className="adm__tablewrap">
          <table className="adm__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>טופס</th>
                <th>טלפון</th>
                <th>התקבל</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {page.items.map((lead) => {
                const slug = (lead.category || "").replace(/^form:/, "");
                const form = getForm(slug);
                return (
                  <tr key={lead.id}>
                    <td>
                      <Link className="adm__link" href={`/admin/${lead.id}`}>
                        {lead.name || "ללא שם"}
                      </Link>
                    </td>
                    <td>{form?.title || lead.ctaLabel || slug || "—"}</td>
                    <td dir="ltr" className="adm__ltr">
                      {lead.phone || "—"}
                    </td>
                    <td>{whenHe(lead.createdAt)}</td>
                    <td className="adm__rowend">
                      <Link className="adm__btn adm__btn--sm" href={`/admin/${lead.id}`}>
                        פתיחה
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(offset > 0 || shown < page.total) && (
        <nav className="adm__pager">
          {offset > 0 && (
            <Link className="adm__btn" href={`/admin?offset=${Math.max(offset - PAGE, 0)}`}>
              הקודם
            </Link>
          )}
          <span className="adm__muted">
            {offset + 1}–{shown} מתוך {page.total}
          </span>
          {shown < page.total && (
            <Link className="adm__btn" href={`/admin?offset=${offset + PAGE}`}>
              הבא
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
