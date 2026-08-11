// Referenztabelle für den Sanierungsstau.
//
// Warum es sie gibt: Die Gewerke-Checkliste hat die Zahl der Kostenposten
// stabilisiert (immer acht), nicht aber deren Höhe. Bei fünf Läufen desselben
// Objekts streute die untere Summengrenze weiterhin um 50.000 EUR, die obere
// um 85.000 EUR – das Modell darf je Gewerk eine freie Spanne schätzen und
// tut das jedes Mal etwas anders. Deshalb liefert das Modell hier gar keine
// Beträge mehr. Es beurteilt nur noch den Zustand je Gewerk
// (ERNEUERT / HANDLUNGSBEDARF / NICHT_BEURTEILBAR); der Kostenrahmen wird
// aus dieser Tabelle und den Objektdaten gerechnet. Bei identischem
// Zustandsbild ist die Summe damit exakt reproduzierbar.
//
// QUELLENLAGE – bitte vor dem Weiterverwenden lesen:
// Die Kennwerte stammen aus öffentlich zugänglichen Ratgeber- und
// Fachportalen (Stand der Recherche: August 2026), die je Gewerk gegeneinander
// abgeglichen wurden; jede Position führt ihre Quellen mit. Das ist eine
// belastbare Orientierung, aber KEINE Primärstatistik. Der Referenzstandard
// der Branche wären die Kostenkennwerte des Baukosteninformationszentrums
// Deutscher Architektenkammern (BKI Baukosten Gebäude/Positionen Altbau),
// die auf über 860 abgerechneten Objekten beruhen und regionale Baukosten-
// faktoren je Landkreis mitliefern – sie sind kostenpflichtig und liegen
// hier nicht vor. Solange das so ist, gilt: Die Spannen sind bewusst breit,
// und der Report weist sie als Orientierungswerte aus, nicht als Angebot.
//
// Ebenfalls bewusst nicht abgebildet: regionale Preisunterschiede. Die
// Stundensätze im Bauhauptgewerbe unterscheiden sich zwischen Süd- und
// Ostdeutschland um rund ein Drittel. Ein Regionalfaktor wäre der nächste
// sinnvolle Ausbauschritt, braucht aber eine Datenquelle je Landkreis.

import type { Gewerk, GewerkBefund, Objektdaten } from "./schema";

/** Worauf sich ein Kennwert bezieht. Bestimmt, wie die Menge ermittelt wird. */
export type BezugsgroesseTyp =
  | "WOHNFLAECHE"
  | "DACHFLAECHE"
  | "FASSADENFLAECHE"
  | "FENSTER_STUECK"
  | "BAD_STUECK"
  | "OBJEKT";

export interface Kostenkennwert {
  bezug: BezugsgroesseTyp;
  /** Anzeigeeinheit, z.B. "m² Dachfläche" oder "Bad". */
  einheit: string;
  eurProEinheitMin: number;
  eurProEinheitMax: number;
  /**
   * Abweichender Kennwert für jede Einheit ab der zweiten. Nur dort gesetzt,
   * wo die Quellen tatsächlich staffeln – bei Bädern etwa liegt das
   * Familienbad deutlich über dem zweiten, kleineren Bad. Ohne Staffelung
   * würde die Obergrenze allein durch Vervielfachung des teuersten Falls
   * aufgeblasen.
   */
  folgeEinheitMin?: number;
  folgeEinheitMax?: number;
  /** Was in dem Preis enthalten ist – gehört in den Report, nicht nur ins Changelog. */
  leistungsumfang: string;
  quellen: string[];
}

// --- Geometrieannahmen ------------------------------------------------------
// Exposés nennen fast immer die Wohnfläche, fast nie Dach- oder Fassaden-
// fläche. Diese Flächen werden deshalb aus der Wohnfläche hergeleitet. Jede
// Annahme steht einzeln hier, damit sie im Report benannt und später einzeln
// korrigiert werden kann.

/**
 * Geschosse, wenn das Exposé nichts anderes hergibt. Zwei Vollgeschosse
 * (bzw. Erdgeschoss plus ausgebautes Dachgeschoss) sind beim freistehenden
 * Einfamilienhaus der Regelfall.
 */
export const GESCHOSSE_STANDARD = 2;

/**
 * Dachfläche = Grundfläche x 1,4. Der Faktor ist der Kehrwert des Kosinus
 * der Dachneigung (1/cos 40° = 1,31; 1/cos 30° = 1,16) zuzüglich
 * Dachüberstand und entspricht der in der Dachdeckerpraxis gebräuchlichen
 * Faustregel für das geneigte Dach.
 * Quelle: hilfreiche-tools.de/dachflaeche-berechnen, mohr-dachbaustoffe.de
 */
export const DACHFLAECHENFAKTOR = 1.4;

/**
 * Geschosshöhe inklusive Deckenaufbau. Bei 2,50 m lichter Raumhöhe (Regelmaß
 * der Landesbauordnungen für Aufenthaltsräume) plus Rohdecke und Aufbau.
 * Annahme, keine Messgröße – deshalb hier isoliert.
 */
export const GESCHOSSHOEHE_M = 2.75;

/**
 * Abzug für Fenster- und Türöffnungen von der Bruttofassadenfläche. Nicht
 * frei gegriffen, sondern rückgerechnet: Für ein typisches Einfamilienhaus
 * werden rund 25 m² Fensterfläche angesetzt; das sind bei den hier
 * hergeleiteten Fassadenflächen (rund 150–190 m²) etwa 15 %.
 * Quelle Fensterfläche: oknoplast.de/blog/fenster-austauschen-kosten-2026
 */
export const OEFFNUNGSANTEIL_FASSADE = 0.15;

/**
 * Ein Fenster je rund 10 m² Wohnfläche. Ergibt für ein Haus mit 130 m²
 * dreizehn Fenster und trifft damit die in den Quellen genannte Spanne von
 * 10–15 Fenstern für ein typisches Einfamilienhaus.
 * Quelle: oknoplast.de/blog/fenster-austauschen-kosten-2026
 */
export const WOHNFLAECHE_JE_FENSTER_QM = 10;

/** Unter-/Obergrenze für die geschätzte Fensterzahl, damit Ausreißer nicht durchschlagen. */
export const FENSTER_MIN = 6;
export const FENSTER_MAX = 24;

// --- Kennwerte je Gewerk ----------------------------------------------------
// Mehrere Gewerke haben zwei Ausführungsvarianten mit deutlich verschiedenen
// Preisen (Dach nur neu decken vs. energetisch dämmen). Welche gilt, wird
// nicht geschätzt, sondern an einer Tatsache aus dem Exposé entschieden –
// siehe waehleVariante() weiter unten.

export const DACH_NEUEINDECKUNG: Kostenkennwert = {
  bezug: "DACHFLAECHE",
  einheit: "m² Dachfläche",
  eurProEinheitMin: 70,
  eurProEinheitMax: 150,
  leistungsumfang: "Neueindeckung inkl. Lattung, Unterdeckbahn, Gerüst und Entsorgung, ohne Dämmung",
  quellen: [
    "42watt.de/magazin/dach-neu-decken-kosten (80–150 EUR/m² ohne Dämmung)",
    "energie-fachberater.de – Was kostet eine Dachsanierung (überschlägig 50–100 EUR/m²)",
  ],
};

export const DACH_ENERGETISCH: Kostenkennwert = {
  bezug: "DACHFLAECHE",
  einheit: "m² Dachfläche",
  eurProEinheitMin: 150,
  eurProEinheitMax: 350,
  leistungsumfang:
    "Neueindeckung mit Dämmung (Auf- oder Zwischensparren), Unterdeckbahn, Gerüst, Anschlussdetails",
  quellen: [
    "42watt.de/magazin/dachdaemmung (150–350 EUR/m² energetische Sanierung; Aufsparrendämmung mit Neueindeckung 150–250 EUR/m²)",
    "wohnen-und-finanzieren.de/blog/dachdaemmung-kosten (Zwischensparrendämmung 130–230 EUR/m²)",
  ],
};

export const FASSADE_PUTZ: Kostenkennwert = {
  bezug: "FASSADENFLAECHE",
  einheit: "m² Fassadenfläche",
  eurProEinheitMin: 20,
  eurProEinheitMax: 45,
  leistungsumfang: "Instandsetzung und neuer Oberputz inkl. Gerüst, ohne Dämmung",
  quellen: [
    "energie-fachberater.de – Was kostet die Fassadensanierung (20–40 EUR/m² Handwerkerleistung, Deckputz 25–30 EUR/m²)",
  ],
};

export const FASSADE_WDVS: Kostenkennwert = {
  bezug: "FASSADENFLAECHE",
  einheit: "m² Fassadenfläche",
  eurProEinheitMin: 130,
  eurProEinheitMax: 200,
  leistungsumfang:
    "Wärmedämmverbundsystem inkl. Material, Gerüst, Montage und Oberputz (14–18 cm Dämmstärke nach GEG)",
  quellen: [
    "cleverbauen24.de/ratgeber/fassadendaemmung-kosten (120–200 EUR/m² inkl. Gerüst und Montage)",
    "oknoplast.de/blog/fassadendaemmung-kosten-2026 (EPS 20 cm: 135–165 EUR/m²; Mineralwolle: 155–200 EUR/m²)",
    "verbraucherzentrale.de – Rechenbeispiele für eine Fassadendämmung (160–200 EUR/m²)",
  ],
};

export const FENSTER_KENNWERT: Kostenkennwert = {
  bezug: "FENSTER_STUECK",
  einheit: "Fenster",
  eurProEinheitMin: 550,
  eurProEinheitMax: 1100,
  leistungsumfang:
    "Kunststofffenster mit Dreifachverglasung, Bezugsgröße 1,20 x 1,30 m, inkl. Ausbau, Einbau, Abdichtung und Entsorgung",
  quellen: [
    "oknoplast.de/blog/fenster-austauschen-kosten-2026 (650–1.100 EUR je Fenster inkl. Einbau)",
    "reduco.ai/blog/daemmung/fenster-austauschen-kosten-2026 (500–800 EUR je Standardfenster inkl. Einbau)",
  ],
};

export const HEIZUNG_KESSELTAUSCH: Kostenkennwert = {
  bezug: "OBJEKT",
  einheit: "Anlage",
  eurProEinheitMin: 10000,
  eurProEinheitMax: 20000,
  leistungsumfang: "Austausch des Wärmeerzeugers gegen ein gleichartiges System inkl. Einbau",
  quellen: [
    "energie-fachberater.de – Sanierungskosten Heizung (Wärmeerzeuger 10.000–20.000 EUR)",
  ],
};

export const HEIZUNG_WAERMEPUMPE: Kostenkennwert = {
  bezug: "OBJEKT",
  einheit: "Anlage",
  eurProEinheitMin: 25000,
  eurProEinheitMax: 45000,
  leistungsumfang:
    "Umstellung auf eine Luft-Wasser-Wärmepumpe inkl. Installation, Ausbau und Entsorgung des Altkessels, Anpassung der Heizflächen und hydraulischem Abgleich – vor Abzug der BEG-Förderung",
  quellen: [
    "enpal.de/waermepumpe/kosten (27.000–50.000 EUR vor Förderung)",
    "thermondo.de – Wärmepumpe Kosten (rund 32.000 EUR im Mittel für ein Einfamilienhaus)",
    "aroundhome.de – Gasheizung auf Wärmepumpe umrüsten (Rechenbeispiel 38.000 EUR: 28.000 Anlage + 2.000 Entsorgung + 7.000 Heizkörper + 1.000 hydraulischer Abgleich)",
  ],
};

export const ELEKTRO_KENNWERT: Kostenkennwert = {
  bezug: "WOHNFLAECHE",
  einheit: "m² Wohnfläche",
  eurProEinheitMin: 70,
  eurProEinheitMax: 150,
  leistungsumfang:
    "Erneuerung der Elektroinstallation inkl. Leitungen, Verteilung, Schalter und Steckdosen in Standardausstattung",
  quellen: [
    "haustec.de – Neue Elektroinstallation im Altbau (80–150 EUR/m² Komplettneuinstallation)",
    "wohnglueck.de/artikel/neue-elektrik-kosten (Erneuerung 60–85 EUR/m², gehobene Ausstattung 85–130 EUR/m²)",
  ],
};

export const SANITAER_KENNWERT: Kostenkennwert = {
  bezug: "BAD_STUECK",
  einheit: "Bad",
  // Erstes Bad als Familienbad (ca. 8 m²), jedes weitere als kleineres
  // Bad (ca. 5 m²) angesetzt – so steht es in den Quellen, und es verhindert,
  // dass die Obergrenze bei zwei Bädern auf das Doppelte des teuersten
  // Einzelfalls springt.
  eurProEinheitMin: 16000,
  eurProEinheitMax: 35000,
  folgeEinheitMin: 11000,
  folgeEinheitMax: 23000,
  leistungsumfang:
    "Komplettsanierung inkl. Demontage, neuer Leitungen, Abdichtung, Fliesen, Sanitärobjekten und Elektrik; " +
    "erstes Bad als Familienbad, jedes weitere als kleineres Bad angesetzt",
  quellen: [
    "neurealis.de/ratgeber/badsanierung-kosten (Familienbad ca. 8 m²: 16.000–35.000 EUR; kleines Bad ca. 5 m²: 11.000–23.000 EUR)",
    "meinhaus.de.com/badsanierung-kosten (12.000–35.000 EUR für eine vollständige Badsanierung)",
  ],
};

export const INNENAUSBAU_KENNWERT: Kostenkennwert = {
  bezug: "WOHNFLAECHE",
  einheit: "m² Wohnfläche",
  eurProEinheitMin: 150,
  eurProEinheitMax: 300,
  leistungsumfang: "Oberflächen und Innenausbau: Wände, Decken, Bodenbeläge, Innentüren, Malerarbeiten",
  quellen: [
    "so-innenausbau.de/altbausanierung-kosten (Innenausbau Wände, Decken, Böden, Malerarbeiten 150–300 EUR/m²)",
    "my-hammer.de – Preisradar Innenausbau/Sanierung",
  ],
};

/**
 * Schadstoffe sind der eine Posten, der sich aus einem Exposé grundsätzlich
 * nicht beziffern lässt: Ob und wie viel asbesthaltiges Material verbaut ist,
 * zeigt erst die Probenahme. Angesetzt wird deshalb nur, was sicher anfällt –
 * die Untersuchung. Der Rückbau selbst wird bewusst NICHT in die Summe
 * gerechnet, sondern als offener Posten ausgewiesen. Lieber eine ehrliche
 * Lücke als eine erfundene Zahl.
 */
export const SCHADSTOFFE_UNTERSUCHUNG: Kostenkennwert = {
  bezug: "OBJEKT",
  einheit: "Gutachten",
  eurProEinheitMin: 500,
  eurProEinheitMax: 1500,
  leistungsumfang:
    "Schadstoffgutachten mit Ortsbegehung, Probenahme, Laboranalyse und Bericht – ohne den Rückbau selbst",
  quellen: [
    "gutachten.org/schadstoffgutachten (vollständiges Gutachten inkl. Probenahme und Laboranalyse 500–1.500 EUR)",
    "obolus-group.de/asbest-gutachter-kosten (Materialprobe im Labor 50–150 EUR je Probe)",
  ],
};

/**
 * Zur Einordnung im Report, nicht zur Summenbildung: Was ein Rückbau kostet,
 * wenn die Probenahme fündig wird.
 */
export const SCHADSTOFFE_RUECKBAU_HINWEIS =
  "Rückbau und Entsorgung je nach Bauteil: fest gebundenes Asbest rund 30–50 EUR/m², " +
  "asbesthaltige Bodenbeläge 60–130 EUR/m², Fassadenplatten 120–200 EUR/m². " +
  "Quellen: my-hammer.de – Asbestsanierung Kosten; wohnglueck.de – Asbest entsorgen.";

// --- Variantenwahl ----------------------------------------------------------

/**
 * Ein Dach, das ohnehin neu gedeckt wird, wird bei schlechter Energieklasse
 * praktisch immer gleich gedämmt – beides getrennt zu beauftragen wäre
 * unwirtschaftlich, und das GEG verlangt bei der Gelegenheit ohnehin den
 * Mindestwärmeschutz. Die Variantenwahl hängt deshalb an einer Tatsache aus
 * dem Exposé statt an einer Einschätzung.
 */
export function energetischerBedarf(objektdaten: Objektdaten): boolean {
  const klasse = (objektdaten.energieklasse ?? "").trim().toUpperCase().charAt(0);
  if (["E", "F", "G", "H"].includes(klasse)) return true;
  if (["A", "B", "C", "D"].includes(klasse)) return false;
  // Ohne Klasse ersatzweise über den Bedarfswert: 150 kWh/(m²a) liegt an der
  // Grenze zwischen Klasse E und F.
  if (objektdaten.energiebedarfKwhM2a !== null) return objektdaten.energiebedarfKwhM2a >= 150;
  return false;
}

/** Fossiler Wärmeerzeuger – dann ist die Umstellung der realistische Fall. */
export function fossilerWaermeerzeuger(objektdaten: Objektdaten): boolean {
  const typ = (objektdaten.heizungstyp ?? "").toLowerCase();
  if (!typ) return false;
  return ["öl", "oel", "gas", "nachtspeicher", "kohle", "flüssiggas", "fluessiggas"].some((s) =>
    typ.includes(s),
  );
}

export function waehleKennwert(gewerk: Gewerk, objektdaten: Objektdaten): Kostenkennwert {
  switch (gewerk) {
    case "DACH":
      return energetischerBedarf(objektdaten) ? DACH_ENERGETISCH : DACH_NEUEINDECKUNG;
    case "FASSADE":
      return energetischerBedarf(objektdaten) ? FASSADE_WDVS : FASSADE_PUTZ;
    case "FENSTER":
      return FENSTER_KENNWERT;
    case "HEIZUNG":
      return fossilerWaermeerzeuger(objektdaten) ? HEIZUNG_WAERMEPUMPE : HEIZUNG_KESSELTAUSCH;
    case "ELEKTRO":
      return ELEKTRO_KENNWERT;
    case "SANITAER":
      return SANITAER_KENNWERT;
    case "INNENAUSBAU":
      return INNENAUSBAU_KENNWERT;
    case "SCHADSTOFFE":
      return SCHADSTOFFE_UNTERSUCHUNG;
  }
}

// --- Mengenermittlung -------------------------------------------------------

export interface Bezugsmenge {
  menge: number;
  einheit: string;
  /** Ein Satz, der die Herleitung im Report nachvollziehbar macht. */
  herleitung: string;
}

/**
 * Wohnfläche, auf die gerechnet wird. Fehlt sie im Exposé, greift ein
 * benannter Ersatzwert – der Report weist das dann aus.
 */
export const WOHNFLAECHE_ERSATZ_QM = 130;

export function ermittleBezugsmenge(
  bezug: BezugsgroesseTyp,
  objektdaten: Objektdaten,
): Bezugsmenge {
  const wohnflaecheBekannt = objektdaten.wohnflaecheQm !== null && objektdaten.wohnflaecheQm > 0;
  const wohnflaeche = wohnflaecheBekannt ? objektdaten.wohnflaecheQm! : WOHNFLAECHE_ERSATZ_QM;
  const wfHinweis = wohnflaecheBekannt
    ? `${Math.round(wohnflaeche)} m² Wohnfläche laut Exposé`
    : `${WOHNFLAECHE_ERSATZ_QM} m² Wohnfläche als Ersatzannahme (im Exposé nicht angegeben)`;

  const geschosse = objektdaten.geschosse ?? GESCHOSSE_STANDARD;
  const geschossHinweis =
    objektdaten.geschosse !== null
      ? `${geschosse} Geschosse laut Exposé`
      : `${GESCHOSSE_STANDARD} Geschosse als Standardannahme`;
  const grundflaeche = wohnflaeche / geschosse;

  switch (bezug) {
    case "WOHNFLAECHE":
      return { menge: Math.round(wohnflaeche), einheit: "m² Wohnfläche", herleitung: wfHinweis };

    case "DACHFLAECHE": {
      const menge = grundflaeche * DACHFLAECHENFAKTOR;
      return {
        menge: Math.round(menge),
        einheit: "m² Dachfläche",
        herleitung:
          `${wfHinweis}, ${geschossHinweis} → rund ${Math.round(grundflaeche)} m² Grundfläche, ` +
          `mal Faktor ${DACHFLAECHENFAKTOR.toLocaleString("de-DE")} für das geneigte Dach`,
      };
    }

    case "FASSADENFLAECHE": {
      // Kompakter, näherungsweise quadratischer Grundriss: Umfang = 4 x Wurzel(Grundfläche).
      const umfang = 4 * Math.sqrt(grundflaeche);
      const hoehe = geschosse * GESCHOSSHOEHE_M;
      const menge = umfang * hoehe * (1 - OEFFNUNGSANTEIL_FASSADE);
      return {
        menge: Math.round(menge),
        einheit: "m² Fassadenfläche",
        herleitung:
          `${wfHinweis}, ${geschossHinweis} → rund ${Math.round(umfang)} m Gebäudeumfang bei ` +
          `${hoehe.toLocaleString("de-DE")} m Höhe, abzüglich ${Math.round(OEFFNUNGSANTEIL_FASSADE * 100)} % für Fenster und Türen`,
      };
    }

    case "FENSTER_STUECK": {
      const roh = Math.round(wohnflaeche / WOHNFLAECHE_JE_FENSTER_QM);
      const menge = Math.min(FENSTER_MAX, Math.max(FENSTER_MIN, roh));
      return {
        menge,
        einheit: menge === 1 ? "Fenster" : "Fenster",
        herleitung: `${wfHinweis} → ein Fenster je ${WOHNFLAECHE_JE_FENSTER_QM} m², rund ${menge} Fenster`,
      };
    }

    case "BAD_STUECK": {
      const ausExpose = objektdaten.anzahlBadezimmer;
      if (ausExpose !== null && ausExpose > 0) {
        return {
          menge: ausExpose,
          einheit: ausExpose === 1 ? "Bad" : "Bäder",
          herleitung: `${ausExpose} ${ausExpose === 1 ? "Badezimmer" : "Badezimmer"} laut Exposé`,
        };
      }
      // Ohne Angabe: ab vier Zimmern ist ein zweites Bad der Regelfall.
      const menge = (objektdaten.zimmer ?? 0) >= 4 ? 2 : 1;
      return {
        menge,
        einheit: menge === 1 ? "Bad" : "Bäder",
        herleitung: `${menge} ${menge === 1 ? "Bad" : "Bäder"} als Annahme (Anzahl im Exposé nicht angegeben)`,
      };
    }

    case "OBJEKT":
      return { menge: 1, einheit: "Objekt", herleitung: "pauschal je Objekt" };
  }
}

// --- Berechnung -------------------------------------------------------------

export interface GewerkKosten {
  gewerk: Gewerk;
  kostenMinEur: number;
  kostenMaxEur: number;
  bezugsmenge: number;
  bezugsEinheit: string;
  mengenHerleitung: string;
  eurProEinheitMin: number;
  eurProEinheitMax: number;
  leistungsumfang: string;
  quellen: string[];
  /** Zusatzhinweis, wenn der Posten die Kosten absehbar nicht vollständig abbildet. */
  unvollstaendigerAnsatz: string | null;
}

/** Auf volle 500 EUR runden – die Kennwerte geben keine höhere Genauigkeit her. */
function runde(betrag: number): number {
  return Math.round(betrag / 500) * 500;
}

/**
 * Menge mal Kennwert, mit Staffelung ab der zweiten Einheit, wo der Kennwert
 * eine vorsieht.
 */
function summiereEinheiten(menge: number, erste: number, folge: number | undefined): number {
  if (folge === undefined || menge <= 1) return menge * erste;
  return erste + (menge - 1) * folge;
}

export function berechneGewerkKosten(gewerk: Gewerk, objektdaten: Objektdaten): GewerkKosten {
  const kennwert = waehleKennwert(gewerk, objektdaten);
  const menge = ermittleBezugsmenge(kennwert.bezug, objektdaten);
  return {
    gewerk,
    kostenMinEur: runde(
      summiereEinheiten(menge.menge, kennwert.eurProEinheitMin, kennwert.folgeEinheitMin),
    ),
    kostenMaxEur: runde(
      summiereEinheiten(menge.menge, kennwert.eurProEinheitMax, kennwert.folgeEinheitMax),
    ),
    bezugsmenge: menge.menge,
    bezugsEinheit: menge.einheit,
    mengenHerleitung: menge.herleitung,
    eurProEinheitMin: kennwert.eurProEinheitMin,
    eurProEinheitMax: kennwert.eurProEinheitMax,
    leistungsumfang: kennwert.leistungsumfang,
    quellen: kennwert.quellen,
    unvollstaendigerAnsatz: gewerk === "SCHADSTOFFE" ? SCHADSTOFFE_RUECKBAU_HINWEIS : null,
  };
}

export interface Sanierungsstau {
  sanierungsstauMinEur: number;
  sanierungsstauMaxEur: number;
  /** Gewerke mit Handlungsbedarf, jeweils mit gerechnetem Kostenrahmen. */
  posten: GewerkKosten[];
  /** Gewerke, die aus den Unterlagen nicht beurteilbar sind. */
  nichtBeurteilbar: Gewerk[];
  /** Posten, deren Umfang aus dem Exposé nicht bezifferbar ist (Schadstoffrückbau). */
  offeneRisiken: string[];
}

/**
 * Summiert ausschließlich Gewerke mit Handlungsbedarf. Da die Checkliste
 * immer alle acht Positionen enthält und die Beträge aus der Referenztabelle
 * kommen, ist die Summe bei gleichem Zustandsbild exakt reproduzierbar.
 */
export function berechneSanierungsstau(
  gewerke: Pick<GewerkBefund, "gewerk" | "status">[],
  objektdaten: Objektdaten,
): Sanierungsstau {
  const posten = gewerke
    .filter((g) => g.status === "HANDLUNGSBEDARF")
    .map((g) => berechneGewerkKosten(g.gewerk, objektdaten));

  return {
    sanierungsstauMinEur: posten.reduce((s, p) => s + p.kostenMinEur, 0),
    sanierungsstauMaxEur: posten.reduce((s, p) => s + p.kostenMaxEur, 0),
    posten,
    nichtBeurteilbar: gewerke.filter((g) => g.status === "NICHT_BEURTEILBAR").map((g) => g.gewerk),
    offeneRisiken: posten
      .filter((p) => p.unvollstaendigerAnsatz !== null)
      .map((p) => p.unvollstaendigerAnsatz!),
  };
}
