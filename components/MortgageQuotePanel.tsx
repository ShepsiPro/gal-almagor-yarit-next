import { isoToDisplay } from "@/lib/dates";
import { personLabel, quoteFromAnswers, rateLine, shekels, wholeShekels } from "@/lib/mortgage-quote";

/**
 * The price check a mortgage request was sent with, as it was on the day: every
 * company, the rate each was read at, and the cheapest. The customer saw only
 * the lowest price, with no company named. Stored, not re-priced, so a later
 * birthday or a new card does not change it.
 */
export default function MortgageQuotePanel({ answers }: { answers: Record<string, string> }) {
  const quote = quoteFromAnswers(answers);
  if (!quote) return null;
  const best = quote.quotes.find((q) => q.company === quote.best);
  return (
    <section className="adm__case" aria-label="בדיקת המחיר">
      <div className="adm__case-head">
        <h2 className="adm__sectiontitle" style={{ margin: 0 }}>
          בדיקת מחיר: ביטוח חיים למשכנתא
        </h2>
        <span className={`adm__status ${best ? "adm__status--won" : "adm__status--pending"}`}>
          {best ? `הזול: ${best.name}${quote.tie ? " (מחיר זהה גם בחברה נוספת)" : ""}` : "לא חושב אוטומטית"}
        </span>
      </div>
      <div className="adm__quotes">
        {quote.quotes.map((q) => (
          <div key={q.company} className={`adm__quote${q.company === quote.best ? " is-best" : ""}`}>
            <span className="adm__quote-name">{q.name}</span>
            <strong>{q.monthly !== null ? `${shekels(q.monthly)} לחודש` : "לא חושב"}</strong>
            <span className="adm__quote-meta">{rateLine(q)}</span>
            <span className="adm__quote-meta">{q.plan}</span>
          </div>
        ))}
      </div>
      <p className="adm__muted">
        סכום ביטוח {wholeShekels(quote.sumInsured)} · גיל {quote.age} (גיל ביטוחי {quote.insuranceAge}) · {personLabel(quote)} · חושב
        ב-{isoToDisplay(quote.on)}
      </p>
    </section>
  );
}
