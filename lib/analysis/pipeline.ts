import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, ANALYSIS_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import {
  objektdatenSchema,
  marktwertAgentSchema,
  risikoAgentSchema,
  finanzAgentSchema,
  syntheseAgentSchema,
  analysisReportSchema,
  enrichmentImpactSchema,
  type AnalysisReport,
  type Objektdaten,
  type MarktwertAgentResult,
  type RisikoAgentResult,
  type FinanzAgentResult,
  type Hypothese,
} from "./schema";
import {
  berechneFinanzierungsKennzahlen,
  instandhaltungsruecklage,
  monatlicheAnnuitaet,
  STANDARD_TILGUNG,
  STANDARD_ZINS,
  type FinanzierungsKennzahlen,
} from "./finance";

const DISCLAIMER_HINWEIS =
  "Alle Angaben sind unverbindliche, KI-gestützte Hypothesen auf Basis der bereitgestellten Unterlagen. " +
  "Sie ersetzen keine Prüfung durch einen Bausachverständigen und keine Rechts- oder Finanzberatung.";

// Gemeinsame Grundhaltung + Sprachregeln für alle bewertenden Agenten
// (nicht für die reine Datenextraktion). Fasst zusammen: skeptische,
// zahlenfokussierte Asset-Sicht aus drei Perspektiven sowie die rechtlichen
// Leitplanken (verbotene Begriffe / Pflicht-Framing), die HauskaufChecker
// für rechtssichere Formulierungen einhalten muss.
const PERSONA_PREAMBLE = `
Du bist Teil des Analyse-Teams von HauskaufChecker.de und denkst aus drei
Perspektiven gleichzeitig:
1. Ein finanziell versierter Investor, der die Immobilie ausschließlich als
   Asset bewertet (Rendite, Werterhalt, Verhandlungsspielraum) – keine
   "Wohlfühlfaktor"- oder Geschmacksargumente.
2. Ein skeptischer Bausachverständiger, der Substanzrisiken realistisch und
   ohne Übertreibung einschätzt, auf Basis von Erfahrungswerten zur
   Baualtersklasse.
3. Ein Energieberater, dessen konkretes Ziel es ist, die Immobilie innerhalb
   von 10 Jahren in eine spürbar bessere Energieeffizienzklasse zu bringen,
   um bei der Anschlussfinanzierung bessere Konditionen/Beleihung zu
   erzielen – NICHT aus ökologischem Idealismus, sondern weil es sich
   rechnet. Schlage nur Maßnahmen vor, die sich nach Preis-Leistung
   rechtfertigen lassen (Kosten vs. Energieklassensprung vs. Förderquote vs.
   Effekt auf die Anschlussfinanzierung); keine Maßnahme um der Ökologie
   willen.

Bewerte konsequent nach Preis-Leistung, nicht nach Idealismus. Mach klar, was
wirklich wichtig und richtig ist – ohne in Detailversessenheit oder
idealistische Empfehlungen abzudriften.

Sprachliche Pflichtregeln (rechtlich bindend, niemals verletzen):
- Verwende NIEMALS: "Gutachten", "Wertgutachten", "Sachverständigenbericht",
  "Zertifikat", "Bausubstanzprüfung", "technische Prüfung",
  "Zustandsbewertung", "Der Wert beträgt [Zahl]" als Tatsachenaussage,
  "überteuert"/"günstig" als Tatsachenbehauptung, "kann bedenkenlos gekauft
  werden", "empfehle den Kauf/Nichtkauf", "wird kosten", "spart definitiv",
  "ist sicher", oder jede finale Aussage ohne Konjunktiv-/Hypothesen-Framing.
- Formuliere stattdessen im Hypothesen-Framing, z.B.: "Auf Basis der
  bereitgestellten Unterlagen besteht die Hypothese, dass...", "Typische
  Schwachstelle dieser Baualtersklasse ist erfahrungsgemäß...", "Ein
  marktüblicher Richtwert liegt bei...", "Es wird empfohlen, folgenden Punkt
  vor Ort zu prüfen...".
- Jede Aussage ist eine Hypothese auf Basis der bereitgestellten Angaben,
  keine gutachterliche Feststellung.
`.trim();

function exposeContentBlock(
  buffer: Buffer,
  mimeType: string,
): Anthropic.Messages.ContentBlockParam {
  const data = buffer.toString("base64");
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }
  if (mimeType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data,
      },
    };
  }
  throw new Error(`Nicht unterstützter Exposé-Dateityp: ${mimeType}`);
}

async function extraktionAgent(
  expose: Anthropic.Messages.ContentBlockParam,
  freitext: string | null,
): Promise<Objektdaten> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system:
      "Du bist ein Immobilien-Analyst. Extrahiere die Objektdaten aus dem beigefügten Exposé so präzise wie möglich. " +
      "Wenn ein Wert nicht im Dokument steht, setze ihn auf null statt zu raten.",
    messages: [
      {
        role: "user",
        content: [
          expose,
          {
            type: "text",
            text:
              "Extrahiere die Objektdaten aus diesem Exposé." +
              (freitext ? `\n\nVom Nutzer angegebene Besonderheiten/Mängel: ${freitext}` : ""),
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(objektdatenSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Extraktion fehlgeschlagen: keine strukturierte Antwort");
  return message.parsed_output;
}

async function marktwertAgent(
  objektdaten: Objektdaten,
  verkaufsart: string,
): Promise<MarktwertAgentResult> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist in diesem Schritt der Investor: Ordne den Angebotspreis anhand der Objektdaten ein " +
      "(Quadratmeterpreis, Baujahr, Energieklasse, Grundstücksgröße, Lage) und leite einen " +
      "Orientierungswert-Korridor ab. Kein absoluter Werturteil, immer als Korridor und Hypothese formulieren.\n\n" +
      "Für verhandlungsargumente: 2-4 EIGENSTÄNDIGE Argumente als Liste, NICHT ein einziger durchnummerierter " +
      "Fließtext. Jedes Argument braucht einen kurzen titel (3-6 Wörter) und einen text (1-3 Sätze, " +
      "zahlenbasiert, z.B. konkreter Kostenrahmen oder Preisabschlag). Jedes Argument muss für sich allein " +
      "verständlich sein, ohne die anderen gelesen zu haben.",
    messages: [
      {
        role: "user",
        content:
          `Objektdaten: ${JSON.stringify(objektdaten)}\nVerkaufsart: ${verkaufsart}\n\n` +
          "Erstelle die Markwert-Einordnung inkl. Kaufnebenkosten-Schätzung (inkl. Makler, falls zutreffend).",
      },
    ],
    output_config: { format: zodOutputFormat(marktwertAgentSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Marktwert-Analyse fehlgeschlagen");
  return message.parsed_output;
}

async function risikoAgent(
  objektdaten: Objektdaten,
  freitext: string | null,
): Promise<RisikoAgentResult> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 8192,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist in diesem Schritt der Bausachverständige (Ersteinschätzung auf Basis von Exposé-Daten, keine " +
      "Vor-Ort-Prüfung). Formuliere priorisierte Hypothesen zu Substanz- und Kostenrisiken, gruppiert in die " +
      "Kategorien KAUFENTSCHEIDEND, KOSTENRELEVANT und STRATEGISCH. Jede Hypothese braucht einen Kostenrahmen " +
      "als Text (z.B. '25.000–45.000 EUR') UND denselben Kostenrahmen als Zahlen in kostenMinEur/kostenMaxEur " +
      "(ohne Formatierung, z.B. 25000 und 45000) – diese Zahlen werden programmatisch zum geschätzten " +
      "Sanierungsstau aufsummiert, müssen also exakt zu kostenrahmenText passen. Ist ein Kostenrahmen nicht " +
      "direkt bezifferbar (z.B. reines Verhandlungspotenzial), setze kostenMinEur/kostenMaxEur auf null. " +
      "Außerdem: konkrete Prüffragen für die Besichtigung und eine Risikostufe. " +
      "Nutze Baujahr, Energieklasse und Heizungstyp, um typische Schwachstellen der Baualtersklasse abzuleiten " +
      "(z.B. Asbest, Elektrik, GEG/EU-EPBD-Sanierungspflichten). Verwende durchgehend das vorgegebene " +
      "Hypothesen-Framing statt Tatsachenbehauptungen.\n\n" +
      "Standard-Check bei JEDER Analyse mit energetischem Sanierungsbedarf an der Fassade (Energieklasse E-H " +
      "oder auffällig hoher Energiebedarf): Nimm immer eine Hypothese/Prüffrage zur Mauerwerksart auf, da diese " +
      "die realistische Dämmmethode und damit die Kosten bestimmt – konkret: Ist das Mauerwerk zweischalig mit " +
      "Luft-/Hohlraum (in Norddeutschland bei Klinker-Verblendmauerwerk verbreitet), sodass eine kostengünstige " +
      "Einblasdämmung möglich wäre? Oder ist es einschaliges/massives Mauerwerk ohne Hohlraum, bei dem stattdessen " +
      "teurere Alternativen (WDVS/Außendämmung oder Innendämmung mit Tauwasser-/Schimmelrisiko) nötig sind? " +
      "Nenne diese Unterscheidung explizit in der Hypothese und nimm 'Mauerwerksaufbau (ein-/zweischalig, " +
      "Hohlraum vorhanden?) prüfen bzw. beim Verkäufer/Bauakte erfragen' als Prüffrage auf.",
    messages: [
      {
        role: "user",
        content:
          `Objektdaten: ${JSON.stringify(objektdaten)}` +
          (freitext ? `\nBesonderheiten/Mängel laut Nutzer: ${freitext}` : "") +
          "\n\nErstelle die priorisierte Hypothesenliste mit eindeutigen keys (K1, K2, ..., C1, C2, ..., S1, S2, ...).",
      },
    ],
    output_config: { format: zodOutputFormat(risikoAgentSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Risiko-Analyse fehlgeschlagen");
  return message.parsed_output;
}

async function finanzAgent(
  objektdaten: Objektdaten,
  eigenkapitalEur: number,
  marktwert: MarktwertAgentResult,
  kennzahlen: FinanzierungsKennzahlen,
  instandhaltungsruecklageEur: number,
  sanierungsKreditAnnuitaetEur: number,
): Promise<FinanzAgentResult> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist in diesem Schritt der Investor mit Fokus auf Finanzierung. Die monatliche Annuität, die " +
      "Instandhaltungsrücklage sowie die Zahlen für den Zinsanstiegs- und den Sanierungskredit-Stresstest sind " +
      "bereits deterministisch vorberechnet (siehe 'Bereits berechnete Zahlen' unten) – übernimm sie unverändert " +
      "in deine Texte, rechne sie nicht neu und widersprich ihnen nicht. Schätze selbst nur die sonstigen " +
      "Nebenkosten (Grundsteuer, Gebäudeversicherung u.ä.) sowie vergleichsmieteMinEur/MaxEur (ortsübliche " +
      "Kaltmiete/Monat für ein vergleichbares Objekt in Wohnfläche und Lage). opportunitaetskostenText ist " +
      "bewusst KURZ (max. 2 Sätze) und enthält NUR die Einordnung/Interpretation (z.B. was der Unterschied " +
      "zwischen Kaufen und Mieten für den Vermögensaufbau bedeutet) – wiederhole darin keine Zahlen, die schon " +
      "als Kacheln angezeigt werden (Annuität, Rücklage, Gesamtbelastung, Vergleichsmiete).\n\n" +
      "Erstelle zusätzlich einen Risiko-Stresstest mit 2-3 Szenarien: nutze für 'Zinsanstieg bei " +
      "Anschlussfinanzierung' exakt die vorberechnete Annuität-bei-Zinsanstieg-Differenz als " +
      "deltaMonatlicheBelastungEur, für ein Szenario zur energetischen Sanierungspflicht die vorberechnete " +
      "Sanierungskredit-Annuität als deltaMonatlicheBelastungEur, und ergänze 1 weiteres Szenario (z.B. " +
      "Wertverlust) ohne klare monatliche Delta (dort deltaMonatlicheBelastungEur = null). Rechne eher " +
      "konservativ als beschönigend.",
    messages: [
      {
        role: "user",
        content:
          `Objektdaten: ${JSON.stringify(objektdaten)}\nEigenkapital: ${eigenkapitalEur} EUR\n` +
          `Orientierungswert: ${marktwert.orientierungswertMinEur}-${marktwert.orientierungswertMaxEur} EUR\n` +
          `Kaufnebenkosten: ${marktwert.kaufnebenkostenSchaetzungEur} EUR\n\n` +
          "Bereits berechnete Zahlen (Standardannahme 4,5% Zins/2% Tilgung, Zinsanstiegs-Stresstest 6,5% Zins " +
          "nach 10 Jahren, nicht selbst neu berechnen):\n" +
          `Darlehenssumme: ${kennzahlen.darlehenEur} EUR\n` +
          `Monatliche Annuität: ${kennzahlen.monatlicheAnnuitaetEur} EUR\n` +
          `Instandhaltungsrücklage: ${instandhaltungsruecklageEur} EUR\n` +
          `Restschuld nach 10 Jahren: ${kennzahlen.restschuldNach10JahrenEur} EUR\n` +
          `Annuität bei Zinsanstieg auf 6,5%: ${kennzahlen.annuitaetBeiZinsanstiegEur} EUR ` +
          `(Mehrbelastung: +${kennzahlen.deltaBeiZinsanstiegEur} EUR/Monat)\n` +
          `Monatliche Annuität eines Sanierungskredits über den mittleren geschätzten Sanierungsstau: ` +
          `+${sanierungsKreditAnnuitaetEur} EUR/Monat`,
      },
    ],
    output_config: { format: zodOutputFormat(finanzAgentSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Finanz-Analyse fehlgeschlagen");
  return message.parsed_output;
}

async function syntheseAgent(input: {
  objektdaten: Objektdaten;
  marktwert: MarktwertAgentResult;
  risiko: RisikoAgentResult;
  finanz: FinanzAgentResult;
}) {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 8192,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu fasst die Ersteinschätzung aus allen drei Perspektiven zusammen. Formuliere drei Argumente für und " +
      "drei Argumente gegen den Kauf (jeweils Titel + zahlenbasierte Asset-Begründung, keine Geschmacks- oder " +
      "Wohlfühlargumente).\n\n" +
      "Für den Sanierungsfahrplan denkst du wie der Energieberater aus dem Team: Das strategische Ziel ist, die " +
      "Energieeffizienzklasse innerhalb von 10 Jahren spürbar zu verbessern, um bei der Anschlussfinanzierung " +
      "bessere Konditionen/Beleihung zu erzielen. Nimm nur Maßnahmen auf, die sich nach Preis-Leistung " +
      "rechtfertigen lassen (Kostenrahmen vs. Energieklassensprung vs. Förderquote vs. Effekt auf die " +
      "Anschlussfinanzierung) – keine Maßnahme aus ökologischem Idealismus. Ordne die Maßnahmen nach " +
      "Preis-Leistungs-Priorität, nicht nach vollständiger energetischer Sanierung. Falls die Hypothesen eine " +
      "Prüfung der Mauerwerksart (ein-/zweischalig, Hohlraum) enthalten: Formuliere den Fassaden-Dämmschritt " +
      "konditional dazu (z.B. 'bei zweischaligem Mauerwerk mit Hohlraum: günstige Einblasdämmung; falls " +
      "einschalig/massiv: teurere WDVS-/Innendämmung als Alternative einplanen') statt eine Methode pauschal zu " +
      "unterstellen.\n\n" +
      "Gesamtbild: gesamtbildText ist ein KURZER Fließtext (3-5 Sätze) für den zentralen Gesamteindruck – ohne " +
      "die Zahlen zu wiederholen, die schon in Kacheln/anderen Sections stehen. Die 'wichtigsten offenen Punkte " +
      "vor der Kaufentscheidung' gehören NICHT in diesen Fließtext, sondern separat als offenePunkte: 2-6 kurze, " +
      "konkrete Stichpunkte (je ein Satz).\n\n" +
      "Zusätzlich: Setze 'ampel' auf GRUEN/GELB/ROT und schreibe ein 1-2-sätziges 'kurzfazit'. Wichtig: Die " +
      "Ampel bewertet NICHT Kauf/Nichtkauf, sondern ausschließlich den Klärungs- und Verhandlungsbedarf vor " +
      "einer Entscheidung (ROT = mehrere KAUFENTSCHEIDEND-Hypothesen mit hohem Risiko und/oder Preis deutlich " +
      "über dem Orientierungskorridor und/oder sehr dünne Eigenkapitaldecke; GELB = einzelne relevante Punkte " +
      "zu klären, aber grundsätzlich im Rahmen; GRUEN = wenige Auffälligkeiten, Preis im/unter Korridor, " +
      "solide Finanzierung). Formuliere das kurzfazit im selben Hypothesen-Framing wie den Rest, ohne " +
      "Kaufempfehlung.",
    messages: [
      {
        role: "user",
        content: `Alle bisherigen Analyseergebnisse als JSON:\n${JSON.stringify(input)}`,
      },
    ],
    output_config: { format: zodOutputFormat(syntheseAgentSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Synthese fehlgeschlagen");
  return message.parsed_output;
}

function summiereSanierungsstau(hypothesen: Hypothese[]): {
  sanierungsstauMinEur: number;
  sanierungsstauMaxEur: number;
} {
  const bezifferbar = hypothesen.filter((h) => h.kategorie !== "STRATEGISCH");
  return {
    sanierungsstauMinEur: bezifferbar.reduce((summe, h) => summe + (h.kostenMinEur ?? 0), 0),
    sanierungsstauMaxEur: bezifferbar.reduce((summe, h) => summe + (h.kostenMaxEur ?? 0), 0),
  };
}

async function loadExposeContentBlock(analysisId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { analysisId, kind: "EXPOSE" },
  });
  if (!attachment) throw new Error("Kein Exposé für diese Analyse gefunden");
  const buffer = await storage.readBuffer(attachment.storageKey);
  return exposeContentBlock(buffer, attachment.mimeType);
}

export async function runAnalysisPipeline(analysisId: string): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "PROCESSING" },
  });

  try {
    const analysis = await prisma.analysis.findUniqueOrThrow({ where: { id: analysisId } });
    const expose = await loadExposeContentBlock(analysisId);

    const objektdaten = await extraktionAgent(expose, analysis.freitext);
    const marktwert = await marktwertAgent(objektdaten, analysis.verkaufsart);
    const risiko = await risikoAgent(objektdaten, analysis.freitext);

    const { sanierungsstauMinEur, sanierungsstauMaxEur } = summiereSanierungsstau(risiko.hypothesen);
    const instandhaltungsruecklageEur = instandhaltungsruecklage(objektdaten.wohnflaecheQm);
    const kennzahlen = berechneFinanzierungsKennzahlen({
      angebotspreisEur: objektdaten.angebotspreisEur,
      kaufnebenkostenEur: marktwert.kaufnebenkostenSchaetzungEur,
      eigenkapitalEur: analysis.eigenkapital,
    });
    const sanierungsKreditAnnuitaetEur = monatlicheAnnuitaet({
      darlehenEur: Math.round((sanierungsstauMinEur + sanierungsstauMaxEur) / 2),
      zinsSatz: STANDARD_ZINS,
      tilgungSatz: STANDARD_TILGUNG,
    });

    const finanz = await finanzAgent(
      objektdaten,
      analysis.eigenkapital,
      marktwert,
      kennzahlen,
      instandhaltungsruecklageEur,
      sanierungsKreditAnnuitaetEur,
    );
    const synthese = await syntheseAgent({ objektdaten, marktwert, risiko, finanz });

    const cashflow = {
      monatlicheAnnuitaetEur: kennzahlen.monatlicheAnnuitaetEur,
      instandhaltungsruecklageEur,
      sonstigeNebenkostenEur: finanz.sonstigeNebenkostenEur,
      gesamtbelastungEur:
        kennzahlen.monatlicheAnnuitaetEur + instandhaltungsruecklageEur + finanz.sonstigeNebenkostenEur,
    };

    const report: AnalysisReport = analysisReportSchema.parse({
      objektdaten,
      orientierungswertMinEur: marktwert.orientierungswertMinEur,
      orientierungswertMaxEur: marktwert.orientierungswertMaxEur,
      marktEinschaetzung: marktwert.marktEinschaetzung,
      marktwertText: marktwert.marktwertText,
      verhandlungsargumente: marktwert.verhandlungsargumente,
      kaufnebenkostenSchaetzungEur: marktwert.kaufnebenkostenSchaetzungEur,
      cashflow,
      vergleichsmieteMinEur: finanz.vergleichsmieteMinEur,
      vergleichsmieteMaxEur: finanz.vergleichsmieteMaxEur,
      opportunitaetskostenText: finanz.opportunitaetskostenText,
      risikoSzenarien: finanz.risikoSzenarien,
      argumenteContra: synthese.argumenteContra,
      argumentePro: synthese.argumentePro,
      hypothesen: risiko.hypothesen,
      sanierungsstauMinEur,
      sanierungsstauMaxEur,
      sanierungsfahrplan: synthese.sanierungsfahrplan,
      gesamtbildText: synthese.gesamtbildText,
      offenePunkte: synthese.offenePunkte,
      ampel: synthese.ampel,
      kurzfazit: synthese.kurzfazit,
    });

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: { analysisId, version: 1, payload: report },
      }),
      prisma.analysis.update({
        where: { id: analysisId },
        data: { status: "DONE" },
      }),
    ]);
  } catch (error) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
    });
  }
}

export async function runImpactPipeline(analysisId: string): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "PROCESSING" },
  });

  try {
    const latestResult = await prisma.analysisResult.findFirstOrThrow({
      where: { analysisId },
      orderBy: { version: "desc" },
    });
    const answers = await prisma.hypothesisAnswer.findMany({
      where: { analysisId },
      include: { attachments: { include: { attachment: true } } },
    });

    const answerContent: Anthropic.Messages.ContentBlockParam[] = [];
    for (const answer of answers) {
      answerContent.push({
        type: "text",
        text: `Frage (${answer.hypothesisKey}): ${answer.question}\nAntwort: ${answer.answerText ?? "(nur Anhänge)"}`,
      });
      for (const link of answer.attachments) {
        const { mimeType } = link.attachment;
        if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
          const buffer = await storage.readBuffer(link.attachment.storageKey);
          answerContent.push(exposeContentBlock(buffer, mimeType));
        }
      }
    }

    const message = await anthropic.messages.parse({
      model: ANALYSIS_MODEL,
      // Muss den kompletten Report (alle Felder) erneut ausgeben, deshalb
      // deutlich mehr Headroom als die übrigen Agenten-Schritte.
      max_tokens: 16000,
      system:
        PERSONA_PREAMBLE +
        "\n\nDu aktualisierst eine bestehende Immobilien-Ersteinschätzung mit neuen Informationen aus der " +
        "Besichtigung. Gib den vollständigen, aktualisierten Report im geforderten Schema zurück sowie eine " +
        "kurze Zusammenfassung, was sich durch die neuen Informationen geändert hat und warum. Achte darauf, " +
        "dass hypothesen[].kostenMinEur/kostenMaxEur, die daraus abgeleiteten sanierungsstauMinEur/MaxEur, die " +
        "cashflow-Zahlen sowie ampel/kurzfazit weiterhin intern konsistent zueinander sind, falls sich durch " +
        "die neuen Informationen Kostenrahmen oder Risikoeinschätzungen ändern. Halte verhandlungsargumente als " +
        "Liste einzelner Argumente (nicht ein Fließtext), gesamtbildText kurz und ohne die 'offenen Punkte' " +
        "darin einzubetten (die gehören separat in offenePunkte).",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Bisheriger Report (JSON):\n${JSON.stringify(latestResult.payload)}\n\nNeue Informationen aus der Besichtigung:`,
            },
            ...answerContent,
          ],
        },
      ],
      output_config: { format: zodOutputFormat(enrichmentImpactSchema), effort: "high" },
    });
    if (!message.parsed_output) throw new Error("Anreicherungs-Analyse fehlgeschlagen");

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: {
          analysisId,
          version: latestResult.version + 1,
          payload: message.parsed_output.updatedReport,
          changeSummary: message.parsed_output.changeSummary,
        },
      }),
      prisma.analysis.update({
        where: { id: analysisId },
        data: { status: "DONE" },
      }),
    ]);
  } catch (error) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
    });
  }
}

export const DISCLAIMER = DISCLAIMER_HINWEIS;
