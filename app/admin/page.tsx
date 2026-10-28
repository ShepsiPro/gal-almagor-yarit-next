import Link from "next/link";
import { dmyHm } from "@/lib/dates";
import { getForm } from "@/lib/forms";
import { caseOpenedBy, caseStageOf, stageLabel } from "@/lib/home-case";
import AdminIcon from "@/components/AdminIcon";
import StatusChip from "@/components/StatusChip";
import { sweepStatuses } from "@/lib/mslahtk-sync";
import { remindUnfilled } from "@/lib/reminders";
import { SECTION_LABEL, colleagues, loadTeam, nameOf, ownerLine, sectionWhere, sectionsFor, viewerOf, type Section } from "@/lib/staff";
import { countSubmissions, listSubmissions } from "@/lib/submissions";
import { requireAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE = 50;

const TZ = "Asia/Jerusalem";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** Relative for today and yesterday ("היום 18:39"), otherwise the full day-first date ("22/09/2026 18:39"). */
function whenHe(value: Date | string): string {
  const d = new Date(value);
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600_000);
  if (dayKey(d) === dayKey(now)) return `היום ${time}`;
  if (dayKey(d) === dayKey(yesterday)) return `אתמול ${time}`;
  return dmyHm(d);
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const RECORD_ID = /^[A-Za-z0-9_:.@-]{1,128}$/;

/** What a section is for, under its title. */
const SECTION_NOTE: Record<Section, string> = {
  mine: "טפסים ששלחתם ללקוחות, פניות שלקחתם לטיפול, ומה ששיתפו איתכם.",
  open: "פניות שהגיעו מהאתר ועוד לא שויכו לאף אחד. פנייה שלוקחים לטיפול עוברת לרשימה של מי שלקח אותה.",
  all: "כל פנייה, וכל טופס שנשלח ללקוח, נשמרים כאן וגם במסלחתק.",
};

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin("/admin");

  const q = await searchParams;
  const offset = Math.max(Number(one(q.offset)) || 0, 0);
  const lookup = typeof q.lookup === "string" ? q.lookup.slice(0, 64) : "";

  // Statuses are a mirror of Mslahtk's pipeline; bring them up to date on the
  // way in (throttled to once in five minutes, never blocks the list).
  await sweepStatuses().catch(() => undefined);
  // Due "not filled yet" reminders go out too, in the background (the server's
  // own timer does this as well; this covers a server that just woke up).
  void remindUnfilled().catch(() => undefined);

  // Whose list: each employee works their own section; the owner of the business sees everyone's.
  const viewer = viewerOf(admin);
  const { initial, allowed } = sectionsFor(viewer);
  const asked = one(q.view) as Section | undefined;
  const section: Section = asked && allowed.includes(asked) ? asked : initial;
  const whoRaw = one(q.who) ?? "";
  const who = section === "all" && viewer.seesAll && RECORD_ID.test(whoRaw) ? whoRaw : "";

  let page: Awaited<ReturnType<typeof listSubmissions>>;
  let counts: Partial<Record<Section, number>> = {};
  let team: Awaited<ReturnType<typeof loadTeam>>;
  try {
    team = await loadTeam();
    // One row per customer case: an offer or an answer shows inside its request.
    const [list, ...tallies] = await Promise.all([
      listSubmissions({ limit: PAGE, offset, where: sectionWhere(section, viewer, team, who) }),
      ...allowed.map((s) => countSubmissions(sectionWhere(s, viewer, team))),
    ]);
    page = list;
    counts = Object.fromEntries(allowed.map((s, i) => [s, tallies[i]]));
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
  const hrefFor = (s: Section, extra: Record<string, string | number> = {}) => {
    const p = new URLSearchParams({ view: s });
    for (const [k, v] of Object.entries(extra)) if (v !== "" && v !== 0) p.set(k, String(v));
    return `/admin?${p.toString()}`;
  };
  const people = section === "all" && viewer.seesAll ? colleagues(team) : [];

  return (
    <main className="adm__main adm__main--wide">
      <div className="adm__head">
        <div>
          <h1 className="adm__title">פניות וטפסים שנשלחו</h1>
          <p className="adm__muted">
            {page.total === 1 ? "פנייה אחת" : `${page.total} פניות`}. {SECTION_NOTE[section]}
          </p>
        </div>
      </div>

      <nav className="adm__views" aria-label="הפניות של מי">
        {allowed.map((s) => (
          <Link key={s} href={hrefFor(s)} className={`adm__view${s === section ? " is-active" : ""}`} aria-current={s === section ? "page" : undefined}>
            <AdminIcon name={s === "mine" ? "user" : s === "open" ? "inbox" : "users"} size={15} />
            <span>{SECTION_LABEL[s]}</span>
            <span className="adm__viewcount">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {people.length > 1 && (
        <nav className="adm__people" aria-label="לפי עובד/ת">
          <Link href={hrefFor("all")} className={`adm__person${!who ? " is-active" : ""}`}>
            כולם
          </Link>
          {people.map((p) => (
            <Link key={p.id} href={hrefFor("all", { who: p.id })} className={`adm__person${who === p.id ? " is-active" : ""}`}>
              {p.name || p.email || "עובד/ת"}
            </Link>
          ))}
        </nav>
      )}

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
          {section === "mine" ? (
            <>
              <p className="adm__empty-title">עדיין אין לך פניות</p>
              <p className="adm__muted">טופס שתשלחו ללקוח יופיע כאן מרגע השליחה, וכך גם פנייה שתיקחו לטיפול או שעמית ישתף איתכם.</p>
            </>
          ) : section === "open" ? (
            <>
              <p className="adm__empty-title">אין פניות שממתינות לשיוך</p>
              <p className="adm__muted">פנייה שמגיעה מהאתר בלי שנשלח טופס מופיעה כאן לכולם, עד שמישהו לוקח אותה לטיפול.</p>
            </>
          ) : (
            <>
              <p className="adm__empty-title">{who ? `אין פניות אצל ${nameOf(team, who)}` : "עדיין לא התקבלו פניות"}</p>
              <p className="adm__muted">פנייה מהאתר תופיע כאן ברגע שתתקבל, וטופס שתשלחו ללקוח יופיע כאן כבר מרגע השליחה.</p>
            </>
          )}
          <div className="adm__linkbar">
            <Link className="adm__btn adm__btn--primary adm__btn--icon" href="/admin/send">
              <AdminIcon name="send" />
              שליחת טופס ללקוח
            </Link>
            {section === "mine" && (counts.open ?? 0) > 0 && (
              <Link className="adm__btn" href={hrefFor("open")}>
                {(counts.open ?? 0) === 1 ? "פנייה אחת ממתינה לשיוך" : `${counts.open} פניות ממתינות לשיוך`}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="adm__listhead" aria-hidden="true">
            <span>לקוח</span>
            <span>טופס</span>
            <span>סטטוס במסלחתק</span>
            <span>מתי</span>
            <span />
          </div>
          <ul className="adm__list">
            {page.items.map((sub) => {
              const form = getForm(sub.formSlug);
              // A request row wears its case's stage.
              const caseDef = caseOpenedBy(form);
              const caseStage = caseDef ? caseStageOf(caseDef, sub.children, sub.awaitingCustomer) : null;
              const stageKey = caseStage ? (caseStage.stage === "answered" ? caseStage.decision ?? "answered" : caseStage.stage) : null;
              const owner = ownerLine(sub, viewer, team);
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
                      <span className={`adm__owner adm__owner--${owner.kind}`}>
                        <AdminIcon name={owner.kind === "shared" || sub.shares.length ? "users" : "user"} size={13} />
                        {owner.text}
                      </span>
                    </span>
                    <span className="adm__cell adm__cell--form">
                      <span>{form?.title || sub.formTitle}</span>
                      {caseStage && <span className={`adm__status adm__status--stage-${stageKey}`}>{stageLabel(caseStage.stage, caseStage.decision)}</span>}
                      {!caseStage && sub.awaitingCustomer && <span className="adm__status adm__status--stage-invited">נשלח, ממתין למילוי</span>}
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
            <Link className="adm__btn" href={hrefFor(section, { who, offset: Math.max(offset - PAGE, 0) })}>
              הקודם
            </Link>
          )}
          <span className="adm__muted">
            {offset + 1}-{shown} מתוך {page.total}
          </span>
          {shown < page.total && (
            <Link className="adm__btn" href={hrefFor(section, { who, offset: offset + PAGE })}>
              הבא
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
