// Deterministische Herleitung des Gewerke-Status aus Baujahr, Erneuerungsjahr
// und technischer Nutzungsdauer.
//
// Warum das hier gerechnet und nicht vom Modell beurteilt wird: Nachdem die
// Kostenkennwerte aus der Referenztabelle kommen (sanierungskosten.ts), war
// die Streuung im Sanierungsstau nicht verschwunden, sondern nur eine Ebene
// tiefer gewandert. Zwei von drei Läufen desselben Objekts lieferten auf den
// Euro identische Summen – der dritte wich ab, weil ein einzelnes Gewerk
// anders eingestuft wurde. Bei einem zweiten Objekt ergaben drei Läufe drei
// verschiedene Zustandsbilder (5, 6 und 4 Gewerke mit Handlungsbedarf) und
// damit drei verschiedene Summen. Nicht die Beträge schwanken also noch,
// sondern die Frage, welche Posten überhaupt zählen.
//
// Das Modell liefert deshalb auch hier nur noch nachprüfbare Fakten – wurde
// das Gewerk laut Exposé erneuert, und wenn ja, wann – und der Status ergibt
// sich daraus.
//
// -------------------------------------------------------------------------
// QUELLENLAGE – wichtig, bevor diese Tabelle erweitert wird:
//
// Vollständig belegbar war diese Tabelle bislang nicht. Die maßgeblichen
// Primärquellen sind aus der Ausführungsumgebung nicht erreichbar (die
// Netzwerk-Policy blockt den Abruf auf Proxy-Ebene, HTTP 403):
//   - ImmoWertV 2021, Anlage 2, Tabelle 1 (Modernisierungselemente mit
//     Punkten und Betrachtungszeiträumen) – gesetze-im-internet.de und
//     sämtliche Spiegel
//   - BBSR-Nutzungsdauertabelle "Nutzungsdauern von Bauteilen für
//     Lebenszyklusanalysen nach BNB" (Stand 04.11.2025) –
//     nachhaltigesbauen.de
//   - BTE-Arbeitsblatt "Lebensdauer von Bauteilen, Zeitwerte"
//
// Aufgenommen sind daher NUR Gewerke, für die aus der Recherche ein konkreter
// Zahlenwert mit Quelle vorlag. Für die übrigen steht hier bewusst kein
// Eintrag: Ohne Beleg wird nichts angesetzt, und der Status bleibt dann bei
// der Einschätzung des Modells (siehe leiteStatusAb, Rückgabe null). Lieber
// ein Gewerk weiterhin unbestimmt als eine erfundene Nutzungsdauer, die im
// Report wie eine Norm aussieht.
// -------------------------------------------------------------------------

import type { Gewerk, GewerkStatus } from "./schema";

export interface NutzungsdauerAngabe {
  /** Untere Grenze der üblichen technischen Nutzungsdauer in Jahren. */
  jahreMin: number;
  /** Obere Grenze in Jahren. */
  jahreMax: number;
  /** Was genau diese Nutzungsdauer beschreibt. */
  bezeichnung: string;
  quellen: string[];
}

/**
 * Nur belegte Einträge. Bewusst unvollständig – siehe Quellenlage oben.
 * Nicht enthalten und noch zu belegen: DACH (die recherchierten Werte
 * beziehen sich auf den Ziegel selbst, nicht auf das Dachsystem aus Lattung,
 * Unterdeckbahn und Eindeckung), FASSADE, INNENAUSBAU. SCHADSTOFFE hat
 * naturgemäß keine Nutzungsdauer – dort entscheidet die Baualtersklasse,
 * nicht der Verschleiß.
 */
export const NUTZUNGSDAUER: Partial<Record<Gewerk, NutzungsdauerAngabe>> = {
  FENSTER: {
    jahreMin: 40,
    jahreMax: 60,
    bezeichnung: "Fensterrahmen aus Holz, Aluminium oder Kunststoff",
    quellen: [
      "fertighaus.de/ratgeber – Lebensdauer von Bauteilen und Bauteilschichten (Fensterrahmen Holz/Aluminium/Kunststoff: 40–60 Jahre)",
    ],
  },
  HEIZUNG: {
    jahreMin: 15,
    jahreMax: 25,
    bezeichnung: "Wärmeerzeuger der Heizungsanlage",
    quellen: [
      "Paritätische Lebensdauertabelle HEV/Mieterverband, wiedergegeben bei raiffeisen.ch und houzy.ch (Heizungsanlage: 15–25 Jahre)",
    ],
  },
  SANITAER: {
    jahreMin: 25,
    jahreMax: 50,
    bezeichnung: "Sanitärinstallation einschließlich Leitungsnetz",
    quellen: [
      "Paritätische Lebensdauertabelle HEV/Mieterverband, wiedergegeben bei raiffeisen.ch und houzy.ch (Sanitärinstallation: 25–50 Jahre; Leitungsnetz in der Regel nach 30–50 Jahren erneuert)",
    ],
  },
};

/** Gewerke, für die noch kein belegter Wert vorliegt – für Report und Tests. */
export const NUTZUNGSDAUER_OFFEN: Gewerk[] = [
  "DACH",
  "FASSADE",
  "ELEKTRO",
  "INNENAUSBAU",
  "SCHADSTOFFE",
];

/** Die im Exposé belegten Angaben zum Erneuerungsstand eines Gewerks. */
export interface ErneuerungsFakten {
  /** Steht im Exposé, dass dieses Gewerk erneuert wurde? */
  erneuertLautExpose: boolean;
  /** Genanntes Jahr der Erneuerung, sonst null. */
  erneuerungsJahr: number | null;
  /** Wörtlicher Beleg. Ohne ihn zählt erneuertLautExpose nicht. */
  zitatAusExpose: string | null;
}

export interface StatusHerleitung {
  status: GewerkStatus;
  /** Zugrunde gelegtes Alter des Gewerks in Jahren, null wenn unbestimmbar. */
  alterJahre: number | null;
  /** Ein Satz, der die Einstufung im Report nachvollziehbar macht. */
  herleitung: string;
}

/**
 * Ein Gewerk gilt nur dann als erneuert, wenn dazu eine wörtliche Textstelle
 * vorliegt – dieselbe Zitatpflicht wie bei den Hypothesen. Ohne Beleg ist die
 * Behauptung nicht überprüfbar und wird verworfen.
 */
export function istErneuerungBelegt(fakten: ErneuerungsFakten): boolean {
  return fakten.erneuertLautExpose && (fakten.zitatAusExpose ?? "").trim().length > 0;
}

/**
 * Leitet den Status aus dem Alter des Gewerks ab.
 *
 * Rückgabe null bedeutet: Für dieses Gewerk liegt keine belegte
 * Nutzungsdauer vor. Dann bleibt es bei der Einschätzung des Modells – die
 * Herleitung greift bewusst nur dort, wo sie auf einer Quelle steht.
 *
 * Ausgelöst wird der Handlungsbedarf bereits am unteren Ende der
 * Nutzungsdauer, nicht erst am oberen. Das ist eine bewusste Entscheidung
 * zugunsten des Käufers: Der Report soll vor dem Kauf warnen, und ein Bauteil
 * im letzten Drittel seiner Lebensdauer ist eine Ausgabe, die der Käufer
 * einplanen muss – auch wenn es heute noch funktioniert.
 */
export function leiteStatusAb(
  gewerk: Gewerk,
  fakten: ErneuerungsFakten,
  baujahr: number | null,
  bewertungsjahr: number,
): StatusHerleitung | null {
  const dauer = NUTZUNGSDAUER[gewerk];
  if (!dauer) return null;

  const belegt = istErneuerungBelegt(fakten);
  // Maßgeblich ist das Erneuerungsjahr, sonst das Baujahr des Hauses.
  const bezugsjahr = belegt && fakten.erneuerungsJahr !== null ? fakten.erneuerungsJahr : baujahr;

  if (bezugsjahr === null) {
    // Erneuerung behauptet, aber ohne Jahr und ohne Baujahr: kein Alter
    // bestimmbar. Wenn immerhin ein Beleg vorliegt, ist das ein Hinweis,
    // aber keine Grundlage für eine Einstufung.
    return {
      status: "NICHT_BEURTEILBAR",
      alterJahre: null,
      herleitung: belegt
        ? "Erneuerung im Exposé erwähnt, aber ohne Jahresangabe – und ohne Baujahr lässt sich kein Alter bestimmen."
        : "Weder Baujahr noch Erneuerungsjahr bekannt – das Alter des Gewerks ist nicht bestimmbar.",
    };
  }

  const alter = bewertungsjahr - bezugsjahr;
  const quelle =
    belegt && fakten.erneuerungsJahr !== null
      ? `Erneuerung ${fakten.erneuerungsJahr} laut Exposé`
      : `Baujahr ${bezugsjahr}, keine belegte Erneuerung`;

  if (alter >= dauer.jahreMax) {
    return {
      status: "HANDLUNGSBEDARF",
      alterJahre: alter,
      herleitung:
        `${quelle} → ${alter} Jahre alt. Die übliche Nutzungsdauer (${dauer.bezeichnung}, ` +
        `${dauer.jahreMin}–${dauer.jahreMax} Jahre) ist überschritten.`,
    };
  }
  if (alter >= dauer.jahreMin) {
    return {
      status: "HANDLUNGSBEDARF",
      alterJahre: alter,
      herleitung:
        `${quelle} → ${alter} Jahre alt und damit im Erneuerungsfenster ` +
        `(${dauer.bezeichnung}, ${dauer.jahreMin}–${dauer.jahreMax} Jahre). Die Ausgabe ist absehbar und einzuplanen.`,
    };
  }
  return {
    status: "ERNEUERT",
    alterJahre: alter,
    herleitung:
      `${quelle} → ${alter} Jahre alt. Das liegt unter der üblichen Nutzungsdauer ` +
      `(${dauer.bezeichnung}, ${dauer.jahreMin}–${dauer.jahreMax} Jahre); im Betrachtungszeitraum ist kein Ersatz zu erwarten.`,
  };
}
