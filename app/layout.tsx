import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  metadataBase: new URL("https://www.almagor-yaarit.com"),
  title: "גל אלמגור יערית · סוכנות ביטוח · שלומי",
  description:
    "סוכנות ביטוח עצמאית בשלומי, חברה בקבוצת גל אלמגור. ביטוחי רכב, דירה, עסקים, חיים ובריאות, פרישה ופיננסים — בליווי אישי לכל מהלך התיק.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={coherenti.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
