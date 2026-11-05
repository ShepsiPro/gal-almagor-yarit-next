import { bestQuote, otherQuotes, personLabel, shekels, wholeShekels, type MortgageQuote } from "@/lib/mortgage-quote";

/**
 * What the customer sees once the mortgage form is sent: the cheapest company
 * with its first monthly premium, the others under it, and what the number
 * rests on. The numbers are the server's, the same ones the agency gets on the
 * lead.
 */
export default function MortgageQuoteResult({ quote }: { quote: MortgageQuote }) {
  const best = bestQuote(quote);
  const others = otherQuotes(quote);
  const tiedWith = quote.tie ? others[0] : null;
  return (
    <section className="mq" aria-label="תוצאת בדיקת העלות">
      <span className="mq__eyebrow">בדיקת עלות ביטוח חיים למשכנתא</span>
      {best && best.monthly !== null ? (
        <>
          <h2 className="mq__title">המחיר הנמוך מבין חברות הביטוח שבדקנו</h2>
          <div className="mq__best">
            <span className="mq__company">{best.name}</span>
            <span className="mq__price">
              {shekels(best.monthly)}
              <small> לחודש</small>
            </span>
          </div>
          <ul className="mq__others">
            {others.map((o) => (
              <li key={o.company}>
                <span>{o.name}</span>
                <span className={o.monthly === null ? "mq__na" : undefined}>{o.monthly !== null ? `${shekels(o.monthly)} לחודש` : o.unavailable}</span>
              </li>
            ))}
          </ul>
          {tiedWith ? (
            <p className="mq__saving">אותו מחיר גם ב{tiedWith.name}</p>
          ) : quote.saving ? (
            <p className="mq__saving">חיסכון של {shekels(quote.saving)} בחודש לעומת ההצעה הבאה</p>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="mq__title">את המחיר נבדוק עבורכם</h2>
          <p className="mq__lead">
            לנתונים האלה אין חישוב אוטומטי בתעריפים שבידינו. נציג הסוכנות יבדוק את האפשרויות מול חברות הביטוח ויחזור
            אליכם עם הצעה.
          </p>
        </>
      )}
      <p className="mq__facts">
        סכום ביטוח {wholeShekels(quote.sumInsured)} (יתרת המשכנתא) · גיל ביטוחי {quote.insuranceAge} · {personLabel(quote)}
      </p>
      <p className="mq__note">
        הערכה ראשונית לחודש הראשון, לפי תעריפי הבסיס של חברות הביטוח. הפרמיה משתנה עם השנים לפי הגיל ויתרת ההלוואה.
        המחיר הסופי כפוף לחיתום רפואי, להצהרת בריאות ולאישור חברת הביטוח, ועד לאישור זה אין כיסוי ביטוחי.
      </p>
    </section>
  );
}
