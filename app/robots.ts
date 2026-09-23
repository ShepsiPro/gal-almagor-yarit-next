import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Staff and customer-only areas stay out of search: the back office, the
// customer forms (every one of them is also noindex) and the API routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/forms", "/api/", "/mslahtk/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
