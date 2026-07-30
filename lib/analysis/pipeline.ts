import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, ANALYSIS_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { storage } from "@/lib/storage";
import {
  objektdatenSchema,
  marktwertAgentSchema,
  risikoAgentSchema,
  finanzAgentSchema,
  syntheseAgentSchema,
  sanierungsfahrplanPruefungSchema,
  analysisReportSchema,
  enrichmentImpactSchema,
  type AnalysisReport,
  type Objektdaten,
  type MarktwertAgentResult,
  type RisikoAgentResult,
  type FinanzAgentResult,
  type SyntheseAgentResult,
  type SanierungsfahrplanPruefungResult,
  type Hypothese,
  type SanierungsSchritt,
} from "./schema";
import {
  berechneFinanzierungsKennzahlen,
  instandhaltungsruecklage,
  type FinanzierungsKennzahlen,
} from "./finance";
import { withRetry } from "./retry";
import { validateMarktwert, validateRisiko, validateFinanz, validateReport } from "./consistency";
import { holeMarktdaten, type MarktdatenErgebnis } from "./marktdaten";

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

function marktdatenKontextBlock(marktdaten: MarktdatenErgebnis): string {
  const teile: string[] = [];
  if (marktdaten.bodenrichtwert) {
    const b = marktdaten.bodenrichtwert;
    teile.push(
      `Amtlicher Bodenrichtwert (${b.quelle}, Stichtag ${b.stichtag}): ${b.bodenrichtwertEurProQm} EUR/m² ` +
        `Grundstücksfläche. Verankere deinen Orientierungswert-Korridor erkennbar an dieser amtlichen Referenz ` +
        `und benenne die Quelle im marktwertText (z.B. 'auf Basis des amtlichen Bodenrichtwerts von ...').`,
    );
  } else {
    teile.push(
      "Für diese Lage liegt KEINE amtliche Bodenrichtwert-Referenz vor (Bundesland noch nicht angebunden oder " +
        "Lage nicht eindeutig zuordenbar). Formuliere den Korridor deshalb spürbar vorsichtiger/breiter als bei " +
        "vorliegender amtlicher Referenz und weise im marktwertText explizit darauf hin, dass hierfür keine " +
        "amtliche Grundlage verfügbar war (z.B. 'Ohne amtliche Bodenrichtwert-Referenz für diese Lage ist dieser " +
        "Korridor mit größerer Unsicherheit behaftet als üblich').",
    );
  }
  const veraenderung = marktdaten.preisindex?.veraenderungVorjahrProzent;
  if (marktdaten.preisindex && veraenderung !== null && veraenderung !== undefined) {
    const p = marktdaten.preisindex;
    teile.push(
      `Bundesweiter Häuserpreisindex (${p.quelle}, ${p.jahr}): ${veraenderung >= 0 ? "+" : ""}` +
        `${veraenderung}% ggü. Vorjahr. Nutze das nur als groben Trendhinweis zur allgemeinen ` +
        `Marktrichtung, nicht als Ersatz für die lagespezifische Einordnung.`,
    );
  }
  return teile.join("\n");
}

async function marktwertAgent(
  objektdaten: Objektdaten,
  verkaufsart: string,
  marktdaten: MarktdatenErgebnis,
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
      "verständlich sein, ohne die anderen gelesen zu haben.\n\n" +
      "Externe Marktdaten-Referenz für diese Analyse:\n" +
      marktdatenKontextBlock(marktdaten),
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
  sanierungsstauMinEur: number,
  sanierungsstauMaxEur: number,
): Promise<FinanzAgentResult> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist in diesem Schritt der Investor mit Fokus auf Finanzierung. Die monatliche Annuität, die " +
      "Instandhaltungsrücklage sowie die Zahlen für den Zinsanstiegs-Stresstest sind bereits deterministisch " +
      "vorberechnet (siehe 'Bereits berechnete Zahlen' unten) – übernimm sie unverändert in deine Texte, rechne " +
      "sie nicht neu und widersprich ihnen nicht. Schätze selbst nur die sonstigen Nebenkosten (Grundsteuer, " +
      "Gebäudeversicherung u.ä.).\n\n" +
      "Erstelle zusätzlich einen Risiko-Stresstest mit 2-3 Szenarien:\n" +
      "1) 'Zinsanstieg bei Anschlussfinanzierung': nutze exakt die vorberechnete Annuität-bei-Zinsanstieg-" +
      "Differenz als deltaMonatlicheBelastungEur (einmaligerBetragMinEur/MaxEur = null). WICHTIG: Das Vorzeichen " +
      "ist bereits eindeutig festgelegt – schreibe im Text den vorzeichenrichtigen Wert aus (z.B. 'sinkt um rund " +
      "43 EUR/Monat' bei negativem Wert, 'steigt um rund X EUR/Monat' bei positivem). Schreibe NIEMALS '+/-' oder " +
      "'ca. +/-X' – das ist keine Unsicherheit, sondern ein konkret berechneter Wert. Falls der Wert nahe null " +
      "oder negativ ist, erkläre kurz warum (die Restschuld ist durch die Tilgung über 10 Jahre bereits so weit " +
      "gesunken, dass selbst ein höherer Zinssatz die Rate kaum oder nicht erhöht).\n" +
      "2) Ein Szenario zur energetischen Sanierungspflicht: Das ist KEIN Finanzierungsszenario – unterstelle " +
      "KEINEN neuen Kredit und KEINE zusätzliche Monatsrate dafür (deltaMonatlicheBelastungEur = null für dieses " +
      "Szenario). Nutze stattdessen den vorgegebenen geschätzten Sanierungsstau (Summe aus dem Sanierungsfahrplan) " +
      "als einmaligen Betrag: einmaligerBetragMinEur/MaxEur = genau die vorgegebene Sanierungsstau-Spanne.\n" +
      "3) 1 weiteres Szenario (z.B. Wertverlust) ohne klare monatliche Delta (deltaMonatlicheBelastungEur = " +
      "null); setze einmaligerBetragMinEur/MaxEur nur, wenn ein konkreter einmaliger Betrag zum Szenario passt, " +
      "sonst ebenfalls null. Rechne eher konservativ als beschönigend.",
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
          `(vorzeichenrichtige Differenz: ${kennzahlen.deltaBeiZinsanstiegEur} EUR/Monat)\n` +
          `Geschätzter Sanierungsstau (Summe aus dem Sanierungsfahrplan, als einmaliger Betrag zu verwenden, ` +
          `NICHT in eine neue Kreditrate umrechnen): ${sanierungsstauMinEur}-${sanierungsstauMaxEur} EUR`,
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
      "HARTE REGEL zur Reihenfolge bei Wärmepumpen-Einbau (Hülle vor Heizung): Ist ein Heizungstausch auf " +
      "Wärmepumpe Teil des Fahrplans, MUSS er zeitlich NACH den Hüllenmaßnahmen stehen, die den " +
      "Vorlauftemperaturbedarf senken (mindestens Dach-/Geschossdeckendämmung; bei Klasse E-H in der Regel auch " +
      "Fenster und Fassade), NICHT davor und NICHT parallel im selben frühen Zeitfenster. Grund: Eine " +
      "Wärmepumpe in einem ungedämmten Gebäude mit hohem Vorlauftemperaturbedarf läuft ineffizient (schlechter " +
      "COP, hohe Stromkosten) und ist damit trotz ggf. hoher Förderquote schlechte Preis-Leistung. Verstoße " +
      "gegen diese Regel auch dann nicht, wenn die reine Kosten-Nutzen-Rechnung den Heizungstausch früher " +
      "nahelegen würde – die Reihenfolge hat Vorrang vor der sonstigen Preis-Leistungs-Priorisierung. Ausnahme: " +
      "Die bestehende Heizung ist akut ausgefallen/muss sofort ersetzt werden – dann als Übergangslösung " +
      "kennzeichnen.\n\n" +
      "HARTE REGEL zum individuellen Sanierungsfahrplan (iSFP) und Förderung: Falls ein iSFP Teil des Fahrplans " +
      "ist (z.B. um den iSFP-Bonus zu sichern), MUSS er der zeitlich ALLERERSTE Schritt sein – vor jeder " +
      "Bau-/Dämm-/Heizungsmaßnahme, nicht gleichzeitig mit oder nach der ersten Maßnahme. Grund: Der iSFP-Bonus " +
      "(zusätzliche 5 Prozentpunkte BEG-Förderung) gilt nur für Maßnahmen, die zum Zeitpunkt von deren " +
      "Antragstellung bereits im iSFP enthalten sind – bei einem später erstellten iSFP entfällt der Bonus für " +
      "bereits beantragte/begonnene Maßnahmen. Formuliere die Förderangaben in foerderung dabei präzise " +
      "getrennt: Die BEG-Grundförderung für Einzelmaßnahmen ist auch OHNE iSFP möglich, nur der zusätzliche " +
      "iSFP-Bonus setzt einen vorher erstellten iSFP voraus – schreibe nicht pauschal 'keine Förderung ohne " +
      "iSFP'.\n\n" +
      "Jeder Sanierungsschritt braucht zusätzlich voraussichtlicheEnergieklasseNachMassnahme: eine KUMULATIVE " +
      "Hypothese, in welcher Energieeffizienzklasse (A+ bis H) das Gebäude nach dieser Maßnahme UND allen " +
      "vorherigen Schritten voraussichtlich steht (ausgehend von der aktuellen Energieklasse aus den " +
      "Objektdaten). Das ist eine wichtige Information für Käufer und finanzierende Banken (Beleihung/" +
      "Anschlusskonditionen hängen an der Effizienzklasse), formuliere es trotzdem als Hypothese, z.B. 'H → " +
      "vermutlich F' oder bei mehreren vorherigen Schritten 'vermutlich D' (nicht erneut 'H → D' wiederholen, " +
      "wenn der Sprung schon in Vorschritten passiert ist). Beim letzten Schritt sollte die Zielklasse erkennbar " +
      "sein, die mit dem strategischen 10-Jahres-Ziel zusammenpasst.\n\n" +
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

// Zweite, unabhängige Prüfinstanz (Vier-Augen-Prinzip): läuft nach jeder
// Sanierungsfahrplan-Erstellung, damit sequenz- und plausibilitätsbezogene
// Fehler (z.B. Wärmepumpe vor Dämmung, iSFP nach statt vor der ersten
// Maßnahme) nicht auf einen einzelnen Agenten-Durchlauf angewiesen bleiben.
async function sanierungsfahrplanPruefungAgent(
  objektdaten: Objektdaten,
  hypothesen: Hypothese[],
  sanierungsfahrplan: SanierungsSchritt[],
) {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 8192,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist in diesem Schritt eine ZWEITE, unabhängige Prüfinstanz (Vier-Augen-Prinzip) für einen " +
      "Sanierungsfahrplan, den ein anderer Agent bereits erstellt hat. Prüfe ihn auf technische und " +
      "ökonomische Plausibilität und korrigiere ihn bei Bedarf, ohne die Grundstruktur unnötig zu verändern. " +
      "Prüfe konkret:\n" +
      "1. Reihenfolge Hülle vor Heizung: Ein Wärmepumpen-Tausch darf NICHT vor den Hüllenmaßnahmen stehen, die " +
      "den Vorlauftemperaturbedarf senken (mindestens Dach-/Geschossdeckendämmung; bei Energieklasse E-H in " +
      "der Regel auch Fenster/Fassade) – außer die bestehende Heizung ist akut ausgefallen (dann als " +
      "Übergangslösung kennzeichnen).\n" +
      "2. iSFP zuerst: Falls ein individueller Sanierungsfahrplan (iSFP) enthalten ist, muss er der zeitlich " +
      "erste Schritt sein, da der iSFP-Bonus nur für danach beantragte Maßnahmen gilt.\n" +
      "3. Monotone Energieklassen-Progression: voraussichtlicheEnergieklasseNachMassnahme darf sich über die " +
      "Schritte hinweg nie verschlechtern und muss zu einer realistischen Zielklasse führen (kein Sprung von " +
      "z.B. H direkt auf A+ durch eine einzelne günstige Maßnahme).\n" +
      "4. Kostenrahmen plausibel: Kostenrahmen müssen zur Maßnahme, zur Wohnfläche und zur Baualtersklasse " +
      "passen (kein Nulltarif für große Maßnahmen, keine absurd hohen Beträge für kleine Einzelmaßnahmen).\n" +
      "5. Förderangaben grounded: Fördersätze/-logik müssen mit den allgemein bekannten BEG-Förderregeln " +
      "konsistent sein (Grundförderung für Einzelmaßnahmen auch ohne iSFP möglich, iSFP-Bonus nur mit vorher " +
      "erstelltem iSFP, keine erfundenen Fördertöpfe).\n" +
      "6. Konsistenz mit Mauerwerksaufbau: Falls eine der mitgelieferten Hypothesen die Mauerwerksart " +
      "(ein-/zweischalig, Hohlraum) als offene Frage kennzeichnet, muss der Fassaden-Dämmschritt weiterhin " +
      "konditional formuliert sein (Einblasdämmung bei Hohlraum vs. WDVS/Innendämmung sonst), nicht eine " +
      "Methode pauschal unterstellen.\n\n" +
      "Ist der Fahrplan bereits plausibel, gib ihn UNVERÄNDERT zurück und aenderungen = []. Sind Korrekturen " +
      "nötig, gib den vollständigen korrigierten Fahrplan zurück (alle Schritte, nicht nur die geänderten) und " +
      "liste in aenderungen knapp auf (je ein Satz), was geändert wurde und warum.",
    messages: [
      {
        role: "user",
        content:
          `Objektdaten: ${JSON.stringify(objektdaten)}\n` +
          `Relevante Hypothesen (Substanz/Energie, zur Einordnung): ` +
          `${JSON.stringify(hypothesen.filter((h) => h.kategorie !== "STRATEGISCH"))}\n\n` +
          `Zu prüfender Sanierungsfahrplan: ${JSON.stringify(sanierungsfahrplan)}`,
      },
    ],
    output_config: { format: zodOutputFormat(sanierungsfahrplanPruefungSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Plausibilitätsprüfung des Sanierungsfahrplans fehlgeschlagen");
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

// Zwischenstand der Pipeline, je erfolgreich abgeschlossenem Agenten-Schritt
// in Analysis.pipelineState persistiert. Ermöglicht es, nach einem
// Fehlschlag (z.B. Schritt 4 von 6 schlägt dauerhaft fehl) beim nächsten
// Versuch ab dem zuletzt erfolgreichen Schritt fortzusetzen, statt bereits
// bezahlte/erfolgreiche LLM-Aufrufe wegzuwerfen und ganz von vorn zu
// beginnen.
interface PipelineCheckpoint {
  objektdaten?: Objektdaten;
  marktdaten?: MarktdatenErgebnis;
  marktwert?: MarktwertAgentResult;
  risiko?: RisikoAgentResult;
  finanz?: FinanzAgentResult;
  synthese?: SyntheseAgentResult;
  pruefung?: SanierungsfahrplanPruefungResult;
}

async function ladeCheckpoint(analysisId: string): Promise<PipelineCheckpoint> {
  const analysis = await prisma.analysis.findUniqueOrThrow({
    where: { id: analysisId },
    select: { pipelineState: true },
  });
  return (analysis.pipelineState as PipelineCheckpoint | null) ?? {};
}

async function speichereCheckpointSchritt<K extends keyof PipelineCheckpoint>(
  analysisId: string,
  schritt: K,
  wert: PipelineCheckpoint[K],
): Promise<void> {
  const bisher = await ladeCheckpoint(analysisId);
  const aktualisiert: PipelineCheckpoint = { ...bisher, [schritt]: wert };
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { pipelineState: aktualisiert as unknown as Prisma.InputJsonValue },
  });
}

// Retry-Parameter für die Agenten-Schritte: bis zu 3 Versuche mit
// exponentiellem Backoff (1s, 2s), sowohl für transiente API-Fehler als
// auch für ConsistencyError (siehe consistency.ts) – ein strukturell
// widersprüchliches Ergebnis wird damit einfach noch einmal beim Modell
// angefragt, bevor die ganze Analyse als fehlgeschlagen gilt.
const AGENT_RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  onRetry: (attempt: number, error: unknown) => {
    console.warn(
      `[HauskaufChecker] Agenten-Schritt Versuch ${attempt} fehlgeschlagen, wiederhole:`,
      error instanceof Error ? error.message : error,
    );
  },
};

export async function runAnalysisPipeline(analysisId: string): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "PROCESSING" },
  });

  try {
    const analysis = await prisma.analysis.findUniqueOrThrow({ where: { id: analysisId } });
    const checkpoint = await ladeCheckpoint(analysisId);

    if (!checkpoint.objektdaten) {
      const expose = await loadExposeContentBlock(analysisId);
      checkpoint.objektdaten = await withRetry(
        () => extraktionAgent(expose, analysis.freitext),
        AGENT_RETRY_OPTIONS,
      );
      await speichereCheckpointSchritt(analysisId, "objektdaten", checkpoint.objektdaten);
    }
    const objektdaten = checkpoint.objektdaten;

    if (!checkpoint.marktdaten) {
      // Externe Marktdaten-Quellen degradieren bereits intern auf `null`
      // bei jedem Fehler (siehe lib/analysis/marktdaten) – hier kein Retry
      // nötig, ein Fehlschlag ist kein Pipeline-Fehler.
      checkpoint.marktdaten = await holeMarktdaten(objektdaten.adresseOderLage);
      await speichereCheckpointSchritt(analysisId, "marktdaten", checkpoint.marktdaten);
    }
    const marktdaten = checkpoint.marktdaten;

    if (!checkpoint.marktwert) {
      checkpoint.marktwert = await withRetry(async () => {
        const result = await marktwertAgent(objektdaten, analysis.verkaufsart, marktdaten);
        validateMarktwert(result);
        return result;
      }, AGENT_RETRY_OPTIONS);
      await speichereCheckpointSchritt(analysisId, "marktwert", checkpoint.marktwert);
    }
    const marktwert = checkpoint.marktwert;

    if (!checkpoint.risiko) {
      checkpoint.risiko = await withRetry(async () => {
        const result = await risikoAgent(objektdaten, analysis.freitext);
        validateRisiko(result);
        return result;
      }, AGENT_RETRY_OPTIONS);
      await speichereCheckpointSchritt(analysisId, "risiko", checkpoint.risiko);
    }
    const risiko = checkpoint.risiko;

    const { sanierungsstauMinEur, sanierungsstauMaxEur } = summiereSanierungsstau(risiko.hypothesen);
    const instandhaltungsruecklageEur = instandhaltungsruecklage(objektdaten.wohnflaecheQm);
    const kennzahlen = berechneFinanzierungsKennzahlen({
      angebotspreisEur: objektdaten.angebotspreisEur,
      kaufnebenkostenEur: marktwert.kaufnebenkostenSchaetzungEur,
      eigenkapitalEur: analysis.eigenkapital,
    });

    if (!checkpoint.finanz) {
      checkpoint.finanz = await withRetry(async () => {
        const result = await finanzAgent(
          objektdaten,
          analysis.eigenkapital,
          marktwert,
          kennzahlen,
          instandhaltungsruecklageEur,
          sanierungsstauMinEur,
          sanierungsstauMaxEur,
        );
        validateFinanz(result);
        return result;
      }, AGENT_RETRY_OPTIONS);
      await speichereCheckpointSchritt(analysisId, "finanz", checkpoint.finanz);
    }
    const finanz = checkpoint.finanz;

    if (!checkpoint.synthese) {
      checkpoint.synthese = await withRetry(
        () => syntheseAgent({ objektdaten, marktwert, risiko, finanz }),
        AGENT_RETRY_OPTIONS,
      );
      await speichereCheckpointSchritt(analysisId, "synthese", checkpoint.synthese);
    }
    const synthese = checkpoint.synthese;

    if (!checkpoint.pruefung) {
      checkpoint.pruefung = await withRetry(
        () => sanierungsfahrplanPruefungAgent(objektdaten, risiko.hypothesen, synthese.sanierungsfahrplan),
        AGENT_RETRY_OPTIONS,
      );
      await speichereCheckpointSchritt(analysisId, "pruefung", checkpoint.pruefung);
    }
    const pruefung = checkpoint.pruefung;
    if (pruefung.aenderungen.length > 0) {
      console.warn(
        `[HauskaufChecker] Sanierungsfahrplan-Korrekturen bei Analyse ${analysisId}:`,
        pruefung.aenderungen,
      );
    }

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
      risikoSzenarien: finanz.risikoSzenarien,
      argumenteContra: synthese.argumenteContra,
      argumentePro: synthese.argumentePro,
      hypothesen: risiko.hypothesen,
      sanierungsstauMinEur,
      sanierungsstauMaxEur,
      sanierungsfahrplan: pruefung.sanierungsfahrplan,
      gesamtbildText: synthese.gesamtbildText,
      offenePunkte: synthese.offenePunkte,
      ampel: synthese.ampel,
      kurzfazit: synthese.kurzfazit,
    });
    validateReport(report);

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: { analysisId, version: 1, payload: report },
      }),
      prisma.analysis.update({
        where: { id: analysisId },
        // Checkpoint wird bei Erfolg geleert: eine spätere Anreicherung
        // (runImpactPipeline) beginnt bewusst wieder komplett neu und soll
        // nicht versehentlich einen alten Zwischenstand dieser Analyse
        // wiederverwenden.
        data: { status: "DONE", pipelineState: Prisma.JsonNull },
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
        "darin einzubetten (die gehören separat in offenePunkte). Für risikoSzenarien: deltaMonatlicheBelastungEur " +
        "nur für echte laufende Mehrkosten (z.B. Zinsanstieg), einmaligerBetragMinEur/MaxEur für Kostensummen " +
        "(z.B. Sanierungsstau) – nie eine neue Kreditrate für den Sanierungsstau unterstellen. Für " +
        "sanierungsfahrplan[].voraussichtlicheEnergieklasseNachMassnahme: kumulative Hypothese je Schritt " +
        "beibehalten bzw. an neue Erkenntnisse anpassen.",
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

    const updatedReport = message.parsed_output.updatedReport;
    const pruefung = await sanierungsfahrplanPruefungAgent(
      updatedReport.objektdaten,
      updatedReport.hypothesen,
      updatedReport.sanierungsfahrplan,
    );
    if (pruefung.aenderungen.length > 0) {
      console.warn(
        `[HauskaufChecker] Sanierungsfahrplan-Korrekturen bei Anreicherung ${analysisId}:`,
        pruefung.aenderungen,
      );
      updatedReport.sanierungsfahrplan = pruefung.sanierungsfahrplan;
    }

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: {
          analysisId,
          version: latestResult.version + 1,
          payload: updatedReport,
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
