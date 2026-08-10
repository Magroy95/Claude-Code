// Deterministische Herleitung von Risikostufe und Kategorie einer Hypothese.
//
// Warum das hier gerechnet und nicht vom Modell vergeben wird: Bei fünf
// Läufen desselben Exposés schwankte die Zahl der als HOCH eingestuften
// Hypothesen zwischen 0 und 3 – identische Eingabe, identische Objektdaten.
// Da die Ampel deterministisch auf ROT springt, sobald zwei kaufentscheidende
// Hypothesen auf HOCH stehen, kippte damit auch die Ampelfarbe (4x ROT,
// 1x GELB).
//
// Die Auswertung der 32 Hypothesen aus diesen Läufen zeigte außerdem: Der
// Kostenanteil allein erklärt die Einstufung NICHT. Die teuerste Hypothese
// überhaupt (10 % des Kaufpreises) wurde MITTEL, eine mit 4,5 % dagegen HOCH.
// Was die HOCH-Fälle verbindet, ist nicht der Betrag, sondern die Art der
// Unsicherheit: ungeklärte Genehmigung, möglicher Folgeschaden an der
// Substanz, fehlende Belege – also Dinge, die sich vor dem Kauf nicht ohne
// Weiteres klären lassen und nach unten offen sind. Genau das bilden die
// Kriterien unten ab.
//
// Die Schwellen sind an diesen 32 Hypothesen kalibriert. Das ist eine
// belastbare Ausgangsbasis, aber keine statistisch gesicherte: Sie stammen
// von einem einzigen Objekt und sollten nachjustiert werden, sobald Daten
// von mehreren Objekten vorliegen.

import type { HypotheseFakten, Hypothese } from "./schema";

// Schwellen und Gewichte sind an 62 Hypothesen aus fünf Läufen kalibriert.
// Erste Fassung (5/2, alle Faktoren gleich stark) stufte 61 % aller
// Hypothesen als HOCH ein und keine einzige als NIEDRIG – die Antworten des
// Modells fallen deutlich großzügiger aus als bei der Konstruktion
// angenommen: "Folgeschaden möglich" kommt bei 55 % vor, "im Exposé belegt"
// bei 79 %. Gewichtet wird deshalb nach Trennschärfe: selten und eindeutig
// beantwortete Fragen zählen stark, häufig bejahte schwach.
/** Ab dieser Punktzahl gilt eine Hypothese als hohes Risiko. */
export const SCHWELLE_HOCH = 6;
/** Ab dieser Punktzahl gilt eine Hypothese als mittleres Risiko. */
export const SCHWELLE_MITTEL = 3;

export interface RisikoBewertung {
  risiko: Hypothese["risiko"];
  kategorie: Hypothese["kategorie"];
  punkte: number;
  begruendung: string[];
}

function kostenPunkte(
  kostenMaxEur: number | null,
  angebotspreisEur: number,
): { punkte: number; text: string } {
  if (kostenMaxEur === null || angebotspreisEur <= 0) {
    // Nicht bezifferbar ist selbst eine Form von Unsicherheit – aber eine
    // schwächere als ein konkret hoher Betrag.
    return { punkte: 1, text: "Kostenrahmen nicht bezifferbar (+1)" };
  }
  const anteil = kostenMaxEur / angebotspreisEur;
  const prozent = (anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  if (anteil >= 0.08) return { punkte: 3, text: `Kostenrisiko ${prozent} % des Kaufpreises (+3)` };
  if (anteil >= 0.04) return { punkte: 2, text: `Kostenrisiko ${prozent} % des Kaufpreises (+2)` };
  if (anteil >= 0.02) return { punkte: 1, text: `Kostenrisiko ${prozent} % des Kaufpreises (+1)` };
  return { punkte: 0, text: `Kostenrisiko ${prozent} % des Kaufpreises (0)` };
}

export function bewerteRisiko(
  fakten: Pick<
    HypotheseFakten,
    | "kostenMinEur"
    | "kostenMaxEur"
    | "belegtImExpose"
    | "ursacheGeklaert"
    | "folgeschadenMoeglich"
    | "rechtlichUngeklaert"
    | "gesetzlicheFrist"
    | "vorOrtKlaerbar"
  >,
  angebotspreisEur: number,
): RisikoBewertung {
  const begruendung: string[] = [];
  let punkte = 0;

  const kosten = kostenPunkte(fakten.kostenMaxEur, angebotspreisEur);
  punkte += kosten.punkte;
  begruendung.push(kosten.text);

  // Eine breite Spanne heißt: Der Aufwand hängt an etwas, das noch niemand
  // geprüft hat.
  if (
    fakten.kostenMinEur !== null &&
    fakten.kostenMaxEur !== null &&
    fakten.kostenMinEur > 0 &&
    fakten.kostenMaxEur / fakten.kostenMinEur >= 3
  ) {
    punkte += 1;
    begruendung.push("Kostenspanne mindestens dreifach – Aufwand stark von Ungeklärtem abhängig (+1)");
  }

  // Trennscharf: nur bei 23 % bzw. 8 % der Hypothesen bejaht, und beides
  // beschreibt eine vor dem Kauf nicht auflösbare Unsicherheit.
  if (fakten.rechtlichUngeklaert) {
    punkte += 3;
    begruendung.push("Genehmigung/Baurecht ungeklärt (+3)");
  }
  if (fakten.ursacheGeklaert === false) {
    punkte += 3;
    begruendung.push("Schadensursache nicht dokumentiert (+3)");
  }
  // Bewusst schwach gewichtet: Bei 55 % aller Hypothesen bejaht – theoretisch
  // ist fast überall ein Folgeschaden denkbar, das trennt kaum.
  if (fakten.folgeschadenMoeglich) {
    punkte += 1;
    begruendung.push("Folgeschaden an der Substanz möglich (+1)");
  }
  if (!fakten.vorOrtKlaerbar) {
    punkte += 1;
    begruendung.push("Nicht bei der Besichtigung klärbar – Gutachten/Bauakte nötig (+1)");
  }
  if (fakten.gesetzlicheFrist) {
    punkte += 1;
    begruendung.push("Gesetzlicher Handlungsdruck (GEG/EU-EPBD) (+1)");
  }
  // belegtImExpose fließt bewusst NICHT in die Punkte ein: Es wird bei 79 %
  // der Hypothesen bejaht und trennt damit praktisch nicht. Der Hinweis
  // bleibt in der Begründung, weil er für den Leser dennoch relevant ist.
  if (fakten.belegtImExpose) {
    begruendung.push("Im Exposé konkret dokumentiert, nicht nur aus dem Baujahr abgeleitet");
  }

  const risiko: Hypothese["risiko"] =
    punkte >= SCHWELLE_HOCH ? "HOCH" : punkte >= SCHWELLE_MITTEL ? "MITTEL" : "NIEDRIG";

  // Kaufentscheidend ist, was die Kaufentscheidung selbst umwerfen kann:
  // hohes Risiko, ungeklärte Rechtslage, oder ein Schaden unbekannter
  // Ursache mit Folgeschadenpotenzial.
  const kaufentscheidend =
    risiko === "HOCH" ||
    fakten.rechtlichUngeklaert ||
    (fakten.ursacheGeklaert === false && fakten.folgeschadenMoeglich);

  // Strategisch sind Punkte ohne bezifferbaren Aufwand, ohne Pflicht und ohne
  // Schaden – also Potenziale und Verhandlungshebel statt Kostenrisiken.
  const strategisch =
    !kaufentscheidend &&
    fakten.kostenMaxEur === null &&
    !fakten.gesetzlicheFrist &&
    fakten.ursacheGeklaert !== false &&
    !fakten.folgeschadenMoeglich;

  const kategorie: Hypothese["kategorie"] = kaufentscheidend
    ? "KAUFENTSCHEIDEND"
    : strategisch
      ? "STRATEGISCH"
      : "KOSTENRELEVANT";

  return { risiko, kategorie, punkte, begruendung };
}

/** Ergänzt eine Faktenliste um die berechnete Stufe und Kategorie. */
export function bewerteHypothesen(
  fakten: HypotheseFakten[],
  angebotspreisEur: number,
): Hypothese[] {
  return fakten.map((f) => {
    const bewertung = bewerteRisiko(f, angebotspreisEur);
    return {
      ...f,
      risiko: bewertung.risiko,
      kategorie: bewertung.kategorie,
      risikoBegruendung: bewertung.begruendung,
    };
  });
}
