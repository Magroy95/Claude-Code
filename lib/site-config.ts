/**
 * Zentrale Stelle für Domain und Kernaussagen der Seite.
 * Domain hier eintragen, sobald sie feststeht – wird von Metadata,
 * Sitemap, Robots und JSON-LD referenziert.
 */
export const siteConfig = {
  name: "HauskaufChecker",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hauskaufchecker.de",
  titleTemplate: "%s – HauskaufChecker",
  defaultTitle: "HauskaufChecker – Ersteinschätzung vor dem Hauskauf",
  description:
    "Lade das Exposé deiner Wunschimmobilie hoch und erhalte eine fundierte KI-Ersteinschätzung zu Bausubstanz, Modernisierungskosten, Marktwert und Risiken – bevor du für ein Bausachverständigen-Gutachten zahlst.",
  keywords: [
    "Hauskauf prüfen",
    "Immobilie Ersteinschätzung",
    "Bausubstanz Check",
    "Hauskauf Checkliste",
    "Modernisierungskosten berechnen",
    "Exposé prüfen",
    "Immobiliengutachten Alternative",
    "Sanierungsstau erkennen",
  ],
  locale: "de_DE",
} as const;
