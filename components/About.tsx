import Image from "next/image";

export default function About() {
  return (
    <section id="about" className="section section--bordered about">
      <div className="container about__grid">
        <div className="about__art">
          <Image
            src="/assets/yarit-shield.png"
            alt="סמל הסוכנות יערית"
            className="about__shield"
            width={299}
            height={376}
          />
        </div>
        <div>
          <div className="eyebrow">אודותינו</div>
          <h2 className="section__title section__title--md about__title">
            סוכנות מקומית.
            <br />
            <em>גב של קבוצה ארצית.</em>
          </h2>

          <div className="about__body">
            <p>
              גל אלמגור יערית היא סניף מקומי בשלומי של <strong>קבוצת גל אלמגור</strong> — אחת מקבוצות סוכנויות הביטוח המובילות בצפון. אנחנו משלבים את הקרבה האישית של סוכנות שכונתית עם היכולת המקצועית, המיקוח והכיסוי של קבוצה ארצית.
            </p>
            <p>
              כל לקוח מקבל איש קשר אחד שמלווה אותו לאורך השנים — מהפגישה הראשונה, דרך חידושים והשוואות, ועד הרגע האמת של תביעה. בלי מוקד מתחלף, בלי טפסים בלי סוף.
            </p>
          </div>

          <div className="about__pillars">
            <div>
              <div className="pillar__title">פגישה ראשונה ללא עלות</div>
              <div className="pillar__desc">
                מיפוי תיק קיים, איתור כפילויות וחורי כיסוי
              </div>
            </div>
            <div>
              <div className="pillar__title">ליווי בתביעות</div>
              <div className="pillar__desc">
                אנחנו מטפלים מול חברת הביטוח, לא אתם
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
