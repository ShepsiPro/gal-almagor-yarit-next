import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";
import Quote from "@/components/Quote";
import { INSURANCE_CONTENT, INSURANCE_SLUGS } from "@/lib/insurance-data";
import { TEL_HREF } from "@/lib/site";

type Params = { slug: string };
type PageProps = { params: Promise<Params> };

export function generateStaticParams(): Params[] {
  return INSURANCE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = INSURANCE_CONTENT[slug];
  if (!c) return {};
  return {
    title: `${c.eyebrow} · גל אלמגור יערית · שלומי`,
    description: c.intro,
    openGraph: {
      title: `${c.eyebrow} · גל אלמגור יערית · שלומי`,
      description: c.intro,
      type: "article",
      locale: "he_IL",
    },
  };
}

export default async function InsurancePage({ params }: PageProps) {
  const { slug } = await params;
  const content = INSURANCE_CONTENT[slug];
  if (!content) notFound();

  const related = content.relatedTo
    .map((slug) => INSURANCE_CONTENT[slug])
    .filter(Boolean);

  // On the car page the bottom lead form is replaced by the live quote
  // simulator, so the page's CTAs scroll to it (#quote) instead of #contact.
  const hasSimulator = slug === "car";
  const ctaHref = hasSimulator ? "#quote" : "#contact";

  return (
    <>
      <Header />

      <section id="main-content" tabIndex={-1} className="info-hero">
        <div className="container info-hero__inner">
          <nav className="info-crumbs" aria-label="breadcrumbs">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <Link href="/#categories">תחומי הליווי</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">{content.eyebrow}</span>
          </nav>

          <div className="info-hero__head">
            <span className="info-hero__eyebrow">{content.eyebrow}</span>
          </div>

          <h1 className="info-hero__title">{content.title}</h1>
          <p className="info-hero__intro">{content.intro}</p>

          <div className="info-hero__ctas">
            <a href={ctaHref} className="btn-primary">
              {hasSimulator ? "לסימולטור הביטוח" : "שיחת ייעוץ ללא עלות"}
            </a>
            <Link href="/#categories" className="btn-link">
              <span className="btn-link__arrow">←</span>
              חזרה לתחומי הליווי
            </Link>
          </div>
        </div>
      </section>

      <section className="info-body">
        <div className="container info-body__inner">
          <div className="info-body__main">
            {content.sections.map((s, i) => (
              <article className="info-section" key={i}>
                <div className="info-section__index">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h2 className="info-section__title">{s.title}</h2>
                  {s.body && <p className="info-section__body">{s.body}</p>}
                  {s.bullets && (
                    <>
                      {s.bulletsTitle && (
                        <h3 className="info-section__bullets-title">
                          {s.bulletsTitle}
                        </h3>
                      )}
                      <ul className="info-section__bullets">
                        {s.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          <aside className="info-aside">
            <div className="info-aside__card">
              <div className="info-aside__eyebrow">דברו איתנו</div>
              <h3 className="info-aside__title">
                רוצים הצעה מותאמת ל{content.eyebrow}?
              </h3>
              <p className="info-aside__desc">
                סניף שלומי של גל אלמגור עומד לרשותכם — שיחת ייעוץ ללא עלות
                והתחייבות, עם איש קשר אישי שמלווה אתכם לאורך כל הדרך.
              </p>
              <a href={ctaHref} className="btn-primary info-aside__cta">
                קבלת הצעה
              </a>
              <a href="tel:074-7506000" className="info-aside__phone">
                074-7506000
              </a>
            </div>

            {related.length > 0 && (
              <div className="info-related">
                <div className="info-related__eyebrow">תחומים קשורים</div>
                <ul className="info-related__list">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/insurance/${r.slug}`}>
                        <span className="info-related__title">
                          {r.eyebrow}
                        </span>
                        <span className="info-related__arrow">←</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>

      {hasSimulator ? (
        <Quote leadHref={TEL_HREF} />
      ) : (
        <Contact defaultTopic={content.topic} />
      )}
      <Footer />
    </>
  );
}
