import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "סוכנות יערית · ביטוח · שלומי",
    short_name: "יערית",
    description:
      "סוכנות ביטוח עצמאית בשלומי, חברה בקבוצת גל אלמגור. ביטוחי רכב, דירה, עסקים, חיים ובריאות, פרישה ופיננסים.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1E4164",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
