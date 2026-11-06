import { isoToDisplay } from "@/lib/dates";
import { discountHeadline, scheduleParts } from "@/lib/mortgage-discounts";
import { personLabel, quoteFromAnswers, rateLine, shekels, wholeShekels } from "@/lib/mortgage-quote";

/**
 * The price check a mortgage request was sent with, as it was on the day: every
 * company, the rate each was read at, the discount each price rests on (the row
 * to mark on the proposal), and the cheapest. The customer saw only the lowest
 * price, with no company named. Stored, not re-priced, so a later birthday, a
 * new card or a promotion that has since ended does not change it.
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
          {best
            ? `הזול: ${best.name}${best.discount ? `, הנחה ${best.discount.percent}%` : ""}${quote.tie ? " (מחיר זהה גם בחברה נוספת)" : ""}`
            : "לא חושב אוטומטית"}
        </span>
      </div>
      <div className="adm__quotes">
        {quote.quotes.map((q) => (
          <div key={q.company} className={`adm__quote${q.company === quote.best ? " is-best" : ""}`}>
            <span className="adm__quote-name">{q.name}</span>
            <strong>{q.monthly !== null ? `${shekels(q.monthly)} לחודש` : "לא חושב"}</strong>
            {q.discount ? (
              <div className="adm__quote-discount">
                <span className="adm__quote-badge">{discountHeadline(q.discount)}</span>
                <span className="adm__quote-meta">לפני הנחה: {shekels(q.listMonthly ?? q.monthly ?? 0)} לחודש</span>
                <span className="adm__quote-meta">{q.discount.track}</span>
                <span className="adm__quote-meta adm__quote-years">
                  {/* A year range never breaks at its hyphen ("שנים 4-" over "6: 30%"). */}
                  {scheduleParts(q.discount.years).map((part, i) => (
                    <span key={i}>
                      {i > 0 ? " · " : ""}
                      <span>{part}</span>
                    </span>
                  ))}
                  {q.discount.later ? `, ${q.discount.later}` : ""}
                </span>
                <span className="adm__quote-meta">
                  {q.discount.promotion}, למצטרפים עד {isoToDisplay(q.discount.until)}
                </span>
                {q.discount.note && <span className="adm__quote-meta">{q.discount.note}</span>}
              </div>
            ) : q.discount === null && q.monthly !== null ? (
              <span className="adm__quote-meta">ללא הנחה פעילה</span>
            ) : null}
            <span className="adm__quote-meta">{rateLine(q)}</span>
            <span className="adm__quote-meta">{q.plan}</span>
          </div>
        ))}
      </div>
      <p className="adm__muted">
        סכום ביטוח {wholeShekels(quote.sumInsured)}
        {quote.loanYears != null ? ` · ${quote.loanYears} שנים שנותרו למשכנתא` : ""} · גיל {quote.age} (גיל ביטוחי{" "}
        {quote.insuranceAge}) · {personLabel(quote)} · חושב ב-{isoToDisplay(quote.on)}
      </p>
    </section>
  );
}
