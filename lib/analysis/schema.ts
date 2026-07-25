import { z } from "zod";

export const risikoLevel = z.enum(["HOCH", "MITTEL", "NIEDRIG"]);
export const hypothesenKategorie = z.enum([
  "KAUFENTSCHEIDEND",
  "KOSTENRELEVANT",
  "STRATEGISCH",
]);

export const objektdatenSchema = z.object({
  adresseOderLage: z.string(),
  baujahr: z.number().int().nullable(),
  wohnflaecheQm: z.number().nullable(),
  grundstueckQm: z.number().nullable(),
  zimmer: z.number().nullable(),
  energieklasse: z.string().nullable(),
  energiebedarfKwhM2a: z.number().nullable(),
  heizungstyp: z.string().nullable(),
  angebotspreisEur: z.number(),
});
export type Objektdaten = z.infer<typeof objektdatenSchema>;

export const hypotheseSchema = z.object({
  key: z.string(),
  kategorie: hypothesenKategorie,
  titel: z.string(),
  kostenrahmenText: z.string(),
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
});

export const risikoSzenarioSchema = z.object({
  titel: z.string(),
  beschreibung: z.string(),
  auswirkungText: z.string(),
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
  verhandlungsargumente: z.string(),
  kaufnebenkostenSchaetzungEur: z.number(),
  cashflow: z.object({
    monatlicheAnnuitaetEur: z.number(),
    instandhaltungsruecklageEur: z.number(),
    sonstigeNebenkostenEur: z.number(),
    gesamtbelastungEur: z.number(),
  }),
  opportunitaetskostenText: z.string(),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  hypothesen: z.array(hypotheseSchema).min(1),
  sanierungsfahrplan: z.array(sanierungsSchrittSchema).min(1),
  gesamtbild: z.string(),
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
  verhandlungsargumente: z.string(),
  kaufnebenkostenSchaetzungEur: z.number(),
});
export type MarktwertAgentResult = z.infer<typeof marktwertAgentSchema>;

export const risikoAgentSchema = z.object({
  hypothesen: z.array(hypotheseSchema).min(1),
});
export type RisikoAgentResult = z.infer<typeof risikoAgentSchema>;

export const finanzAgentSchema = z.object({
  cashflow: z.object({
    monatlicheAnnuitaetEur: z.number(),
    instandhaltungsruecklageEur: z.number(),
    sonstigeNebenkostenEur: z.number(),
    gesamtbelastungEur: z.number(),
  }),
  opportunitaetskostenText: z.string(),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
});
export type FinanzAgentResult = z.infer<typeof finanzAgentSchema>;

export const syntheseAgentSchema = z.object({
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  sanierungsfahrplan: z.array(sanierungsSchrittSchema).min(1),
  gesamtbild: z.string(),
});
export type SyntheseAgentResult = z.infer<typeof syntheseAgentSchema>;
