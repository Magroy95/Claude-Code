import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Analyse-Ergebnisse enthalten personenbezogene/objektbezogene Daten
      // einzelner Nutzer und sollen nicht crawlbar/indexierbar sein.
      disallow: ["/analyse/", "/api/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
