import { personLabel, shekels, wholeShekels, type CustomerQuote } from "@/lib/mortgage-quote";

/**
 * What the customer sees once the mortgage form is sent: the lowest first
 * monthly premium and what it rests on. The price only: no company is named
 * and the others are not listed (owner, 2026-11-05); the agency sees them on
 * the lead. The number is the server's, the same one the agency gets.
 */
export default function MortgageQuoteResult({ quote }: { quote: CustomerQuote }) {
  return (
    <section className="mq" aria-label="תוצאת בדיקת העלות">
      <span className="mq__eyebrow">בדיקת עלות ביטוח חיים למשכנתא</span>
      {quote.monthly !== null ? (
        <>
          <h2 className="mq__title">המחיר הנמוך מבין חברות הביטוח שבדקנו</h2>
          <div className="mq__best">
            <span className="mq__price">
              {shekels(quote.monthly)}
              <small> לחודש</small>
            </span>
          </div>
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
