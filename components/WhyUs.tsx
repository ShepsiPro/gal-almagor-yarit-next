const REASONS = [
  { num: "01", title: "מקומיים",        desc: "המשרד בשלומי. פגישות פנים-אל-פנים, בלי תורים ובלי מוקדים." },
  { num: "02", title: "אובייקטיביים",    desc: "אנחנו עובדים מול 23 חברות ביטוח, ובוחרים בכל מקרה את המתאים לך." },
  { num: "03", title: "זמינים בתביעה",   desc: "ברגע האמת אנחנו זה שמדבר עם חברת הביטוח, לא אתם." },
  { num: "04", title: "תיק אחד שלם",     desc: "כל הביטוחים תחת קורת גג אחת, עם תמונה מלאה ובלי כפילויות." },
];

export default function WhyUs() {
  return (
    <section id="why" className="why">
      <div className="container">
        <div className="why__eyebrow">למה אנחנו</div>
        <h2 className="why__title">
          סוכן ביטוח טוב נמדד ביום שצריך אותו —
          <br />
          <em>לא ביום שמוכר לך פוליסה.</em>
        </h2>
        <div className="why__grid">
          {REASONS.map((r) => (
            <div className="reason" key={r.num}>
              <div className="reason__num">{r.num}</div>
              <div className="reason__title">{r.title}</div>
              <div className="reason__desc">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
