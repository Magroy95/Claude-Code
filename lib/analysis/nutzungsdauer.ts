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
// QUELLE: BBSR-Nutzungsdauertabelle "Nutzungsdauern von Bauteilen für
// Lebenszyklusanalysen nach BNB", Stand 04.11.2025, herausgegeben vom
// Bundesinstitut für Bau-, Stadt- und Raumforschung. Sie ist die Grundlage
// der Lebenszykluskosten- und Ökobilanzberechnung im Bewertungssystem
// Nachhaltiges Bauen des Bundes und im Qualitätssiegel Nachhaltiges Gebäude.
// Referenznummern in den Einträgen unten beziehen sich auf die
// Kostengruppen nach DIN 276 in der Systematik dieser Tabelle.
//
// ZWEI DINGE, DIE MAN BEIM LESEN DIESER TABELLE WISSEN MUSS:
//
// Erstens ist "≥ 50" keine gemessene Lebensdauer, sondern die Obergrenze des
// Betrachtungszeitraums: Das BNB bewertet über 50 Jahre, alles was länger
// hält, wird nicht weiter differenziert. Wo hier 50 als Obergrenze steht,
// heißt das also "hält mindestens so lange", nicht "ist dann verbraucht".
//
// Zweitens – und das ist für den Sanierungsstau entscheidend – bestimmt
// nicht die langlebigste Schicht eines Gewerks den Erneuerungszeitpunkt,
// sondern die kurzlebigste. Ein Ziegeldach hält laut BBSR ≥ 50 Jahre, die
// Unterdeckung darunter aber nur 35. Wer nach 35 Jahren die Unterdeckung
// erneuert, deckt das Dach dabei ohnehin ab. Die Untergrenze je Gewerk ist
// deshalb die maßgebliche Schicht, nicht der Mittelwert über alle.
//
// Die BBSR selbst weist darauf hin, dass die Werte Erfahrungswerte sind und
// keine Messgrößen – verbindliche Aussagen lassen sich daraus nicht
// ableiten. Der Report weist sie entsprechend als Orientierung aus.
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
  /**
   * Gehört das Gewerk zur thermischen Hülle? Dann löst schlechte
   * Energieeffizienz Handlungsbedarf aus, auch wenn das Bauteil technisch
   * noch intakt ist.
   *
   * Ohne diese Unterscheidung würde die Nutzungsdauer-Herleitung Schaden
   * anrichten: Eine Fassade von 1994 ist nach 32 Jahren nicht verschlissen
   * (BBSR: 45–50 Jahre) – bei Energieklasse E ist sie trotzdem ein
   * Kostenpunkt, den ein Käufer einplanen muss. Verschleiß und
   * energetischer Bedarf sind zwei verschiedene Gründe für dieselbe
   * Maßnahme, und nur einer davon steht in der BBSR-Tabelle.
   */
  thermischeHuelle?: boolean;
}

/**
 * Sieben der acht Gewerke sind belegt. SCHADSTOFFE fehlt bewusst und
 * dauerhaft: Asbest verschleißt nicht, sondern ist verbaut oder nicht – dort
 * entscheidet die Baualtersklasse, nicht das Alter. Der Status dieses
 * Gewerks bleibt deshalb bei der Einschätzung des Modells.
 */
export const NUTZUNGSDAUER: Partial<Record<Gewerk, NutzungsdauerAngabe>> = {
  DACH: {
    // Maßgeblich ist nicht die Deckung, sondern was darunter liegt: Die
    // Unterdeckung hält 35 Jahre, die Entwässerung aus verzinktem Stahl
    // 35–40. Beides erzwingt das Abdecken des Dachs.
    jahreMin: 35,
    jahreMax: 50,
    bezeichnung: "Dachsystem – maßgeblich Unterdeckung und Entwässerung, nicht die Deckung",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 363 Dachbeläge: Unterdach/Unterdeckung dampfdiffusionsoffene bzw. -dichte Folien 35 Jahre; Entwässerung Stahl galvanisch verzinkt 35–40 Jahre; Deckungen Ziegel, Beton und Faserzement ≥ 50 Jahre",
    ],
    thermischeHuelle: true,
  },
  FASSADE: {
    jahreMin: 45,
    jahreMax: 50,
    bezeichnung: "Putz- bzw. Bekleidungsebene der Außenwand",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 335 Außenwandbekleidung außen: pastöse Putze 45 Jahre, Putz auf Wärmedämmung 45 Jahre, mineralische Putze ≥ 50 Jahre, Wärmedämm-Verbundsystem ≥ 50 Jahre, Bekleidungen aus Klinker und Kalksandstein ≥ 50 Jahre",
    ],
    thermischeHuelle: true,
  },
  FENSTER: {
    // Der Rahmen hält ≥ 50 Jahre, der Randverbund der Verglasung nicht: Ein
    // Fenster wird wegen der Scheibe getauscht, nicht wegen des Rahmens.
    jahreMin: 30,
    jahreMax: 50,
    bezeichnung: "Fenster – maßgeblich die Verglasung, nicht der Rahmen",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 334 Außenwandöffnungen: Verglasung Sicherheits-Isolierglas und 3-Scheiben-Wärmeschutz-Isolierglas 30 Jahre, Dichtungsprofile 20 Jahre; Rahmen und Flügel aus PVC-U, Aluminium oder behandeltem Nadelholz ≥ 50 Jahre",
    ],
    thermischeHuelle: true,
  },
  HEIZUNG: {
    jahreMin: 20,
    jahreMax: 25,
    bezeichnung: "Wärmeerzeuger",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 421 Wärmeerzeugungsanlagen: Gas-Brennwertkessel 20 Jahre, Spezialkessel für Öl- und Gasfeuerung 20 Jahre, Wärmepumpe Luft/Wasser 20 Jahre, Holzpellet- und Hackschnitzelkessel 20 Jahre, Elektro-Zentralspeicher 25 Jahre",
    ],
  },
  ELEKTRO: {
    jahreMin: 25,
    jahreMax: 40,
    bezeichnung: "Elektroinstallation – maßgeblich Verteilung und Leitungen",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 440 Starkstromanlagen: Niederspannungsschaltanlagen (Verteilung) 25 Jahre, Kabel/Leitungen/Verlegesysteme 25 Jahre, Niederspannungsinstallationsanlagen 40 Jahre",
    ],
  },
  SANITAER: {
    // Die Rohre halten ≥ 50 Jahre, Armaturen und Speicher 20. Ein Bad wird
    // wegen der Ausstattung saniert, nicht wegen der Kaltwasserleitung.
    jahreMin: 20,
    jahreMax: 30,
    bezeichnung: "Sanitärausstattung und Warmwasserbereitung, nicht das Leitungsnetz",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 412 Wasseranlagen: Entnahmearmaturen 20 Jahre, Trinkwasserspeicher 20 Jahre, Speicher-Wassererwärmer 20 Jahre, Warmwasserleitungen bei ungünstigen Wasserverhältnissen 30 Jahre; Kaltwasserleitungen und Abwasseranlagen ≥ 50 Jahre",
    ],
  },
  INNENAUSBAU: {
    // Oberflächen, nicht Substanz: Estrich und Innenputz halten ≥ 50 Jahre,
    // aber Anstriche, Tapeten und Bodenbeläge sind der Grund, aus dem ein
    // Haus nach dem Kauf renoviert wird.
    jahreMin: 20,
    jahreMax: 25,
    bezeichnung: "Oberflächen – Anstriche, Tapeten, Bodenbeläge",
    quellen: [
      "BBSR-Nutzungsdauertabelle 04.11.2025, KG 345 Innenwandbekleidungen und KG 353/354 Deckenbeläge und -bekleidungen: Innenanstriche Nassabriebklasse 1 20 Jahre, Tapeten überstreichbar 25 Jahre, Bodenbeläge Linoleum und PVC-homogen 25 Jahre, PVC-heterogen und Webware 20 Jahre; Estriche und mineralische Innenputze ≥ 50 Jahre",
    ],
  },
};

/**
 * Gewerke ohne Nutzungsdauer-Herleitung. SCHADSTOFFE steht hier dauerhaft:
 * Der Befund hängt an der Baualtersklasse, nicht am Verschleiß.
 */
export const NUTZUNGSDAUER_OFFEN: Gewerk[] = ["SCHADSTOFFE"];

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
  energetischerBedarf = false,
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
  // Technisch noch nicht fällig – aber bei schlechter Energieeffizienz ist
  // ein Bauteil der thermischen Hülle trotzdem ein Kostenpunkt.
  if (energetischerBedarf && dauer.thermischeHuelle) {
    return {
      status: "HANDLUNGSBEDARF",
      alterJahre: alter,
      herleitung:
        `${quelle} → ${alter} Jahre alt und damit technisch noch nicht erneuerungsreif ` +
        `(${dauer.bezeichnung}, ${dauer.jahreMin}–${dauer.jahreMax} Jahre). Das Bauteil gehört jedoch zur ` +
        `thermischen Hülle, und die Energiekennwerte des Hauses weisen auf energetischen Nachholbedarf hin – ` +
        `nicht Verschleiß ist hier der Grund, sondern der Wärmeschutz.`,
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
