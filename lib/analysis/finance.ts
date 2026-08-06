// Deterministische Finanzmathematik für die Analyse-Pipeline. Annuität und
// Restschuld werden hier berechnet statt vom LLM erfragt zu werden, damit die
// Kernzahlen des Reports nicht auf halluzinierter Arithmetik beruhen.

// Standardannahmen der Finanzierungsrechnung. Sie werden im Report offen
// ausgewiesen (siehe Annahmen-Block in app/components/Report.tsx), damit die
// Monatsbelastung nachvollziehbar ist und nicht als gesetzt missverstanden
// wird. Bei einer Zinsänderung am Markt ist STANDARD_ZINS der einzige Wert,
// der angefasst werden muss – Report und Prototyp lesen ihn von hier.
export const STANDARD_ZINS = 0.0425;
export const STANDARD_TILGUNG = 0.02;
export const STRESS_ZINS = 0.065;
export const ZINSBINDUNG_JAHRE = 10;
export const INSTANDHALTUNG_EUR_PRO_QM_MONAT = 2.25;

// --- Kaufnebenkosten -------------------------------------------------------
// Bewusst gerechnet statt geschätzt: Grunderwerbsteuer, Notar/Grundbuch und
// Courtage folgen festen Sätzen bzw. stehen im Exposé. Eine Schätzung durch
// das Sprachmodell schwankte zwischen zwei Läufen desselben Objekts um über
// 30.000 EUR und verfälschte damit die ausgewiesene Monatsbelastung.

// Grunderwerbsteuersätze der Bundesländer (Stand 2025). Quelle: Landesrecht
// der jeweiligen Bundesländer; bei Satzänderungen ist das hier der einzige
// Ort, der angepasst werden muss.
export const GRUNDERWERBSTEUER_PROZENT: Record<string, number> = {
  "Baden-Württemberg": 0.05,
  Bayern: 0.035,
  Berlin: 0.06,
  Brandenburg: 0.065,
  Bremen: 0.05,
  Hamburg: 0.055,
  Hessen: 0.06,
  "Mecklenburg-Vorpommern": 0.06,
  Niedersachsen: 0.05,
  "Nordrhein-Westfalen": 0.065,
  "Rheinland-Pfalz": 0.05,
  Saarland: 0.065,
  Sachsen: 0.055,
  "Sachsen-Anhalt": 0.05,
  "Schleswig-Holstein": 0.065,
  Thüringen: 0.05,
};

// Fällt zurück, wenn das Bundesland nicht bestimmbar ist. Bewusst der
// häufigste Satz und nicht der niedrigste, damit die Belastung im Zweifel
// nicht zu günstig dargestellt wird.
export const GRUNDERWERBSTEUER_STANDARD = 0.05;

// Notarkosten (Beurkundung, Vollzug, Treuhand) plus Grundbucheintragung.
// Beide sind über GNotKG gebührenrechtlich an den Kaufpreis gekoppelt;
// 1,5 % ist der gängige Praxiswert für beides zusammen.
export const NOTAR_GRUNDBUCH_PROZENT = 0.015;

// Üblicher Käuferanteil in Norddeutschland, wenn das Exposé keinen Satz
// nennt, der Verkauf aber über einen Makler läuft.
export const MAKLERPROVISION_STANDARD_PROZENT = 0.0357;

export interface KaufnebenkostenAufstellung {
  grunderwerbsteuerEur: number;
  grunderwerbsteuerProzent: number;
  notarGrundbuchEur: number;
  maklerprovisionEur: number;
  maklerprovisionProzent: number;
  summeEur: number;
  /** true, wenn das Bundesland nicht bestimmbar war und der Standardsatz griff. */
  bundeslandGeschaetzt: boolean;
  /** true, wenn das Exposé keinen Courtage-Satz nannte und der Standardsatz griff. */
  maklerprovisionGeschaetzt: boolean;
}

export function berechneKaufnebenkosten(params: {
  angebotspreisEur: number;
  bundesland: string | null;
  maklerprovisionKaeuferProzent: number | null;
  mitMakler: boolean;
}): KaufnebenkostenAufstellung {
  const satzAusTabelle = params.bundesland
    ? GRUNDERWERBSTEUER_PROZENT[params.bundesland.trim()]
    : undefined;
  const grunderwerbsteuerProzent = satzAusTabelle ?? GRUNDERWERBSTEUER_STANDARD;

  // Das Exposé nennt den Satz in Prozent (z.B. 3.57), intern rechnen wir mit
  // Dezimalanteilen.
  const provisionAusExpose =
    params.maklerprovisionKaeuferProzent != null && params.maklerprovisionKaeuferProzent > 0
      ? params.maklerprovisionKaeuferProzent / 100
      : null;
  const maklerprovisionProzent = params.mitMakler
    ? (provisionAusExpose ?? MAKLERPROVISION_STANDARD_PROZENT)
    : 0;

  const grunderwerbsteuerEur = Math.round(params.angebotspreisEur * grunderwerbsteuerProzent);
  const notarGrundbuchEur = Math.round(params.angebotspreisEur * NOTAR_GRUNDBUCH_PROZENT);
  const maklerprovisionEur = Math.round(params.angebotspreisEur * maklerprovisionProzent);

  return {
    grunderwerbsteuerEur,
    grunderwerbsteuerProzent,
    notarGrundbuchEur,
    maklerprovisionEur,
    maklerprovisionProzent,
    summeEur: grunderwerbsteuerEur + notarGrundbuchEur + maklerprovisionEur,
    bundeslandGeschaetzt: satzAusTabelle === undefined,
    maklerprovisionGeschaetzt: params.mitMakler && provisionAusExpose === null,
  };
}

export interface AnnuitaetParams {
  darlehenEur: number;
  zinsSatz: number;
  tilgungSatz: number;
}

export function monatlicheAnnuitaet({ darlehenEur, zinsSatz, tilgungSatz }: AnnuitaetParams): number {
  return Math.round((darlehenEur * (zinsSatz + tilgungSatz)) / 12);
}

export function restschuldNachJahren(params: AnnuitaetParams & { jahre: number }): number {
  const { darlehenEur, zinsSatz, jahre } = params;
  const monatsZins = zinsSatz / 12;
  const annuitaet = monatlicheAnnuitaet(params);
  let restschuld = darlehenEur;
  for (let monat = 0; monat < jahre * 12 && restschuld > 0; monat++) {
    const zinsanteil = restschuld * monatsZins;
    restschuld -= annuitaet - zinsanteil;
  }
  return Math.max(0, Math.round(restschuld));
}

export interface FinanzierungsKennzahlen {
  darlehenEur: number;
  monatlicheAnnuitaetEur: number;
  restschuldNach10JahrenEur: number;
  annuitaetBeiZinsanstiegEur: number;
  deltaBeiZinsanstiegEur: number;
}

export function berechneFinanzierungsKennzahlen(params: {
  angebotspreisEur: number;
  kaufnebenkostenEur: number;
  eigenkapitalEur: number;
}): FinanzierungsKennzahlen {
  const darlehenEur = Math.max(
    0,
    params.angebotspreisEur + params.kaufnebenkostenEur - params.eigenkapitalEur,
  );
  const monatlicheAnnuitaetEur = monatlicheAnnuitaet({
    darlehenEur,
    zinsSatz: STANDARD_ZINS,
    tilgungSatz: STANDARD_TILGUNG,
  });
  const restschuldNach10JahrenEur = restschuldNachJahren({
    darlehenEur,
    zinsSatz: STANDARD_ZINS,
    tilgungSatz: STANDARD_TILGUNG,
    jahre: ZINSBINDUNG_JAHRE,
  });
  const annuitaetBeiZinsanstiegEur = monatlicheAnnuitaet({
    darlehenEur: restschuldNach10JahrenEur,
    zinsSatz: STRESS_ZINS,
    tilgungSatz: STANDARD_TILGUNG,
  });
  return {
    darlehenEur,
    monatlicheAnnuitaetEur,
    restschuldNach10JahrenEur,
    annuitaetBeiZinsanstiegEur,
    deltaBeiZinsanstiegEur: annuitaetBeiZinsanstiegEur - monatlicheAnnuitaetEur,
  };
}

export function instandhaltungsruecklage(wohnflaecheQm: number | null): number {
  const qm = wohnflaecheQm ?? 120;
  return Math.round(qm * INSTANDHALTUNG_EUR_PRO_QM_MONAT);
}
