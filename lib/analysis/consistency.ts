// Deterministische Konsistenzprüfungen für Agenten-Zwischenergebnisse.
//
// Die Vier-Augen-Prüfung (sanierungsfahrplanPruefungAgent) deckt bislang nur
// den Sanierungsfahrplan ab. Die Funktionen hier fangen den Rest der Zahlen
// im Report ab, die zwar zod-konform (richtiger Typ), aber inhaltlich
// widersprüchlich sein können (z.B. Minimum > Maximum) – etwas, das Zod
// allein nicht prüft. Ein Verstoß wirft ConsistencyError, was in der
// Pipeline (in Kombination mit withRetry) dazu führt, dass der betroffene
// Agent einfach erneut gefragt wird, statt einen inkonsistenten Report
// auszuliefern.

import type {
  MarktwertAgentResult,
  RisikoAgentResult,
  FinanzAgentResult,
  AnalysisReport,
  Hypothese,
} from "./schema";

export class ConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsistencyError";
  }
}

function assertRange(label: string, min: number | null, max: number | null): void {
  if (min !== null && max !== null && min > max) {
    throw new ConsistencyError(
      `${label}: Minimum (${min}) liegt über Maximum (${max}).`,
    );
  }
}

function assertNonNegative(label: string, value: number | null): void {
  if (value !== null && value < 0) {
    throw new ConsistencyError(`${label}: Wert ist negativ (${value}).`);
  }
}

export function validateMarktwert(result: MarktwertAgentResult): void {
  assertRange(
    "Orientierungswert-Korridor",
    result.orientierungswertMinEur,
    result.orientierungswertMaxEur,
  );
  assertNonNegative("Orientierungswert (Minimum)", result.orientierungswertMinEur);
  assertNonNegative("Kaufnebenkosten-Schätzung", result.kaufnebenkostenSchaetzungEur);
  if (result.verhandlungsargumente.length < 2) {
    throw new ConsistencyError(
      `Nur ${result.verhandlungsargumente.length} Verhandlungsargument(e) statt mindestens 2.`,
    );
  }
}

export function validateHypothesen(hypothesen: RisikoAgentResult["hypothesen"]): void {
  const keys = new Set<string>();
  for (const h of hypothesen) {
    assertRange(`Hypothese ${h.key} ("${h.titel}") Kostenrahmen`, h.kostenMinEur, h.kostenMaxEur);
    assertNonNegative(`Hypothese ${h.key} Kosten-Minimum`, h.kostenMinEur);
    if (h.pruefragen.length === 0) {
      throw new ConsistencyError(`Hypothese ${h.key} ("${h.titel}") hat keine Prüffragen.`);
    }
    if (keys.has(h.key)) {
      throw new ConsistencyError(`Hypothesen-Key "${h.key}" ist nicht eindeutig (Duplikat).`);
    }
    keys.add(h.key);
  }
}

export function validateRisiko(result: RisikoAgentResult): void {
  validateHypothesen(result.hypothesen);
}

export function validateFinanz(result: FinanzAgentResult): void {
  for (const s of result.risikoSzenarien) {
    assertRange(
      `Risikoszenario "${s.titel}" (einmaliger Betrag)`,
      s.einmaligerBetragMinEur,
      s.einmaligerBetragMaxEur,
    );
    assertNonNegative(`Risikoszenario "${s.titel}" (einmaliger Betrag, Minimum)`, s.einmaligerBetragMinEur);
  }
}

// Die Ampel-Regel aus dem syntheseAgent-Prompt ("ROT = mehrere
// KAUFENTSCHEIDEND-Hypothesen mit hohem Risiko ...") ist kein
// Ermessensspielraum, sondern eine mechanische Regel. Ein ConsistencyError
// (wie bei den übrigen Checks in dieser Datei) würde über withRetry einen
// erneuten Modellaufruf auslösen – das hilft hier aber nicht: In der Praxis
// hat sich gezeigt, dass ein Modell, das die Regel einmal anders auslegt,
// das bei mehreren Versuchen hintereinander konsistent wieder tut (kein
// Zufallsfehler, sondern eine andere Gewichtung), sodass withRetry nach
// allen Versuchen aufgibt und die gesamte Analyse fehlschlägt – für eine
// Regel, die eigentlich reines Abzählen ist. Deshalb hier stattdessen
// deterministisch erzwingen statt werfen: "mehrere" wird als "mindestens 2"
// ausgelegt.
const MIN_HOCH_RISIKO_KAUFENTSCHEIDEND_FUER_ROT = 2;

export function erzwingeAmpelKonsistenz(
  ampel: AnalysisReport["ampel"],
  hypothesen: Hypothese[],
): { ampel: AnalysisReport["ampel"]; wurdeKorrigiert: boolean } {
  const anzahlHochRisikoKaufentscheidend = hypothesen.filter(
    (h) => h.kategorie === "KAUFENTSCHEIDEND" && h.risiko === "HOCH",
  ).length;
  if (anzahlHochRisikoKaufentscheidend >= MIN_HOCH_RISIKO_KAUFENTSCHEIDEND_FUER_ROT && ampel !== "ROT") {
    return { ampel: "ROT", wurdeKorrigiert: true };
  }
  return { ampel, wurdeKorrigiert: false };
}

// Letzte, günstige Sicherheitsprüfung über den fertig zusammengesetzten
// Report, kurz bevor er persistiert wird – fängt auch Inkonsistenzen ab,
// die erst durch das Zusammensetzen mehrerer Agenten-Ergebnisse entstehen
// (z.B. sanierungsstauMinEur/MaxEur, die aus den Hypothesen aufsummiert
// werden).
export function validateReport(report: AnalysisReport): void {
  assertRange(
    "Orientierungswert-Korridor",
    report.orientierungswertMinEur,
    report.orientierungswertMaxEur,
  );
  assertRange("Sanierungsstau", report.sanierungsstauMinEur, report.sanierungsstauMaxEur);
  validateHypothesen(report.hypothesen);
  for (const s of report.risikoSzenarien) {
    assertRange(
      `Risikoszenario "${s.titel}" (einmaliger Betrag)`,
      s.einmaligerBetragMinEur,
      s.einmaligerBetragMaxEur,
    );
  }
}
