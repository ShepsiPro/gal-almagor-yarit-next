import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormRenderer from "@/components/FormRenderer";
import { FORM_SLUGS, getForm } from "@/lib/forms";
import { SITE, TEL_HREF } from "@/lib/site";

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

const PREFILLABLE = ["fullName", "phone", "email", "plate", "policyNumber"] as const;

export default async function FormPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) notFound();

  const query = await searchParams;
  const prefill: Record<string, string> = {};
  for (const key of PREFILLABLE) {
    const raw = query[key] ?? query[key.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) prefill[key] = value.slice(0, 120);
  }

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

          <FormRenderer form={form} prefill={prefill} />
        </div>
      </main>

      <Footer />
    </>
  );
}
