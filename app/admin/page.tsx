import Link from "next/link";
import { getForm } from "@/lib/forms";
import { caseOpenedBy, caseStageOf, stageLabel } from "@/lib/home-case";
import AdminIcon from "@/components/AdminIcon";
import StatusChip from "@/components/StatusChip";
import { sweepStatuses } from "@/lib/mslahtk-sync";
import { listSubmissions } from "@/lib/submissions";
import { requireAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE = 50;

const TZ = "Asia/Jerusalem";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** Short and relative: "היום 18:39", "אתמול 09:05", "22.09 18:39", and the year only when it is not this one. */
function whenHe(value: Date | string): string {
  const d = new Date(value);
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600_000);
  if (dayKey(d) === dayKey(now)) return `היום ${time}`;
  if (dayKey(d) === dayKey(yesterday)) return `אתמול ${time}`;
  const sameYear = d.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" }) === now.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" });
  const date = d.toLocaleDateString("he-IL", { timeZone: TZ, day: "2-digit", month: "2-digit", ...(sameYear ? {} : { year: "numeric" }) });
  return `${date} ${time}`;
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin");

  const q = await searchParams;
  const offset = Math.max(Number(Array.isArray(q.offset) ? q.offset[0] : q.offset) || 0, 0);
  const lookup = typeof q.lookup === "string" ? q.lookup.slice(0, 64) : "";

  // Statuses are a mirror of Mslahtk's pipeline; bring them up to date on the
  // way in (throttled to once in five minutes, never blocks the list).
  await sweepStatuses().catch(() => undefined);

  let page: Awaited<ReturnType<typeof listSubmissions>>;
  try {
    // One row per customer case: an offer or an answer shows inside its request.
    page = await listSubmissions({ limit: PAGE, offset, topLevel: true });
  } catch (err) {
    return (
      <main className="adm__main">
        <div className="adm__card adm__card--warn">
          <h1 className="adm__title">שגיאה בקריאת הפניות</h1>
          <p className="adm__muted" dir="ltr">
            {err instanceof Error ? err.message : String(err)}
          </p>
        </div>
      </main>
    );
  }

  const shown = offset + page.items.length;

  return (
    <main className="adm__main adm__main--wide">
      <div className="adm__head">
        <div>
          <h1 className="adm__title">פניות שהתקבלו</h1>
          <p className="adm__muted">
            {page.total === 1 ? "פנייה אחת" : `${page.total} פניות`}. כל פנייה נשמרת כאן וגם במסלחתק.
          </p>
        </div>
      </div>

      {lookup && (
        <div className="adm__card adm__card--warn adm__card--tight">
          <p className="adm__muted">
            הפנייה שנפתחה ממסלחתק לא נמצאה כאן (מזהה <span dir="ltr">{lookup}</span>). ייתכן שהתקבלה לפני
            החיבור למערכת.
          </p>
        </div>
      )}

      {page.items.length === 0 ? (
        <div className="adm__card adm__empty">
          <AdminIcon name="inbox" size={28} />
          <p className="adm__empty-title">עדיין לא התקבלו פניות</p>
          <p className="adm__muted">פנייה מהאתר או טופס שנשלח ללקוח יופיעו כאן ברגע שימולאו.</p>
          <Link className="adm__btn adm__btn--primary adm__btn--icon" href="/admin/send">
            <AdminIcon name="send" />
            שליחת טופס ללקוח
          </Link>
        </div>
      ) : (
        <>
          <div className="adm__listhead" aria-hidden="true">
            <span>לקוח</span>
            <span>טופס</span>
            <span>סטטוס במסלחתק</span>
            <span>התקבל</span>
            <span />
          </div>
          <ul className="adm__list">
            {page.items.map((sub) => {
              const form = getForm(sub.formSlug);
              // A request row wears its case's stage.
              const caseDef = caseOpenedBy(form);
              const caseStage = caseDef ? caseStageOf(caseDef, sub.children) : null;
              const stageKey = caseStage ? (caseStage.stage === "answered" ? caseStage.decision ?? "answered" : caseStage.stage) : null;
              return (
                <li key={sub.id} className="adm__row">
                  <Link className="adm__rowlink" href={`/admin/${sub.id}`}>
                    <span className="adm__cell adm__cell--who">
                      <span className="adm__name">{sub.name || "ללא שם"}</span>
                      {sub.phone && (
                        <span className="adm__phone" dir="ltr">
                          {sub.phone}
                        </span>
                      )}
                    </span>
                    <span className="adm__cell adm__cell--form">
                      <span>{form?.title || sub.formTitle}</span>
                      {caseStage && <span className={`adm__status adm__status--stage-${stageKey}`}>{stageLabel(caseStage.stage, caseStage.decision)}</span>}
                    </span>
                    <span className="adm__cell adm__cell--status">
                      <StatusChip leadId={sub.mslahtkLeadId} status={sub.mslahtkStatus} />
                    </span>
                    <span className="adm__cell adm__cell--meta">
                      <span className="adm__meta">
                        <AdminIcon name="clock" size={13} />
                        {whenHe(sub.createdAt)}
                      </span>
                      {sub._count.files > 0 && (
                        <span className="adm__meta" title="מסמכים מצורפים">
                          <AdminIcon name="paperclip" size={13} />
                          {sub._count.files}
                        </span>
                      )}
                    </span>
                    <span className="adm__cell adm__cell--go">
                      <AdminIcon name="chevronStart" size={18} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(offset > 0 || shown < page.total) && (
        <nav className="adm__pager" aria-label="עמודים">
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
