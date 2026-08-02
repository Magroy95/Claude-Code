import { z } from "zod";

export const risikoLevel = z.enum(["HOCH", "MITTEL", "NIEDRIG"]);
export const hypothesenKategorie = z.enum([
  "KAUFENTSCHEIDEND",
  "KOSTENRELEVANT",
  "STRATEGISCH",
]);
export const ampelStufe = z.enum(["GRUEN", "GELB", "ROT"]);

// Ein Verbrauchsausweis spiegelt das tatsächliche Heizverhalten der
// Vorbewohner (Anzahl Personen, Heizgewohnheiten, Leerstandszeiten) wider,
// nicht den normierten energetischen Bedarf des Gebäudes – der reale
// Bedarf kann daher spürbar abweichen. Ein Bedarfsausweis ist
// gebäudebezogen berechnet und deutlich belastbarer. Diese Unterscheidung
// muss deshalb explizit erfasst und im Report kenntlich gemacht werden.
export const energieausweisTypEnum = z.enum(["BEDARF", "VERBRAUCH"]);

export const objektdatenSchema = z.object({
  adresseOderLage: z.string(),
  baujahr: z.number().int().nullable(),
  wohnflaecheQm: z.number().nullable(),
  grundstueckQm: z.number().nullable(),
  zimmer: z.number().nullable(),
  energieklasse: z.string().nullable(),
  energiebedarfKwhM2a: z.number().nullable(),
  // null, wenn im Exposé nicht erkennbar, ob Bedarfs- oder Verbrauchsausweis.
  energieausweisTyp: energieausweisTypEnum.nullable(),
  heizungstyp: z.string().nullable(),
  angebotspreisEur: z.number(),
  // Kurze, sachliche Notizen aus dem Beschreibungs-/Fließtext des Exposés
  // (nicht aus den strukturierten Tabellenfeldern), die auf Schäden,
  // Rückbauten, unfertige/nicht nutzbare Räume oder Widersprüche zu den
  // strukturierten Feldern hindeuten (z.B. "Anzahl Badezimmer: 2" in der
  // Tabelle, aber ein Bad laut Beschreibung im Rohbauzustand). Leeres
  // Array, wenn der Fließtext nichts dergleichen enthält.
  besonderheitenAusExpose: z.array(z.string()),
});
export type Objektdaten = z.infer<typeof objektdatenSchema>;

export const hypotheseSchema = z.object({
  key: z.string(),
  kategorie: hypothesenKategorie,
  titel: z.string(),
  kostenrahmenText: z.string(),
  // Numerische Entsprechung von kostenrahmenText (in EUR, ohne Formatierung),
  // damit der Sanierungsstau aufsummiert werden kann, ohne Freitext zu parsen.
  // Beide null, wenn kostenrahmenText nicht direkt bezifferbar ist.
  kostenMinEur: z.number().nullable(),
  kostenMaxEur: z.number().nullable(),
  hypothese: z.string(),
  pruefragen: z.array(z.string()).min(1),
  risiko: risikoLevel,
});
export type Hypothese = z.infer<typeof hypotheseSchema>;

export const sanierungsSchrittSchema = z.object({
  zeitpunkt: z.string(),
  massnahme: z.string(),
  kostenrahmenText: z.string(),
  foerderung: z.string(),
  // Kumulative Hypothese zur Energieeffizienzklasse NACH dieser Maßnahme
  // (inkl. aller vorherigen Schritte) – relevant für Käufer und Banken
  // (Beleihung/Anschlussfinanzierung), daher als eigene Spalte statt nur im
  // Fließtext.
  voraussichtlicheEnergieklasseNachMassnahme: z.string(),
});
export type SanierungsSchritt = z.infer<typeof sanierungsSchrittSchema>;

export const risikoSzenarioSchema = z.object({
  titel: z.string(),
  beschreibung: z.string(),
  auswirkungText: z.string(),
  // Deterministisch vorberechnete monatliche Mehrbelastung (EUR) für Szenarien
  // mit einer echten laufenden Kostenänderung (z.B. Zinsanstieg bei der
  // Anschlussfinanzierung). Null, wenn das Szenario keine klare monatliche
  // Delta hat.
  deltaMonatlicheBelastungEur: z.number().nullable(),
  // Einmaliger/kumulierter Betrag (EUR) für Szenarien, die eine Kostensumme
  // statt einer laufenden Monatsrate sind (z.B. Sanierungsstau als Summe aus
  // dem Sanierungsfahrplan, ohne die Annahme einer neuen Kreditfinanzierung).
  // Beide null, wenn das Szenario keinen klaren Betrag hat.
  einmaligerBetragMinEur: z.number().nullable(),
  einmaligerBetragMaxEur: z.number().nullable(),
});

export const argumentSchema = z.object({
  titel: z.string(),
  text: z.string(),
});

export const analysisReportSchema = z.object({
  objektdaten: objektdatenSchema,
  orientierungswertMinEur: z.number(),
  orientierungswertMaxEur: z.number(),
  marktEinschaetzung: z.string(),
  marktwertText: z.string(),
  // Einzelne, in sich abgeschlossene Verhandlungsargumente statt eines
  // durchnummerierten Fließtexts, damit sie als Liste/Karten darstellbar sind.
  verhandlungsargumente: z.array(argumentSchema).min(2).max(5),
  kaufnebenkostenSchaetzungEur: z.number(),
  cashflow: z.object({
    monatlicheAnnuitaetEur: z.number(),
    instandhaltungsruecklageEur: z.number(),
    sonstigeNebenkostenEur: z.number(),
    gesamtbelastungEur: z.number(),
  }),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  hypothesen: z.array(hypotheseSchema).min(1),
  // Summe aus hypothesen[].kostenMinEur/kostenMaxEur (KAUFENTSCHEIDEND +
  // KOSTENRELEVANT), in der Pipeline berechnet statt vom LLM erfragt.
  sanierungsstauMinEur: z.number(),
  sanierungsstauMaxEur: z.number(),
  sanierungsfahrplan: z.array(sanierungsSchrittSchema).min(1),
  // Kurzer Fließtext-Kern; die "wichtigsten offenen Punkte" stehen separat
  // als Liste in offenePunkte statt am Ende des Fließtexts eingebettet.
  gesamtbildText: z.string(),
  offenePunkte: z.array(z.string()).min(1).max(6),
  // Kurzfassung für eine spätere Free-Preview (Ampel + Einordnung), der
  // ausführliche Report bleibt der kostenpflichtige Teil.
  ampel: ampelStufe,
  kurzfazit: z.string(),
});
export type AnalysisReport = z.infer<typeof analysisReportSchema>;

export const enrichmentImpactSchema = z.object({
  changeSummary: z.string(),
  updatedReport: analysisReportSchema,
});
export type EnrichmentImpact = z.infer<typeof enrichmentImpactSchema>;

// --- Schemas je Pipeline-Agent (Zwischenergebnisse) ---

export const marktwertAgentSchema = z.object({
  orientierungswertMinEur: z.number(),
  orientierungswertMaxEur: z.number(),
  marktEinschaetzung: z.string(),
  marktwertText: z.string(),
  verhandlungsargumente: z.array(argumentSchema).min(2).max(5),
  kaufnebenkostenSchaetzungEur: z.number(),
});
export type MarktwertAgentResult = z.infer<typeof marktwertAgentSchema>;

export const risikoAgentSchema = z.object({
  hypothesen: z.array(hypotheseSchema).min(1),
});
export type RisikoAgentResult = z.infer<typeof risikoAgentSchema>;

export const finanzAgentSchema = z.object({
  // Annuität, Instandhaltungsrücklage und Zinsanstiegs-Kennzahlen werden
  // deterministisch berechnet (lib/analysis/finance.ts) und dem Agenten als
  // gegebene Zahlen übergeben; nur die sonstigen Nebenkosten sind Schätzung.
  sonstigeNebenkostenEur: z.number(),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
});
export type FinanzAgentResult = z.infer<typeof finanzAgentSchema>;

export const syntheseAgentSchema = z.object({
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  sanierungsfahrplan: z.array(sanierungsSchrittSchema).min(1),
  gesamtbildText: z.string(),
  offenePunkte: z.array(z.string()).min(1).max(6),
  ampel: ampelStufe,
  kurzfazit: z.string(),
});
export type SyntheseAgentResult = z.infer<typeof syntheseAgentSchema>;

// Zweite, unabhängige Prüfinstanz (Vier-Augen-Prinzip) für den vom
// syntheseAgent erstellten Sanierungsfahrplan. Gibt ihn unverändert oder
// korrigiert zurück und listet vorgenommene Korrekturen auf.
export const sanierungsfahrplanPruefungSchema = z.object({
  sanierungsfahrplan: z.array(sanierungsSchrittSchema).min(1),
  aenderungen: z.array(z.string()),
});
export type SanierungsfahrplanPruefungResult = z.infer<typeof sanierungsfahrplanPruefungSchema>;

// Abschließende, unabhängige Vier-Augen-Prüfung über den GESAMTEN
// zusammengesetzten Report (nicht nur den Sanierungsfahrplan). Umfasst
// bewusst nur die Felder, die tatsächlich Interpretations-/Formulierungs-
// spielraum haben (Texte, Argumente, Ampel) – Objektdaten, der
// Preiskorridor, die Kaufnebenkosten, die Hypothesen-Kostenrahmen, der
// daraus abgeleitete Sanierungsstau, die Cashflow-Zahlen und der
// Sanierungsfahrplan sind bereits deterministisch berechnet bzw. durch eine
// eigene Prüfinstanz abgesichert und werden hier bewusst NICHT zur
// Veränderung freigegeben, damit diese Prüfung keine bereits korrekten
// Zahlen verwässern kann.
export const gesamtPruefungSchema = z.object({
  marktEinschaetzung: z.string(),
  marktwertText: z.string(),
  verhandlungsargumente: z.array(argumentSchema).min(2).max(5),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  gesamtbildText: z.string(),
  offenePunkte: z.array(z.string()).min(1).max(6),
  ampel: ampelStufe,
  kurzfazit: z.string(),
  aenderungen: z.array(z.string()),
});
export type GesamtPruefungResult = z.infer<typeof gesamtPruefungSchema>;
