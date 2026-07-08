import Link from "next/link";

const CATEGORIES = [
  {
    id: "car",
    sub: "חובה, מקיף וצד ג׳",
    title: "ביטוח רכב",
    desc: "כיסוי מלא לרכב הפרטי או המשפחתי, כולל גרירה, רכב חלופי וכיסוי לנהגים צעירים. השוואת הצעות מכל החברות המובילות.",
    bullets: ["ביטוח חובה", "ביטוח מקיף", "צד ג׳ מורחב", "רכב חלופי"],
  },
  {
    id: "home",
    sub: "מבנה ותכולה",
    title: "ביטוח דירה",
    desc: "הגנה מקיפה על הבית והרכוש שבו, מפני נזקי טבע, גניבה, שריפה ומים. התאמה מדויקת לשווי ולסיכוני האזור.",
    bullets: ["ביטוח מבנה", "ביטוח תכולה", "צד ג׳ למבנה", "כיסוי תכשיטים"],
  },
  {
    id: "business",
    sub: "פתרונות לעסק שלך",
    title: "ביטוח עסקים",
    desc: "ליווי צמוד לעסקים קטנים, בינוניים וגדולים. ביטוח רכוש, אחריות מקצועית, חבות מעבידים וסייבר — בהתאמה לענף.",
    bullets: ["רכוש עסקי", "חבות מעבידים", "אחריות מקצועית", "ביטוח סייבר"],
  },
  {
    id: "life",
    sub: "ביטחון למשפחה",
    title: "ביטוחי חיים ובריאות",
    desc: "תוכניות מותאמות אישית לכל שלב בחיים — ביטוח חיים, מחלות קשות, סיעוד וביטוחי בריאות פרטיים מהחברות המובילות.",
    bullets: ["ביטוח חיים", "מחלות קשות", "סיעוד", "בריאות פרטי"],
  },
  {
    id: "retirement",
    sub: "פנסיה וגמל",
    title: "תכנון פרישה",
    desc: "ניתוח מצב פנסיוני, אופטימיזציה של קופות גמל וקרנות השתלמות, ובניית תוכנית פרישה ארוכת טווח. ייעוץ אובייקטיבי.",
    bullets: ["פנסיה", "קופות גמל", "קרנות השתלמות", "ניהול תיקי השקעות"],
  },
  {
    id: "finance",
    sub: "ניהול הון משפחתי",
    title: "פיננסים",
    desc: "ייעוץ פיננסי כולל — משכנתאות, הלוואות, חיסכון לטווח ארוך והשקעות. בנייה של תמונה כלכלית בהירה למשפחה ולעסק.",
    bullets: ["משכנתאות", "ניהול חוב", "חיסכון", "השקעות"],
  },
];

export default function Categories() {
  return (
    <section id="categories" className="section section--bordered">
      <div className="container">
        <div className="section__head">
          <div>
            <div className="eyebrow">תחומי הליווי</div>
            <h2 className="section__title">
              שישה תחומים.
              <br />
              <em>תיק ביטוח אחד שלם.</em>
            </h2>
          </div>
          <p className="section__lede">
            במקום לפזר את הביטוחים בין סוכנים שונים, אצלנו כל התחומים מנוהלים תחת קורת גג אחת — עם איש קשר אישי שמכיר אותך, את העסק ואת המשפחה. ככה רואים את התמונה השלמה ומונעים כפילויות וחורים בכיסוי.
          </p>
        </div>

        <div className="cards">
          {CATEGORIES.map((c) => (
            <Link href={`/insurance/${c.id}`} className="card" key={c.id}>
              <span className="card__sub">{c.sub}</span>
              <h3 className="card__title">{c.title}</h3>
              <p className="card__desc">{c.desc}</p>
              <ul className="card__bullets">
                {c.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
              <span className="card__cta">
                קרא עוד <span className="card__cta-arrow">←</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
