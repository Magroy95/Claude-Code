// Deterministische Finanzmathematik für die Analyse-Pipeline. Annuität und
// Restschuld werden hier berechnet statt vom LLM erfragt zu werden, damit die
// Kernzahlen des Reports nicht auf halluzinierter Arithmetik beruhen.

export const STANDARD_ZINS = 0.045;
export const STANDARD_TILGUNG = 0.02;
export const STRESS_ZINS = 0.065;

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
    jahre: 10,
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
  return Math.round(qm * 2.25);
}
