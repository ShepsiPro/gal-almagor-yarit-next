import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AccessibilityWidget from "@/components/AccessibilityWidget";
import { SITE } from "@/lib/site";

const coherenti = localFont({
  src: [
    { path: "./fonts/Coherenti-Light.woff2",   weight: "300", style: "normal" },
    { path: "./fonts/Coherenti-Regular.woff",  weight: "400", style: "normal" },
    { path: "./fonts/Coherenti-Bold.woff2",    weight: "700", style: "normal" },
  ],
  variable: "--font-coherenti",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://almagor-yaarit.com"),
  // No canonical here: a canonical in the root layout is inherited by every
  // page that does not set its own, and it told Google that /about and all
  // six /insurance/* pages were copies of the home page. Each page declares
  // its own canonical instead (the home page in app/page.tsx).
  title: "גל אלמגור יערית · סוכנות ביטוח · שלומי",
  description:
    "סוכנות ביטוח עצמאית בשלומי, חברה בקבוצת גל אלמגור. ביטוחי רכב, דירה, עסקים, חיים ובריאות, פרישה ופיננסים, בליווי אישי לכל מהלך התיק.",
  openGraph: {
    title: "גל אלמגור יערית · סוכנות ביטוח · שלומי",
    description:
      "סוכנות ביטוח עצמאית בשלומי, חברה בקבוצת גל אלמגור. 40+ שנות ניסיון בליווי משפחות ועסקים בגליל המערבי.",
    type: "website",
    locale: "he_IL",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E4164",
  width: "device-width",
  initialScale: 1,
};

// Structured data for the whole site: the agency as an InsuranceAgency entity
// and the WebSite it publishes. `creator` names the studio that built and runs
// the site with the same @id mslahtk.ai declares for itself, so search and AI
// engines can join the two graphs.
const SITE_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "InsuranceAgency",
      "@id": `${SITE.url}/#org`,
      name: "גל אלמגור יערית",
      alternateName: SITE.brand,
      url: SITE.url,
      telephone: SITE.phoneE164,
      email: SITE.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "קניון שלומי (תצפית)",
        addressLocality: "שלומי",
        addressCountry: "IL",
      },
      areaServed: { "@type": "AdministrativeArea", name: "הגליל המערבי" },
      memberOf: { "@type": "Organization", name: SITE.group },
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"], opens: "09:00", closes: "16:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: "Friday", opens: "09:00", closes: "13:00" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: "גל אלמגור יערית",
      inLanguage: "he",
      publisher: { "@id": `${SITE.url}/#org` },
      creator: {
        "@type": "Organization",
        "@id": "https://mslahtk.ai#organization",
        name: "Mslahtk",
        url: "https://mslahtk.ai",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={coherenti.variable} suppressHydrationWarning>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_GRAPH) }} />
        <a href="#main-content" className="skip-link">
          דילוג לתוכן הראשי
        </a>
        <div className="site-root">{children}</div>
        <AccessibilityWidget />
      </body>
    </html>
  );
}
