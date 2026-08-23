import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/preise", changeFrequency: "monthly", priority: 0.8 },
    { path: "/beispielreport", changeFrequency: "monthly", priority: 0.7 },
    { path: "/datenschutz", changeFrequency: "yearly", priority: 0.3 },
    { path: "/impressum", changeFrequency: "yearly", priority: 0.3 },
    // /nutzungsbedingungen wird auf /agb umgeleitet; der alte Pfad steht
    // hier nicht mehr, damit die Sitemap keine Weiterleitung meldet.
    { path: "/agb", changeFrequency: "yearly", priority: 0.3 },
    { path: "/widerruf", changeFrequency: "yearly", priority: 0.3 },
  ];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
