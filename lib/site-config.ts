/**
 * Zentrale Stelle für Domain und Kernaussagen der Seite.
 * Domain hier eintragen, sobald sie feststeht – wird von Metadata,
 * Sitemap, Robots und JSON-LD referenziert.
 */
/**
 * Anbieterangaben für Impressum, AGB, Widerruf und Datenschutz.
 *
 * VOR DEM LIVEGANG AUSFÜLLEN: Ohne ladungsfähige Anschrift ist das
 * Impressum unvollständig, und ein unvollständiges Impressum ist bei einem
 * geschäftsmäßigen Angebot abmahnfähig (§ 5 DDG).
 */
export const ANBIETER = {
  name: process.env.ANBIETER_NAME ?? "[Name / Firma – bitte eintragen]",
  strasse: process.env.ANBIETER_STRASSE ?? "[Straße, Hausnummer]",
  plzOrt: process.env.ANBIETER_PLZ_ORT ?? "[PLZ, Ort]",
  email: process.env.ANBIETER_EMAIL ?? "[kontakt@hauskaufchecker.de]",
  verantwortlich: process.env.ANBIETER_VERANTWORTLICH ?? "[Name der verantwortlichen Person]",
} as const;

export const siteConfig = {
  name: "HauskaufChecker",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hauskaufchecker.de",
  titleTemplate: "%s – HauskaufChecker",
  defaultTitle: "HauskaufChecker – Ersteinschätzung vor der Besichtigung",
  description:
    "Laden Sie das Exposé Ihres Wunschhauses hoch und erhalten Sie eine Ersteinschätzung zu Bausubstanz, Sanierungskosten, Marktwert und Risiken – rechtzeitig vor der Besichtigung, mit den richtigen Fragen für den Termin.",
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
