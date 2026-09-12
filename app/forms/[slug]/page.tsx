import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormRenderer from "@/components/FormRenderer";
import { FORM_SLUGS, getForm, prefillableFields } from "@/lib/forms";
import { SITE, TEL_HREF } from "@/lib/site";
import { verifyPrefillToken } from "@/lib/prefill";

type PageProps = {
  params: Promise<{ slug: string }>;
  // The agent can personalise a link before sending it, without any backend:
  // /forms/car?name=ישראל%20ישראלי&phone=0501234567
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return FORM_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) return {};
  return {
    title: `${form.title} · ${SITE.brand}`,
    description: form.intro,
    // Fill links are handed to a specific customer — they should never surface
    // in search results.
    robots: { index: false, follow: false },
  };
}

export default async function FormPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) notFound();

  const query = await searchParams;
  const prefill: Record<string, string> = {};
  // Each form declares which of its own fields a link may fill, so a new form
  // is prefillable the day it is written rather than the day someone
  // remembers to add its field names to a list over here.
  for (const key of prefillableFields(form)) {
    const raw = query[key] ?? query[key.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) prefill[key] = value.slice(0, 120);
  }

  // A signed `?p=` token is the agency re-sending this form with answers already
  // filled, some of them locked. It wins over the loose query parameters above,
  // which anyone can type. The token itself is passed on to the renderer so it
  // travels back with the submission and the API can re-check the locks — a
  // lock enforced only in the browser is decoration.
  const rawToken = Array.isArray(query.p) ? query.p[0] : query.p;
  const sent = verifyPrefillToken(rawToken);
  const locked = sent && sent.slug === slug ? sent.locked : [];
  if (sent && sent.slug === slug) Object.assign(prefill, sent.values);

  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1} className="fpage">
        <div className="fpage__inner">
          <nav className="info-crumbs" aria-label="פירורי לחם">
            <Link href="/">בית</Link>
            <span className="info-crumbs__sep">/</span>
            <span className="info-crumbs__current">{form.eyebrow}</span>
          </nav>

          <div className="eyebrow">{form.eyebrow}</div>
          <h1 className="fpage__title">{form.title}</h1>
          <p className="fpage__intro">{form.intro}</p>
          <p className="fpage__meta">
            נתקעתם? התקשרו אלינו{" "}
            <a href={TEL_HREF} dir="ltr">
              {SITE.phoneDisplay}
            </a>{" "}
            ונשלים יחד.
          </p>

          <FormRenderer
            form={form}
            prefill={prefill}
            locked={locked}
            prefillToken={sent && sent.slug === slug ? rawToken : undefined}
          />
        </div>
      </main>

      <Footer />
    </>
  );
}
