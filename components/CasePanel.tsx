import Link from "next/link";
import { buildAnswerLink } from "@/app/admin/actions";
import CaseAnswerLink from "@/components/CaseAnswerLink";
import { answerLinkSentAt, decisionLabel, stageLabel, type CaseFile } from "@/lib/home-case";
import { encodeSnapshot, roundShekel } from "@/lib/home-quote";
import { whenHe } from "@/lib/format";
import { answersOf } from "@/lib/submissions";

/** The four steps of a case, with what each one holds and what comes next. */
export default function CasePanel({ file }: { file: CaseFile }) {
  const { request, latestOffer, latestAnswer, stage, decision, simulator, def } = file;
  const offer = latestOffer ? answersOf(latestOffer) : null;
  const answer = latestAnswer ? answersOf(latestAnswer) : null;
  const sentAt = answerLinkSentAt(latestOffer);
  const stageKey = stage === "answered" ? decision ?? "answered" : stage;

  return (
    <section className="adm__case" aria-label={def.title}>
      <div className="adm__case-head">
        <h2 className="adm__sectiontitle" style={{ margin: 0 }}>
          {def.title}
        </h2>
        <span className={`adm__status adm__status--stage-${stageKey}`}>{stageLabel(stage, decision)}</span>
      </div>

      {simulator && (
        <div className="adm__sim">
          <span>
            הערכה מהמחשבון: <strong>{roundShekel(simulator.result.total).toLocaleString("he-IL")} ₪</strong> לשנה
          </span>
          <span>{simulator.input.apartmentType} · {Math.round(simulator.input.areaM2)} מ״ר</span>
          {simulator.input.buildingSum > 0 && <span>מבנה {Math.round(simulator.input.buildingSum).toLocaleString("he-IL")} ₪</span>}
          {simulator.input.contentsSum > 0 && <span>תכולה {Math.round(simulator.input.contentsSum).toLocaleString("he-IL")} ₪</span>}
          <a className="adm__btn adm__btn--sm" href={`/simulator/home?sim=${encodeURIComponent(encodeSnapshot(simulator.input))}`} target="_blank" rel="noopener noreferrer">
            פתיחה במחשבון
          </a>
        </div>
      )}

      <ol className="adm__steps">
        <li className="adm__step is-done">
          <span className="adm__step-num">1</span>
          <span className="adm__step-title">בקשה (טופס 1)</span>
          <div className="adm__step-body">התקבלה {whenHe(request.createdAt)}</div>
        </li>

        <li className={`adm__step${latestOffer ? " is-done" : " is-next"}`}>
          <span className="adm__step-num">2</span>
          <span className="adm__step-title">הצעה (טופס 2)</span>
          <div className="adm__step-body">
            {latestOffer && offer ? (
              <>
                <p>
                  {offer.insurer || "ללא חברה"} · {offer.premium ? `${Number(offer.premium).toLocaleString("he-IL")} ₪ לשנה` : "ללא פרמיה"}
                </p>
                <p>נשמרה {whenHe(latestOffer.createdAt)}</p>
              </>
            ) : (
              <p>טרם הוכנה. הבקשה נפתחת לצד הטופס.</p>
            )}
          </div>
          <div className="adm__step-actions">
            <Link className="adm__btn adm__btn--primary adm__btn--sm" href={`/admin/${request.id}/offer`}>
              {latestOffer ? "עריכת ההצעה" : "הכנת הצעה"}
            </Link>
            {latestOffer && (
              <Link className="adm__btn adm__btn--sm" href={`/admin/${latestOffer.id}`}>
                צפייה
              </Link>
            )}
          </div>
        </li>

        <li className={`adm__step${sentAt ? " is-done" : latestOffer ? " is-next" : ""}`}>
          <span className="adm__step-num">3</span>
          <span className="adm__step-title">טופס תשובה (טופס 3)</span>
          <div className="adm__step-body">
            {sentAt ? <p>הקישור נוצר {whenHe(sentAt)}</p> : latestOffer ? <p>ההצעה מוכנה, שלחו ללקוח את הקישור לתשובה.</p> : <p>זמין לאחר שמירת ההצעה.</p>}
          </div>
          {latestOffer && (
            <div className="adm__step-actions">
              <CaseAnswerLink caseId={request.id} phone={request.phone} customerName={request.name} build={buildAnswerLink} />
            </div>
          )}
        </li>

        <li className={`adm__step${latestAnswer ? " is-done" : sentAt ? " is-next" : ""}`}>
          <span className="adm__step-num">4</span>
          <span className="adm__step-title">תשובת הלקוח</span>
          <div className="adm__step-body">
            {latestAnswer && answer ? (
              <>
                <p>
                  <strong>{decisionLabel(decision)}</strong>
                </p>
                {answer.change_details && <p>{answer.change_details}</p>}
                {answer.requested_start && <p>מועד תחילה מבוקש: {answer.requested_start}</p>}
                <p>התקבלה {whenHe(latestAnswer.createdAt)}</p>
              </>
            ) : (
              <p>טרם התקבלה.</p>
            )}
          </div>
          {latestAnswer && (
            <div className="adm__step-actions">
              <Link className="adm__btn adm__btn--sm" href={`/admin/${latestAnswer.id}`}>
                צפייה בתשובה
              </Link>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
