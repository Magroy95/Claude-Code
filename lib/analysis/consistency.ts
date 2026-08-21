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
import { ALLE_GEWERKE } from "./schema";

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
  if (result.verhandlungsargumente.length < 2) {
    throw new ConsistencyError(
      `Nur ${result.verhandlungsargumente.length} Verhandlungsargument(e) statt mindestens 2.`,
    );
  }
}

// Bewusst strukturell typisiert statt an RisikoAgentResult gebunden: Die
// Prüfung läuft sowohl über die reinen Faktenangaben des Agenten als auch
// über die fertigen, um Stufe und Kategorie ergänzten Hypothesen des Reports.
type PruefbareHypothese = {
  key: string;
  titel: string;
  kostenMinEur: number | null;
  kostenMaxEur: number | null;
  pruefragen: string[];
};

export function validateHypothesen(hypothesen: PruefbareHypothese[]): void {
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
  validateGewerke(result.gewerke);
}

// Die Checkliste ist nur dann ein Stabilitätsgewinn, wenn sie wirklich
// vollständig ist – fehlt ein Gewerk, fehlt sein Kostenanteil im
// Sanierungsstau, und genau das sollte die Liste ja verhindern.
//
// Kostenspannen werden hier nicht mehr geprüft: Sie kommen nicht mehr vom
// Modell, sondern aus der Referenztabelle, die sie per Konstruktion konsistent
// hält (Menge x Kennwert, Minimum stets aus dem unteren Kennwert).
export function validateGewerke(gewerke: RisikoAgentResult["gewerke"]): void {
  const gesehen = new Set(gewerke.map((g) => g.gewerk));
  const fehlend = ALLE_GEWERKE.filter((g) => !gesehen.has(g));
  if (fehlend.length > 0) {
    throw new ConsistencyError(`Gewerke-Checkliste unvollständig, es fehlen: ${fehlend.join(", ")}.`);
  }
  if (gesehen.size !== gewerke.length) {
    throw new ConsistencyError("Gewerke-Checkliste enthält ein Gewerk mehrfach.");
  }
  for (const g of gewerke) {
    if (g.begruendung.trim().length === 0) {
      throw new ConsistencyError(`Gewerk ${g.gewerk} hat keine Begründung.`);
    }
  }
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

// Zweiter, unabhängiger Auslöser: ein einzelner im Exposé dokumentierter
// Schaden, dessen Ursache nicht dokumentiert ist und bei dem ein
// Folgeschaden an der Substanz möglich ist. Die Kombination ist genau der
// Fall, in dem sich die Kosten vor dem Kauf nicht nach oben begrenzen
// lassen – die Zahl der übrigen Hypothesen ändert daran nichts, deshalb
// reicht hier eine. Die Regel steht neben der Zählregel oben, sie ersetzt
// sie nicht.
function hatUngeklaertenSchadenMitFolgerisiko(hypothesen: Hypothese[]): boolean {
  return hypothesen.some((h) => h.ursacheGeklaert === false && h.folgeschadenMoeglich === true);
}

// Die Gegenrichtung, und sie ist genauso wichtig.
//
// Über 44 Analysen hinweg hat das Modell die Ampel 25-mal auf ROT und 18-mal
// auf GELB gesetzt – und kein einziges Mal auf GRÜN. Auch bei einem Objekt
// von 2011 mit Energieklasse B, Wärmepumpe von 2023, belegten Erneuerungen
// in vier Gewerken, einem Sanierungsstau von 0 EUR und einem Preis innerhalb
// des Korridors blieb es bei GELB. Die Begründung lautete sinngemäß, es gebe
// "einzelne klärbare Punkte" – die gibt es bei jeder Immobilie.
//
// Eine Ampel mit zwei Farben ist keine Ampel: Wenn nie etwas grün wird,
// lernt der Nutzer nach dem zweiten Report, dass die Farbe nichts
// unterscheidet, und entwertet damit auch das begründete Rot. Deshalb wird
// GRÜN ebenso deterministisch erzwungen wie ROT. Die Bedingungen sind streng
// – sie beschreiben ein Objekt, bei dem aus den Unterlagen kein
// kaufentscheidender Punkt und kein nennenswerter Kostenblock erkennbar ist.
const MAX_SANIERUNGSSTAU_ANTEIL_FUER_GRUEN = 0.05;

export interface AmpelKontext {
  sanierungsstauMaxEur: number;
  angebotspreisEur: number;
  orientierungswertMaxEur: number;
}

function darfGruenSein(hypothesen: Hypothese[], kontext: AmpelKontext): boolean {
  if (hypothesen.some((h) => h.risiko === "HOCH")) return false;
  if (hypothesen.some((h) => h.kategorie === "KAUFENTSCHEIDEND")) return false;
  if (hypothesen.some((h) => h.ursacheGeklaert === false)) return false;
  if (kontext.angebotspreisEur <= 0) return false;
  if (kontext.angebotspreisEur > kontext.orientierungswertMaxEur) return false;
  const anteil = kontext.sanierungsstauMaxEur / kontext.angebotspreisEur;
  return anteil <= MAX_SANIERUNGSSTAU_ANTEIL_FUER_GRUEN;
}

export function erzwingeAmpelKonsistenz(
  ampel: AnalysisReport["ampel"],
  hypothesen: Hypothese[],
  kontext?: AmpelKontext,
): { ampel: AnalysisReport["ampel"]; wurdeKorrigiert: boolean } {
  const anzahlHochRisikoKaufentscheidend = hypothesen.filter(
    (h) => h.kategorie === "KAUFENTSCHEIDEND" && h.risiko === "HOCH",
  ).length;
  const rotErzwungen =
    anzahlHochRisikoKaufentscheidend >= MIN_HOCH_RISIKO_KAUFENTSCHEIDEND_FUER_ROT ||
    hatUngeklaertenSchadenMitFolgerisiko(hypothesen);
  if (rotErzwungen) {
    return { ampel: "ROT", wurdeKorrigiert: ampel !== "ROT" };
  }
  // Ohne Kontext (Altaufrufe) bleibt es beim bisherigen Verhalten: nur ROT
  // wird erzwungen.
  if (kontext && darfGruenSein(hypothesen, kontext)) {
    return { ampel: "GRUEN", wurdeKorrigiert: ampel !== "GRUEN" };
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
