const PARTNERS = [
  { src: "/logos/ayalon.svg",     alt: "איילון" },
  { src: "/logos/hachshara.webp", alt: "הכשרה ביטוח ופיננסים" },
  { src: "/logos/phoenix.svg",    alt: "הפניקס" },
  { src: "/logos/harel.svg",      alt: "הראל" },
  { src: "/logos/clal.jpg",       alt: "כלל ביטוח ופיננסים" },
  { src: "/logos/migdal.svg",     alt: "מגדל ביטוח ופיננסים" },
  { src: "/logos/menora.svg",     alt: "מנורה מבטחים" },
  { src: "/logos/shlomo.svg",     alt: "שלמה ביטוח" },
];

export default function Partners() {
  return (
    <section id="partners" className="section section--bordered">
      <div className="container">
        <div className="section__head partners__head">
          <div>
            <div className="eyebrow">חברות הביטוח שלנו</div>
            <h2 className="section__title section__title--md">
              עובדים מול
              <br />
              <em>החברות המובילות.</em>
            </h2>
          </div>
          <p className="section__lede partners__lede">
            אנחנו לא מוגבלים לחברה אחת. בכל פנייה אנחנו משווים הצעות מכל החברות שאנחנו עובדים מולן, ובוחרים את הכיסוי שמתאים לך — בלי מוטיבציה זרה.
          </p>
        </div>

        <div className="partners__grid">
          {PARTNERS.map((p) => (
            <div className="partner" key={p.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="partner__logo" src={p.src} alt={p.alt} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
