// Sachwertverfahren nach ImmoWertV – der gerechnete Gegenwert zur
// Modellschätzung des Marktwerts.
//
// Bisher war der Orientierungswert-Korridor die letzte große Zahl im Report,
// die allein aus einer Modelleinschätzung stammte. Sanierungsstau,
// Risikostufen, Kaufnebenkosten und Finanzierung werden inzwischen gerechnet;
// der Marktwert nicht. Das hier schließt die Lücke mit demselben Ansatz:
// öffentlich belegte Kennwerte, nachvollziehbare Formel, Rechenweg im Report.
//
// VERFAHREN (§§ 21–23 ImmoWertV 2021):
//
//   Bodenwert       = Grundstücksfläche × Bodenrichtwert
//   Gebäudesachwert = Brutto-Grundfläche × NHK × Baupreisindex
//                     − Alterswertminderung
//   Vorläufiger Sachwert = Bodenwert + Gebäudesachwert
//   Marktwert       = Vorläufiger Sachwert × Sachwertfaktor
//
// Der Sachwertfaktor ist der eigentliche Marktbezug: Er wird von den
// Gutachterausschüssen aus tatsächlichen Kaufpreisen abgeleitet und je
// Landkreis veröffentlicht. Ohne ihn ist ein Sachwert eine Kostenrechnung,
// kein Marktwert.
//
// GRENZEN, die im Report benannt werden müssen:
//
// Die NHK 2010 sind Normalherstellungskosten für Standardgebäude; sie bilden
// weder besondere Bauweisen noch Ausstattungssprünge ab. Die
// Alterswertminderung läuft hier linear über die Gesamtnutzungsdauer, wie es
// die ImmoWertV für den Regelfall vorsieht.
//
// Und der wunde Punkt: Sachwertfaktoren liegen nicht zentral vor. Jeder
// Gutachterausschuss veröffentlicht eigene, teils nur als PDF, teils
// kostenpflichtig. Die Tabelle unten ist deshalb bewusst klein und kuratiert
// – wie schon bei den Bodenrichtwerten. Fehlt der Faktor für eine Region,
// wird das Verfahren nicht gerechnet, statt mit einem geratenen Faktor eine
// Genauigkeit vorzutäuschen, die es nicht gibt.

import type { Objektdaten } from "./schema";

/**
 * Normalherstellungskosten 2010 in EUR je m² Brutto-Grundfläche, Basisjahr
 * 2010, für freistehende Ein- und Zweifamilienhäuser (Gebäudeart 1.01 der
 * Anlage 4 zur ImmoWertV bzw. der Sachwertrichtlinie), nach Standardstufe.
 *
 * Quelle: Anlage 4 zur ImmoWertV 2021 / Sachwertrichtlinie, Gebäudeart
 * 1.01 "Ein- und Zweifamilienhäuser, freistehend".
 */
export const NHK_2010_EFH_FREISTEHEND: Record<number, number> = {
  1: 655,
  2: 725,
  3: 835,
  4: 1005,
  5: 1260,
};

/**
 * Standardstufe aus den Angaben des Exposés ableiten.
 *
 * Stufe 3 ist der Regelfall für ein normales Einfamilienhaus. Stufe 4 setzt
 * gehobene Ausstattung voraus, Stufe 2 einen einfachen, teils überalterten
 * Standard. Baujahr und Energieklasse sind dafür die belastbarsten
 * Anhaltspunkte, die ein Exposé regelmäßig hergibt.
 */
export function standardstufe(objektdaten: Objektdaten): { stufe: number; begruendung: string } {
  const klasse = (objektdaten.energieklasse ?? "").trim().toUpperCase().charAt(0);
  const baujahr = objektdaten.baujahr;

  if (baujahr !== null && baujahr >= 2010 && ["A", "B"].includes(klasse)) {
    return {
      stufe: 4,
      begruendung: `Baujahr ${baujahr} und Energieklasse ${klasse} deuten auf gehobenen Standard (Stufe 4).`,
    };
  }
  if (baujahr !== null && baujahr < 1970 && ["F", "G", "H"].includes(klasse)) {
    return {
      stufe: 2,
      begruendung: `Baujahr ${baujahr} und Energieklasse ${klasse} deuten auf einfachen, unsanierten Standard (Stufe 2).`,
    };
  }
  return { stufe: 3, begruendung: "Mittlerer Standard (Stufe 3) als Regelfall angesetzt." };
}

/**
 * Gesamtnutzungsdauer für Ein- und Zweifamilienhäuser: 80 Jahre.
 * Quelle: Anlage 1 zur ImmoWertV 2021.
 */
export const GESAMTNUTZUNGSDAUER_JAHRE = 80;

/**
 * Mindest-Restnutzungsdauer. Die ImmoWertV setzt für Gebäude, die weiterhin
 * genutzt werden, eine Untergrenze an – ein bewohntes Haus ist nie null wert.
 * Angesetzt werden 30 % der Gesamtnutzungsdauer.
 */
export const MIN_RESTNUTZUNGSDAUER_ANTEIL = 0.3;

/**
 * Verhältnis Brutto-Grundfläche zu Wohnfläche. Die NHK beziehen sich auf die
 * BGF (Außenmaße, alle Geschosse), das Exposé nennt die Wohnfläche (lichte
 * Innenmaße, ohne Wände, Treppen, Technikräume). Der Faktor 1,25 ist der in
 * der Wertermittlungspraxis gebräuchliche Umrechnungswert für
 * Einfamilienhäuser ohne Vollkeller.
 */
export const BGF_JE_WOHNFLAECHE = 1.25;

/**
 * Baupreisindex zur Fortschreibung der NHK vom Basisjahr 2010 auf heute.
 *
 * MUSS GEPFLEGT WERDEN: Der Wert stammt aus dem Preisindex für den Neubau
 * von Wohngebäuden des Statistischen Bundesamts (Fachserie 17 Reihe 4,
 * Basis 2010 = 100). Er steigt jährlich und ist der größte Hebel in der
 * gesamten Rechnung – ein veralteter Index unterschätzt den Gebäudewert
 * systematisch. lib/analysis/marktdaten/destatis.ts holt den aktuellen
 * Index; dieser Wert dient nur als Rückfallebene.
 */
export const BAUPREISINDEX_RUECKFALL = 190;

export interface Sachwertfaktor {
  faktor: number;
  landkreis: string;
  quelle: string;
}

/**
 * Sachwertfaktoren je Landkreis, aus den Immobilienmarktberichten der
 * Gutachterausschüsse. Bewusst klein gehalten und von Hand gepflegt – wie
 * die Bodenrichtwert-Referenztabelle.
 *
 * NOCH LEER: Für die Startregion muss der Faktor aus dem Marktbericht des
 * zuständigen Gutachterausschusses übernommen werden. Solange kein Eintrag
 * vorliegt, wird das Sachwertverfahren nicht gerechnet und der Report
 * bleibt bei der bisherigen Einordnung.
 */
export const SACHWERTFAKTOREN: Record<string, Sachwertfaktor> = {};

export function findeSachwertfaktor(lage: string): Sachwertfaktor | null {
  const text = lage.toLowerCase();
  for (const [schluessel, eintrag] of Object.entries(SACHWERTFAKTOREN)) {
    if (text.includes(schluessel.toLowerCase())) return eintrag;
  }
  return null;
}

export interface SachwertErgebnis {
  bodenwertEur: number;
  gebaeudesachwertEur: number;
  vorlaeufigerSachwertEur: number;
  marktwertEur: number;
  restnutzungsdauerJahre: number;
  alterswertminderungProzent: number;
  bruttoGrundflaecheQm: number;
  nhkEurProQm: number;
  standardstufe: number;
  sachwertfaktor: Sachwertfaktor;
  baupreisindex: number;
  /** Zeile für Zeile nachvollziehbar – gehört so in den Report. */
  rechenweg: string[];
}

/**
 * Rechnet den Sachwert. Gibt null zurück, wenn eine Eingangsgröße fehlt –
 * lieber kein Wert als ein Wert auf geratener Grundlage.
 */
export function berechneSachwert(params: {
  objektdaten: Objektdaten;
  bodenrichtwertEurProQm: number | null;
  baupreisindex?: number;
}): SachwertErgebnis | null {
  const { objektdaten, bodenrichtwertEurProQm } = params;
  const baujahr = objektdaten.baujahr;
  const wohnflaeche = objektdaten.wohnflaecheQm;
  const grundstueck = objektdaten.grundstueckQm;

  if (baujahr === null || wohnflaeche === null || grundstueck === null) return null;
  if (bodenrichtwertEurProQm === null) return null;

  const faktor = findeSachwertfaktor(objektdaten.adresseOderLage);
  if (!faktor) return null;

  const index = params.baupreisindex ?? BAUPREISINDEX_RUECKFALL;
  const rechenweg: string[] = [];

  const bodenwert = grundstueck * bodenrichtwertEurProQm;
  rechenweg.push(
    `Bodenwert: ${grundstueck.toLocaleString("de-DE")} m² × ${bodenrichtwertEurProQm.toLocaleString("de-DE")} €/m² = ${Math.round(bodenwert).toLocaleString("de-DE")} €`,
  );

  const { stufe, begruendung } = standardstufe(objektdaten);
  const nhk = NHK_2010_EFH_FREISTEHEND[stufe]!;
  const bgf = wohnflaeche * BGF_JE_WOHNFLAECHE;
  rechenweg.push(
    `Brutto-Grundfläche: ${wohnflaeche.toLocaleString("de-DE")} m² Wohnfläche × ${BGF_JE_WOHNFLAECHE.toLocaleString("de-DE")} = ${Math.round(bgf).toLocaleString("de-DE")} m²`,
  );
  rechenweg.push(`${begruendung} Normalherstellungskosten 2010: ${nhk} €/m² BGF`);

  const herstellungswert = bgf * nhk * (index / 100);
  rechenweg.push(
    `Herstellungswert heute: ${Math.round(bgf).toLocaleString("de-DE")} m² × ${nhk} €/m² × Baupreisindex ${index} / 100 = ${Math.round(herstellungswert).toLocaleString("de-DE")} €`,
  );

  const alter = new Date().getFullYear() - baujahr;
  const restnutzungsdauer = Math.max(
    GESAMTNUTZUNGSDAUER_JAHRE - alter,
    Math.round(GESAMTNUTZUNGSDAUER_JAHRE * MIN_RESTNUTZUNGSDAUER_ANTEIL),
  );
  const alterswertminderung = 1 - restnutzungsdauer / GESAMTNUTZUNGSDAUER_JAHRE;
  const gebaeudesachwert = herstellungswert * (1 - alterswertminderung);
  rechenweg.push(
    `Alterswertminderung: Baujahr ${baujahr}, ${alter} Jahre alt, Restnutzungsdauer ${restnutzungsdauer} von ${GESAMTNUTZUNGSDAUER_JAHRE} Jahren → ${(alterswertminderung * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Abschlag`,
  );
  rechenweg.push(`Gebäudesachwert: ${Math.round(gebaeudesachwert).toLocaleString("de-DE")} €`);

  const vorlaeufig = bodenwert + gebaeudesachwert;
  rechenweg.push(`Vorläufiger Sachwert: ${Math.round(vorlaeufig).toLocaleString("de-DE")} €`);

  const marktwert = vorlaeufig * faktor.faktor;
  rechenweg.push(
    `Marktanpassung: × Sachwertfaktor ${faktor.faktor.toLocaleString("de-DE")} (${faktor.landkreis}) = ${Math.round(marktwert).toLocaleString("de-DE")} €`,
  );

  return {
    bodenwertEur: Math.round(bodenwert),
    gebaeudesachwertEur: Math.round(gebaeudesachwert),
    vorlaeufigerSachwertEur: Math.round(vorlaeufig),
    marktwertEur: Math.round(marktwert),
    restnutzungsdauerJahre: restnutzungsdauer,
    alterswertminderungProzent: alterswertminderung * 100,
    bruttoGrundflaecheQm: Math.round(bgf),
    nhkEurProQm: nhk,
    standardstufe: stufe,
    sachwertfaktor: faktor,
    baupreisindex: index,
    rechenweg,
  };
}
