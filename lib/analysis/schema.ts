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
  // Beide werden für die Mengenermittlung des Sanierungsstaus gebraucht
  // (lib/analysis/sanierungskosten.ts): Aus der Geschosszahl folgen Grund-,
  // Dach- und Fassadenfläche, aus der Bäderzahl der Sanitäranteil. Fehlen
  // sie, greift eine benannte Standardannahme.
  geschosse: z.number().nullable(),
  anzahlBadezimmer: z.number().nullable(),
  energieklasse: z.string().nullable(),
  energiebedarfKwhM2a: z.number().nullable(),
  // null, wenn im Exposé nicht erkennbar, ob Bedarfs- oder Verbrauchsausweis.
  energieausweisTyp: energieausweisTypEnum.nullable(),
  heizungstyp: z.string().nullable(),
  angebotspreisEur: z.number(),
  // Für die Grunderwerbsteuer, die je Bundesland unterschiedlich hoch ist.
  // Wird aus Ort/PLZ abgeleitet; null, wenn die Lage keine eindeutige
  // Zuordnung erlaubt – dann greift eine benannte Standardannahme.
  bundesland: z.string().nullable(),
  // Vom Käufer zu zahlender Courtage-Anteil in Prozent des Kaufpreises,
  // inkl. MwSt., so wie im Exposé ausgewiesen. null, wenn nicht angegeben.
  maklerprovisionKaeuferProzent: z.number().nullable(),
  // Kurze, sachliche Notizen aus dem Beschreibungs-/Fließtext des Exposés
  // (nicht aus den strukturierten Tabellenfeldern), die auf Schäden,
  // Rückbauten, unfertige/nicht nutzbare Räume oder Widersprüche zu den
  // strukturierten Feldern hindeuten (z.B. "Anzahl Badezimmer: 2" in der
  // Tabelle, aber ein Bad laut Beschreibung im Rohbauzustand). Leeres
  // Array, wenn der Fließtext nichts dergleichen enthält.
  besonderheitenAusExpose: z.array(z.string()),
});
export type Objektdaten = z.infer<typeof objektdatenSchema>;

// --- Gewerke-Checkliste ----------------------------------------------------
// Feste Positionen, die bei JEDEM Objekt beurteilt werden. Grund: Der
// Sanierungsstau wurde bisher aus der Hypothesenliste summiert, deren Umfang
// zwischen Läufen schwankte (8 bis 12 bezifferte Posten) – das allein
// erklärte die Streuung von 151.000 bis 238.000 EUR beim selben Objekt. Die
// Kostenspannen je Gewerk waren dabei bemerkenswert stabil (Elektro in allen
// Läufen exakt 8.000–20.000 EUR). Nicht die Beträge schwankten also, sondern
// welche Gewerke überhaupt auftauchten. Eine feste Liste beseitigt das.
export const gewerkEnum = z.enum([
  "DACH",
  "FASSADE",
  "FENSTER",
  "HEIZUNG",
  "ELEKTRO",
  "SANITAER",
  "INNENAUSBAU",
  "SCHADSTOFFE",
]);
export type Gewerk = z.infer<typeof gewerkEnum>;

/** Alle Gewerke in Reihenfolge – die Checkliste muss vollständig sein. */
export const ALLE_GEWERKE = gewerkEnum.options;

export const gewerkStatusEnum = z.enum([
  /** Laut Exposé bereits erneuert – kein Kostenansatz. */
  "ERNEUERT",
  /** Handlungsbedarf absehbar – mit Kostenspanne. */
  "HANDLUNGSBEDARF",
  /** Aus den Unterlagen nicht beurteilbar – wird als Lücke ausgewiesen. */
  "NICHT_BEURTEILBAR",
]);
export type GewerkStatus = z.infer<typeof gewerkStatusEnum>;

// Was der Agent liefert: ausschließlich die Zustandsbeurteilung. Beträge
// vergibt er bewusst nicht mehr – sie kamen bei identischer Eingabe jedes Mal
// etwas anders heraus und waren die verbliebene Hauptquelle der Streuung im
// Sanierungsstau. Sie stammen jetzt aus der Referenztabelle
// (lib/analysis/sanierungskosten.ts).
export const gewerkBefundAgentSchema = z.object({
  gewerk: gewerkEnum,
  status: gewerkStatusEnum,
  begruendung: z.string(),
  // Nachprüfbare Fakten zum Erneuerungsstand. Wo eine belegte Nutzungsdauer
  // vorliegt (lib/analysis/nutzungsdauer.ts), wird der Status daraus
  // gerechnet und die Einschätzung oben überschrieben – der Status schwankte
  // zwischen Läufen und war nach der Kostentabelle die verbliebene
  // Hauptquelle der Streuung im Sanierungsstau.
  /** Steht im Exposé, dass dieses Gewerk erneuert/modernisiert wurde? */
  erneuertLautExpose: z.boolean(),
  /** Genanntes Jahr der Erneuerung, sonst null. */
  erneuerungsJahr: z.number().int().nullable(),
  /** Wörtlicher Beleg aus dem Exposé. Ohne ihn zählt erneuertLautExpose nicht. */
  zitatAusExpose: z.string().nullable(),
});
export type GewerkBefundAgent = z.infer<typeof gewerkBefundAgentSchema>;

// Was im Report landet: die Beurteilung plus der daraus gerechnete
// Kostenrahmen samt Herleitung. Die Kennwert-Felder sind optional, damit vor
// der Umstellung gespeicherte Reports weiterhin geparst werden können.
export const gewerkBefundSchema = gewerkBefundAgentSchema
  // Optional, damit vor der Umstellung gespeicherte Reports weiterhin
  // geparst werden können.
  .partial({
    erneuertLautExpose: true,
    erneuerungsJahr: true,
    zitatAusExpose: true,
  })
  .extend({
  // Nur bei HANDLUNGSBEDARF gesetzt, sonst null.
  kostenMinEur: z.number().nullable(),
  kostenMaxEur: z.number().nullable(),
  /** Menge, auf die gerechnet wurde – z.B. 91 (m² Dachfläche). */
  bezugsmenge: z.number().optional(),
  bezugsEinheit: z.string().optional(),
  /** Nachvollziehbare Herleitung der Menge aus den Objektdaten. */
  mengenHerleitung: z.string().optional(),
  eurProEinheitMin: z.number().optional(),
  eurProEinheitMax: z.number().optional(),
  /** Was im Kennwert enthalten ist. */
  leistungsumfang: z.string().optional(),
  quellen: z.array(z.string()).optional(),
  /** Gesetzt, wenn der Ansatz den Posten absehbar nicht vollständig abdeckt. */
  unvollstaendigerAnsatz: z.string().nullable().optional(),
});
export type GewerkBefund = z.infer<typeof gewerkBefundSchema>;

// Die nachprüfbaren Fakten je Hypothese. Das Modell beantwortet nur noch
// diese Fragen; Risikostufe und Kategorie werden daraus deterministisch
// berechnet (lib/analysis/risiko.ts). Grund: Bei fünf Läufen desselben
// Exposés schwankte die frei vergebene Risikostufe zwischen 0 und 3
// HOCH-Einstufungen, was die Ampel mitkippen ließ – während die Fakten
// selbst ("steht der Befund im Exposé?", "ist die Genehmigung geklärt?")
// deutlich stabiler zu beantworten sind.
export const hypotheseFaktenSchema = z.object({
  key: z.string(),
  titel: z.string(),
  kostenrahmenText: z.string(),
  // Numerische Entsprechung von kostenrahmenText (in EUR, ohne Formatierung),
  // damit der Sanierungsstau aufsummiert werden kann, ohne Freitext zu parsen.
  // Beide null, wenn kostenrahmenText nicht direkt bezifferbar ist.
  kostenMinEur: z.number().nullable(),
  kostenMaxEur: z.number().nullable(),
  hypothese: z.string(),
  pruefragen: z.array(z.string()).min(1),
  /** Konkret im Exposé dokumentiert – nicht bloß aus der Baualtersklasse abgeleitet. */
  belegtImExpose: z.boolean(),
  /**
   * Wörtliche Textstelle aus dem Exposé, die den Befund belegt. Ohne Zitat
   * wird belegtImExpose programmatisch auf false gesetzt: Die Angabe war
   * zuvor bei 79 % der Hypothesen wahr und damit wertlos – ein erzwungener
   * Beleg macht sie überprüfbar. null, wenn nichts zitierbar ist.
   */
  zitatAusExpose: z.string().nullable(),
  /** Bei einem Schadensbefund: Ursache dokumentiert? null, wenn es um keinen Schaden geht. */
  ursacheGeklaert: z.boolean().nullable(),
  /** Kann daraus ein Folgeschaden an der Substanz entstehen (Feuchte, Schimmel, Statik)? */
  folgeschadenMoeglich: z.boolean(),
  /** Genehmigung, Baurecht oder Bestandsschutz ungeklärt? */
  rechtlichUngeklaert: z.boolean(),
  /** Erzwingt eine gesetzliche Regel (GEG, EU-EPBD) absehbar Handlung? */
  gesetzlicheFrist: z.boolean(),
  /** Bei einer normalen Besichtigung klärbar – oder braucht es Gutachten, Bauakte, Behörde? */
  vorOrtKlaerbar: z.boolean(),
});

// Die Fakten sind optional, damit vor der Umstellung gespeicherte Reports
// weiterhin geparst werden können; risiko und kategorie sind im fertigen
// Report immer gesetzt (berechnet).
export const hypotheseSchema = hypotheseFaktenSchema
  .partial({
    belegtImExpose: true,
    ursacheGeklaert: true,
    folgeschadenMoeglich: true,
    rechtlichUngeklaert: true,
    gesetzlicheFrist: true,
    vorOrtKlaerbar: true,
  })
  .extend({
    kategorie: hypothesenKategorie,
    risiko: risikoLevel,
    /** Nachvollziehbare Herleitung der berechneten Stufe. Fehlt bei Alt-Reports. */
    risikoBegruendung: z.array(z.string()).optional(),
  });
export type Hypothese = z.infer<typeof hypotheseSchema>;
export type HypotheseFakten = z.infer<typeof hypotheseFaktenSchema>;

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
  // Aufstellung der Kaufnebenkosten. Optional, weil vor der Umstellung auf
  // eine deterministische Berechnung erzeugte Reports sie nicht haben – dort
  // stand nur eine Modellschätzung ohne nachvollziehbare Posten.
  kaufnebenkostenAufstellung: z
    .object({
      grunderwerbsteuerEur: z.number(),
      grunderwerbsteuerProzent: z.number(),
      notarGrundbuchEur: z.number(),
      maklerprovisionEur: z.number(),
      maklerprovisionProzent: z.number(),
      bundeslandGeschaetzt: z.boolean(),
      maklerprovisionGeschaetzt: z.boolean(),
    })
    .optional(),
  // Bewusst nur vollständig durchgerechnete Posten: Rate und
  // Instandhaltungsrücklage. Laufende Nebenkosten (Grundsteuer,
  // Versicherung, Energie) hängen von Faktoren ab, die nicht im Exposé
  // stehen, und wurden früher vom Modell geschätzt – das widersprach der
  // Zusage, dass Zahlen gerechnet und nicht geschätzt werden.
  cashflow: z.object({
    monatlicheAnnuitaetEur: z.number(),
    instandhaltungsruecklageEur: z.number(),
    gesamtbelastungEur: z.number(),
  }),
  // Die zum Zeitpunkt der Analyse gültigen Rechenannahmen werden mitgespeichert
  // statt beim Anzeigen aus den aktuellen Konstanten gelesen: Ändert sich der
  // Marktzins, würde ein alter Report sonst neue Annahmen neben alten Zahlen
  // ausweisen. Optional, weil vor Einführung erzeugte Reports sie nicht haben –
  // dort wird der Annahmen-Block bewusst weggelassen statt geraten.
  finanzAnnahmen: z
    .object({
      sollzins: z.number(),
      tilgung: z.number(),
      zinsbindungJahre: z.number(),
      stressZins: z.number(),
      instandhaltungEurProQmMonat: z.number(),
    })
    .optional(),
  risikoSzenarien: z.array(risikoSzenarioSchema).min(1),
  argumenteContra: z.array(argumentSchema).min(1),
  argumentePro: z.array(argumentSchema).min(1),
  hypothesen: z.array(hypotheseSchema).min(1),
  // Gewerke-Checkliste. Optional, weil vor der Umstellung erzeugte Reports
  // sie nicht haben.
  gewerke: z.array(gewerkBefundSchema).optional(),
  // Summe der Gewerke mit Handlungsbedarf, in der Pipeline berechnet statt
  // vom LLM erfragt.
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
});
export type MarktwertAgentResult = z.infer<typeof marktwertAgentSchema>;

export const risikoAgentSchema = z.object({
  // Bewusst ohne risiko/kategorie: Beides wird aus den Fakten berechnet,
  // damit gleiche Fakten zwingend zur gleichen Einstufung führen.
  hypothesen: z.array(hypotheseFaktenSchema).min(1),
  // Feste Checkliste, immer vollständig – der Sanierungsstau wird daraus
  // gerechnet statt aus den Hypothesen summiert. Ohne Beträge: die liefert
  // die Referenztabelle.
  gewerke: z.array(gewerkBefundAgentSchema).length(8),
});
export type RisikoAgentResult = z.infer<typeof risikoAgentSchema>;

export const finanzAgentSchema = z.object({
  // Sämtliche Cashflow-Zahlen werden deterministisch berechnet
  // (lib/analysis/finance.ts) und dem Agenten als gegebene Werte übergeben.
  // Der Agent liefert daher nur noch die qualitative Risikoeinordnung.
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
