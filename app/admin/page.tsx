import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { caseOfChildForm, caseOpenedBy, caseStageOf, stageLabel } from "@/lib/home-case";
import StatusChip from "@/components/StatusChip";
import { sweepStatuses } from "@/lib/mslahtk-sync";
import { listSubmissions } from "@/lib/submissions";
import { currentAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE = 50;

function whenHe(d: Date | string): string {
  return new Date(d).toLocaleString("he-IL", {
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

  const q = await searchParams;
  const offset = Math.max(Number(Array.isArray(q.offset) ? q.offset[0] : q.offset) || 0, 0);
  const lookup = typeof q.lookup === "string" ? q.lookup.slice(0, 64) : "";

  // Statuses are a mirror of Mslahtk's pipeline; bring them up to date on the
  // way in (throttled to once in five minutes, never blocks the list).
  await sweepStatuses().catch(() => undefined);

  let page: Awaited<ReturnType<typeof listSubmissions>>;
  try {
    page = await listSubmissions({ limit: PAGE, offset });
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

      {lookup && (
        <div className="adm__card adm__card--warn">
          <p className="adm__muted">
            הפנייה שנפתחה ממסלחתק לא נמצאה כאן (מזהה <span dir="ltr">{lookup}</span>). ייתכן שהתקבלה לפני
            החיבור למערכת.
          </p>
        </div>
      )}

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
                <th>מסמכים</th>
                <th>סטטוס</th>
                <th>התקבל</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {page.items.map((sub) => {
                const form = getForm(sub.formSlug);
                // A request row wears its case's stage; an offer or answer row
                // points back at the request it belongs to.
                const caseDef = caseOpenedBy(form);
                const caseStage = caseDef ? caseStageOf(caseDef, sub.children) : null;
                const childOf = !caseDef && sub.parentId && caseOfChildForm(form) ? sub.parentId : null;
                return (
                  <tr key={sub.id}>
                    <td>
                      <Link className="adm__link" href={`/admin/${sub.id}`}>
                        {sub.name || "ללא שם"}
                      </Link>
                    </td>
                    <td>
                      {form?.title || sub.formTitle}
                      {caseStage && (
                        <>
                          {" "}
                          <span className={`adm__status adm__status--stage-${caseStage.stage === "answered" ? caseStage.decision ?? "answered" : caseStage.stage}`}>
                            {stageLabel(caseStage.stage, caseStage.decision)}
                          </span>
                        </>
                      )}
                      {childOf && (
                        <>
                          {" "}
                          <Link className="adm__link" href={`/admin/${childOf}`}>
                            (לתיק)
                          </Link>
                        </>
                      )}
                    </td>
                    <td dir="ltr" className="adm__ltr">
                      {sub.phone || "-"}
                    </td>
                    <td>{sub._count.files || "-"}</td>
                    <td>
                      <StatusChip leadId={sub.mslahtkLeadId} status={sub.mslahtkStatus} />
                    </td>
                    <td>{whenHe(sub.createdAt)}</td>
                    <td className="adm__rowend">
                      <Link className="adm__btn adm__btn--sm" href={`/admin/${sub.id}`}>
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
            {offset + 1}-{shown} מתוך {page.total}
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
