// Von Hand recherchierte, menschlich verifizierte Bodenrichtwerte als
// Fallback, wenn die automatisierte Live-Abfrage (siehe
// bodenrichtwerteNiedersachsen.ts) `null` liefert – aktuell der Regelfall,
// da die amtlichen Dienste automatisierte Anfragen offenbar grundsätzlich
// mit HTTP 403 ablehnen. Diese Werte sind deshalb kein Ersatz für eine
// echte Live-Anbindung, sondern eine bewusste Zwischenlösung: besser eine
// im Zweifel leicht veraltete, aber menschlich geprüfte Zahl als gar keine
// amtliche Referenz.
//
// Pflege: Bodenrichtwerte gelten jeweils zum Stichtag 1. Januar und werden
// von den Gutachterausschüssen jährlich neu festgestellt – Einträge hier
// sollten mindestens einmal jährlich gegen https://www.bodenrichtwerte-boris.de/
// oder https://immobilienmarkt.niedersachsen.de/ geprüft und aktualisiert
// werden. Suche ist bewusst simpel (Teilstring-Match auf Ortsteil/Ort),
// da diese Tabelle nur wenige, gezielt recherchierte Einträge enthalten
// soll, keine Vollabdeckung.

import type { BodenrichtwertErgebnis } from "./types";

interface ReferenzEintrag {
  /** Ortsteil oder Ort, wie er im Freitext der Objektdaten-Lage vorkommen könnte. */
  suchbegriff: string;
  bodenrichtwertEurProQm: number;
  stichtag: string;
  quelle: string;
  quellUrl: string;
}

const REFERENZWERTE: ReferenzEintrag[] = [
  {
    suchbegriff: "lesumstotel",
    bodenrichtwertEurProQm: 281,
    stichtag: "2025 (manuell recherchiert, exaktes Stichtagsjahr nicht gegen BORIS.NI verifiziert)",
    quelle: "Bodenrichtwert-Referenz Lesumstotel (Ritterhude) – manuell recherchiert",
    quellUrl: "https://www.bodenrichtwerte-boris.de/",
  },
  {
    suchbegriff: "ritterhude",
    // Gemeindedurchschnitt Ritterhude laut Recherche ca. 106–215 EUR/m² je
    // nach Zone/Stichtag; hier bewusst der Mittelwert der Spanne, weniger
    // präzise als der Lesumstotel-Eintrag (der als Ortsteil spezifischer
    // ist und deshalb vorrangig geprüft wird).
    bodenrichtwertEurProQm: 160,
    stichtag: "2025 (Mittelwert einer recherchierten Spanne von ca. 106–215 EUR/m², nicht zonengenau)",
    quelle: "Bodenrichtwert-Referenz Gemeinde Ritterhude (Mittelwert, manuell recherchiert)",
    quellUrl: "https://www.bodenrichtwerte-boris.de/",
  },
];

export function findeBodenrichtwertReferenz(lageOrOrt: string): BodenrichtwertErgebnis | null {
  const suchtext = lageOrOrt.toLowerCase();
  const treffer = REFERENZWERTE.find((eintrag) => suchtext.includes(eintrag.suchbegriff));
  if (!treffer) return null;
  return {
    bodenrichtwertEurProQm: treffer.bodenrichtwertEurProQm,
    stichtag: treffer.stichtag,
    quelle: treffer.quelle,
    quellUrl: treffer.quellUrl,
  };
}
