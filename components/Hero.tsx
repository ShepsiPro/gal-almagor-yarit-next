import Image from "next/image";

export default function Hero() {
  return (
    <section id="main-content" tabIndex={-1} className="hero">
      <div className="container hero__inner">
        <div>
          <div className="badge">
            <span className="badge__tag">קבוצת גל אלמגור</span>
            <span className="badge__text">סוכנות לביטוח </span>
          </div>
          <h1 className="hero__title">
            הבית הביטוחי
            <br />
            של הגליל
            <br />
            <em>המערבי.</em>
          </h1>
          <p className="hero__lede">
            גל אלמגור הגיעה לשלומי, סניף אשר ילווה לקוחות ובעלי עסקים לאורך כל
            קו העימות עם מגוון מוצרים ומחירים יחודיים אשר יועדו לתושבי היישובים
            צמודי גדר.
          </p>
          <div className="hero__ctas">
            <a href="#contact" className="btn-primary">
              שיחת ייעוץ ללא עלות
            </a>
            <a href="#categories" className="btn-link">
              <span className="btn-link__arrow">←</span>
              תחומי הליווי שלנו
            </a>
          </div>
        </div>

        <div className="hero__art">
          <Image
            src="/assets/office-shlomi.jpg"
            alt="משרד סוכנות יערית בשלומי — הגליל המערבי"
            className="hero__art-img"
            fill
            sizes="(max-width: 920px) 92vw, 45vw"
            priority
          />
          <div className="hero__art-inner">
            <div className="hero__art-tag">משרד הסוכנות · שלומי</div>
            <div>
              <div className="hero__art-quote">
                ״ביטוח הוא לא מוצר שמוכרים, הוא הבטחה שמקיימים.״
              </div>
              <div className="hero__art-attrib">גל אלמגור · מייסד הקבוצה</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
