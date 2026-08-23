/**
 * Wie lange eine Analyse dauert – gemessen, nicht geschätzt.
 *
 * Grundlage sind alle bisher erfolgreich abgeschlossenen Läufe in der
 * Entwicklungsdatenbank (n = 45, gemessen von Anlage der Analyse bis zum
 * letzten Schreibvorgang):
 *
 *   Minimum   252 s  (4,2 min)
 *   Median    278 s  (4,6 min)
 *   90. Perz. 507 s  (8,5 min)
 *   Maximum   518 s  (8,6 min)
 *
 * Daraus die beiden Zahlen unten: „etwa fünf Minuten" als typischer Fall,
 * „unter zehn Minuten" als Zusage, die auch der langsamste gemessene Lauf
 * noch gehalten hat.
 *
 * Wichtig: Diese Werte stammen aus der lokalen Umgebung. Wenn die
 * Produktivumgebung dauerhaft langsamer ist, gehören die Zahlen hier
 * korrigiert – eine Zeitzusage auf der Startseite, die nicht gehalten wird,
 * kostet mehr Vertrauen, als sie an Conversion bringt.
 */
export const DAUER_TYPISCH_MINUTEN = 5;
export const DAUER_OBERGRENZE_MINUTEN = 10;

/** Die Schritte der Pipeline in der Reihenfolge, in der sie laufen. */
export const PIPELINE_SCHRITTE = [
  { key: "objektdaten", label: "Exposé wird gelesen" },
  { key: "marktdaten", label: "Marktdaten zur Lage werden geholt" },
  { key: "marktwert", label: "Angebotspreis wird eingeordnet" },
  { key: "risiko", label: "Bausubstanz und Risiken werden geprüft" },
  { key: "finanz", label: "Monatsrate und Nebenkosten werden gerechnet" },
  { key: "synthese", label: "Ergebnis wird zusammengeführt" },
  { key: "pruefung", label: "Sanierungsfahrplan wird gegengelesen" },
  { key: "gesamtPruefung", label: "Report wird auf Widersprüche geprüft" },
] as const;
