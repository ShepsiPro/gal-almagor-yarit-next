import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { INSURANCE_SLUGS } from "@/lib/insurance-data";

// Public pages only. The back office (/admin), the customer forms (/forms,
// reached through personal links) and the API stay out, same as robots.ts.
// lastModified is the last real change to the site's copy; bump it when the
// pages change (a fresh "now" on every request teaches crawlers to ignore it).
const UPDATED = new Date("2026-09-23T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly") => ({
    url: `${SITE.url}${path}`,
    lastModified: UPDATED,
    changeFrequency,
    priority,
  });
  return [
    page("", 1, "weekly"),
    ...INSURANCE_SLUGS.map((slug) => page(`/insurance/${slug}`, 0.9, "monthly")),
    page("/simulator/home", 0.8, "monthly"),
    page("/about", 0.7, "monthly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
    page("/accessibility", 0.3, "yearly"),
  ];
}
