const SUPPORTING_STATS = [
  { num: "4,200+", label: "לקוחות פעילים" },
  { num: "23",     label: "חברות ביטוח שותפות" },
  { num: "18",     label: "שנות פעילות בקבוצת גל אלמגור" },
  { num: "97%",    label: "לקוחות שמחדשים" },
];

export default function Stats() {
  return (
    <section className="stats">
      <div className="container stats__inner">
        <div className="lead-stat">
          <div className="lead-stat__eyebrow">ניסיון מוכח · 1986</div>
          <div className="lead-stat__display">
            <span className="lead-stat__num">40</span>
            <span className="lead-stat__plus">+</span>
          </div>
          <div className="lead-stat__label">שנות ניסיון בענף הביטוח</div>
          <p className="lead-stat__sub">
            מלווים משפחות ובעלי עסקים בגליל המערבי כבר ארבעה עשורים.
            {" "}
            <strong>18 מהן בגב של קבוצת גל אלמגור</strong>
            {" "}
            — ארצית, חזקה, וכאן בשבילכם.
          </p>
        </div>

        <div className="stats__row">
          {SUPPORTING_STATS.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat__num">{s.num}</div>
              <div className="stat__label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
