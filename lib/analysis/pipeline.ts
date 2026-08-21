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
  gesamtPruefungSchema,
  analysisReportSchema,
  enrichmentImpactSchema,
  type AnalysisReport,
  type Objektdaten,
  type MarktwertAgentResult,
  type RisikoAgentResult,
  type FinanzAgentResult,
  type SyntheseAgentResult,
  type SanierungsfahrplanPruefungResult,
  type GesamtPruefungResult,
  type Hypothese,
  type SanierungsSchritt,
} from "./schema";
import {
  berechneFinanzierungsKennzahlen,
  berechneKaufnebenkosten,
  instandhaltungsruecklage,
  INSTANDHALTUNG_EUR_PRO_QM_MONAT,
  STANDARD_ZINS,
  STANDARD_TILGUNG,
  STRESS_ZINS,
  ZINSBINDUNG_JAHRE,
  type FinanzierungsKennzahlen,
} from "./finance";
import { withRetry } from "./retry";
import {
  validateMarktwert,
  validateRisiko,
  validateFinanz,
  validateReport,
  erzwingeAmpelKonsistenz,
} from "./consistency";
import { holeMarktdaten, type MarktdatenErgebnis } from "./marktdaten";
import { bewerteHypothesen } from "./risiko";
import { berechneSanierungsstau, energetischerBedarf } from "./sanierungskosten";
import { berechneSachwert } from "./sachwert";
import { sendeAnalyseFehlgeschlagen, sendeAnalyseFertig } from "@/lib/mail";
import { EREIGNIS, halteFest } from "@/lib/ereignisse";
import { leiteStatusAb } from "./nutzungsdauer";

const DISCLAIMER_HINWEIS =
  "Alle Angaben sind unverbindliche, KI-gestützte Hypothesen auf Basis der bereitgestellten Unterlagen. " +
  "Sie ersetzen keine Prüfung durch einen Bausachverständigen und keine Rechts- oder Finanzberatung.";

// Zinssätze stehen als Dezimalwert in finance.ts, im Prompt sollen sie aber
// so auftauchen, wie sie später auch im Report stehen (z.B. "4,25 %").
function formatProzent(anteil: number): string {
  return `${(anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

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
      "Wenn ein Wert nicht im Dokument steht, setze ihn auf null statt zu raten.\n\n" +
      "Erkenne zusätzlich den Typ des Energieausweises: Steht im Exposé 'Bedarfsausweis' (oder 'Energiebedarfsausweis'), " +
      "setze energieausweisTyp auf 'BEDARF'; steht dort 'Verbrauchsausweis' (oder 'Energieverbrauchsausweis'), setze " +
      "'VERBRAUCH'. Ist der Typ nicht eindeutig benannt, setze null statt zu raten – das ist eine wichtige " +
      "Unterscheidung (ein Verbrauchsausweis basiert auf dem tatsächlichen Heizverhalten der Vorbewohner, nicht auf " +
      "dem berechneten Gebäudebedarf, und ist deshalb weniger belastbar), also nicht einfach 'BEDARF' annehmen, wenn " +
      "es nicht explizit dasteht.\n\n" +
      "Erfasse außerdem zwei Mengenangaben, die für die Kostenschätzung gebraucht werden:\n" +
      "- geschosse: Anzahl der Wohngeschosse einschließlich ausgebautem Dach- oder Untergeschoss (ein " +
      "Bungalow hat 1, 'Einfamilienhaus mit ausgebautem Dachgeschoss' hat 2, ein dreigeschossiges Haus 3). " +
      "Steht es weder als Angabe noch aus der Beschreibung erkennbar im Exposé, setze null.\n" +
      "- anzahlBadezimmer: Anzahl der Badezimmer laut Exposé, inkl. Duschbad und Gäste-WC mit Dusche. Ein " +
      "reines Gäste-WC ohne Dusche zählt nicht mit. Nicht angegeben: null.\n\n" +
      "Leite aus Ort und Postleitzahl das Bundesland ab und gib es in bundesland exakt so an, wie es amtlich " +
      "heißt (z.B. 'Niedersachsen', 'Nordrhein-Westfalen', 'Bremen'). Es wird für die Grunderwerbsteuer " +
      "gebraucht, die je Bundesland unterschiedlich hoch ist. Nur wenn die Lage keine eindeutige Zuordnung " +
      "erlaubt, setze null.\n\n" +
      "Suche außerdem nach der Maklercourtage/Provision und trage in maklerprovisionKaeuferProzent NUR den vom " +
      "KÄUFER zu zahlenden Anteil in Prozent ein (als Zahl, z.B. 3.57 für '3,57% inkl. MwSt.'). Achtung: Wird " +
      "eine Gesamtcourtage genannt, die sich Verkäufer und Käufer teilen (z.B. '6% gesamt, je 3% für Verkäufer " +
      "und Käufer'), dann trage nur den Käuferanteil ein (hier: 3). Steht keine Courtage im Exposé, setze null.\n\n" +
      "Lies außerdem den Beschreibungs-/Ausstattungs-/Lagetext (nicht nur die Tabellenfelder) aufmerksam durch und " +
      "erfasse in besonderheitenAusExpose als Liste kurzer, sachlicher Notizen alles, was dort steht, aber nicht in " +
      "den strukturierten Feldern abgebildet ist oder diesen widerspricht. Achte besonders auf: erwähnte Schäden " +
      "oder Schadensbeseitigungen, Rückbauten, unfertige/nicht nutzbare Räume (z.B. Rohbauzustand), sowie " +
      "Widersprüche zwischen einer im Text genannten Stückzahl (z.B. 'zwei Badezimmer') und deren tatsächlich " +
      "beschriebenem Zustand (z.B. wenn eines davon laut Text zurückgebaut und nicht nutzbar ist). Jede Notiz kurz " +
      "und konkret (ein Satz), nichts interpretieren oder bewerten – das macht ein späterer Schritt. Leeres Array, " +
      "wenn der Fließtext nichts dergleichen enthält, nichts erfinden.",
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
  // Sachwertverfahren nach ImmoWertV als zusaetzliche, gerechnete Grundlage.
  // Liefert null, solange fuer die Region kein Sachwertfaktor hinterlegt ist
  // - dann bleibt es bei der bisherigen Einordnung, statt mit einem
  // geratenen Faktor Genauigkeit vorzutaeuschen.
  const sachwert = berechneSachwert({
    objektdaten,
    bodenrichtwertEurProQm: marktdaten.bodenrichtwert?.bodenrichtwertEurProQm ?? null,
  });
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
      marktdatenKontextBlock(marktdaten) +
      (sachwert
        ? "\n\nSachwertverfahren nach ImmoWertV, aus amtlichen Kennwerten gerechnet – behandle das " +
          "als belastbaren Anker für den Korridor, nicht als eine Meinung unter vielen. Weicht deine " +
          "eigene Einordnung deutlich davon ab, begründe das ausdrücklich im marktwertText:\n" +
          sachwert.rechenweg.map((z) => `  ${z}`).join("\n") +
          `\n  → Marktwert nach Sachwertverfahren: ${sachwert.marktwertEur.toLocaleString("de-DE")} EUR`
        : ""),
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

function energieausweisHinweisText(objektdaten: Objektdaten): string {
  if (objektdaten.energieausweisTyp === "VERBRAUCH") {
    return (
      "\n\nWICHTIG zum Energieausweis: Es liegt ein VERBRAUCHSAUSWEIS vor. Dieser beruht auf dem tatsächlichen " +
      "Heizverhalten der Vorbewohner (Personenzahl, Heizgewohnheiten, Leerstandszeiten), nicht auf einer " +
      "gebäudebezogenen Berechnung – der reale energetische Bedarf kann davon spürbar nach oben oder unten " +
      "abweichen. Nimm in die Hypothese zum energetischen Zustand explizit einen Hinweis darauf auf (z.B. als " +
      "eigene Prüffrage nach einem vorliegenden oder nachträglich erstellbaren Bedarfsausweis) und formuliere den " +
      "energetischen Zustand entsprechend vorsichtiger, statt den Verbrauchswert wie einen Bedarfswert zu behandeln."
    );
  }
  if (objektdaten.energieausweisTyp === null && objektdaten.energieklasse !== null) {
    return (
      "\n\nHinweis zum Energieausweis: Der Typ (Bedarfs- oder Verbrauchsausweis) ist aus dem Exposé nicht eindeutig " +
      "erkennbar. Nimm deshalb eine Prüffrage auf, welcher Ausweistyp vorliegt, da ein Verbrauchsausweis auf " +
      "tatsächlichem Heizverhalten statt einer Gebäudeberechnung beruht und entsprechend abweichen kann."
    );
  }
  return "";
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
      "Vor-Ort-Prüfung). Formuliere priorisierte Hypothesen zu Substanz- und Kostenrisiken. Jede Hypothese braucht einen Kostenrahmen " +
      "als Text (z.B. '25.000–45.000 EUR') UND denselben Kostenrahmen als Zahlen in kostenMinEur/kostenMaxEur " +
      "(ohne Formatierung, z.B. 25000 und 45000) – diese Zahlen werden programmatisch zum geschätzten " +
      "Sanierungsstau aufsummiert, müssen also exakt zu kostenrahmenText passen. Ist ein Kostenrahmen nicht " +
      "direkt bezifferbar (z.B. reines Verhandlungspotenzial), setze kostenMinEur/kostenMaxEur auf null. " +
      "Außerdem: konkrete Prüffragen für die Besichtigung.\n\n" +
      "WICHTIG – du vergibst KEINE Risikostufe und KEINE Kategorie. Beides wird aus deinen Faktenangaben " +
      "berechnet. Beantworte stattdessen je Hypothese diese sechs Fragen sachlich und nur anhand dessen, was " +
      "im Exposé steht:\n" +
      "- belegtImExpose + zitatAusExpose: true NUR, wenn der Befund wörtlich im Exposé steht. Gib die " +
      "belegende Textstelle in zitatAusExpose wörtlich wieder (ein Satz genügt). Kannst du nichts zitieren, " +
      "setze belegtImExpose=false und zitatAusExpose=null – aus Baujahr oder Baualtersklasse abgeleitete " +
      "Annahmen sind ausdrücklich NICHT belegt.\n" +
      "- ursacheGeklaert: Diese Frage gilt AUSSCHLIESSLICH für einen bereits eingetretenen Schaden, der im " +
      "Exposé benannt wird – z.B. Wasserschaden, Schadensbeseitigung, Rückbau nach einem Schaden, Riss, " +
      "Leckage, Feuchtigkeit, Schimmel. Nur dann: true, wenn die Ursache im Exposé dokumentiert ist, sonst " +
      "false. Eine Einrichtung oder Nutzung, die künftig einen Schaden verursachen KÖNNTE (z.B. Sauna, Kamin, " +
      "Pool, Flachdach, offene Elektroinstallation), ist AUSDRÜCKLICH KEIN Schaden – dann null. Ebenso null " +
      "bei Alterung, Verschleiß und energetischem Sanierungsbedarf ohne benanntes Schadensereignis. Im " +
      "Zweifel null.\n" +
      "- folgeschadenMoeglich: NUR true, wenn im Exposé ein konkreter Anhaltspunkt steht – ein genannter " +
      "Schaden, eine Schadensbeseitigung, ein Rückbau, Feuchtespuren, ein ungeschütztes Bauteil. Die " +
      "allgemeine Möglichkeit ('bei Häusern dieses Baujahrs kann immer Feuchte auftreten') reicht " +
      "AUSDRÜCKLICH NICHT und ist mit false zu beantworten.\n" +
      "- rechtlichUngeklaert: Ist eine Genehmigung, das Baurecht oder der Bestandsschutz TATSÄCHLICH offen " +
      "(z.B. Einliegerwohnung, Umnutzung oder Anbau ohne erkennbare Genehmigung)? Diese Angabe stuft die " +
      "Hypothese automatisch als kaufentscheidend ein, setze sie deshalb nur, wenn wirklich etwas ungeklärt " +
      "ist. AUSDRÜCKLICH NICHT ungeklärt ist ein Sachverhalt, den das Exposé als genehmigt bezeichnet " +
      "('baurechtlich genehmigt') oder dessen Genehmigung es unter den vorliegenden Unterlagen aufführt " +
      "(Baugenehmigung, Bauzeichnungen, Statik). Dass ein Dokument noch nicht selbst eingesehen wurde, macht " +
      "die Rechtslage nicht ungeklärt – das ist eine normale Prüffrage und gehört in pruefragen, nicht in " +
      "dieses Flag.\n" +
      "- gesetzlicheFrist: Erzwingt eine gesetzliche Regel (GEG, EU-EPBD) absehbar eine Maßnahme?\n" +
      "- vorOrtKlaerbar: Lässt sich das bei einer normalen Besichtigung klären (true), oder braucht es " +
      "Gutachten, Bauakte, Messung oder eine Behördenauskunft (false)?\n\n" +
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
      "Hohlraum vorhanden?) prüfen bzw. beim Verkäufer/Bauakte erfragen' als Prüffrage auf.\n\n" +
      "Erstelle ZUSÄTZLICH die Gewerke-Checkliste: genau acht Einträge, für jedes Gewerk exakt einen – DACH, " +
      "FASSADE, FENSTER, HEIZUNG, ELEKTRO, SANITAER, INNENAUSBAU, SCHADSTOFFE. Je Gewerk genau ein Status:\n" +
      "- ERNEUERT: Das Exposé sagt, dass dieses Gewerk erneuert/modernisiert wurde.\n" +
      "- HANDLUNGSBEDARF: Aufwand ist absehbar.\n" +
      "- NICHT_BEURTEILBAR: Die Unterlagen geben dazu nichts her.\n" +
      "Begründe jeden Eintrag in einem Satz. Nutze NICHT_BEURTEILBAR nur, wenn wirklich nichts ableitbar ist – " +
      "aus Baujahr und Energiekennwerten lässt sich für die meisten Gewerke ein Status begründen.\n" +
      "Beantworte je Gewerk ZUSÄTZLICH diese drei Fragen – sie werden nachgelagert ausgewertet:\n" +
      "- erneuertLautExpose: true NUR, wenn das Exposé ausdrücklich sagt, dass dieses Gewerk erneuert, " +
      "modernisiert oder ausgetauscht wurde. Aus dem Baujahr abgeleitete Annahmen sind KEINE Erneuerung.\n" +
      "- erneuerungsJahr: Das genannte Jahr der Erneuerung als Zahl. Diese Angabe ist entscheidend – ohne sie " +
      "lässt sich das Alter des Bauteils nicht bestimmen. Suche deshalb im gesamten Exposé danach, auch im " +
      "Fließtext ('Heizung 2015 erneuert', 'neue Fenster seit 2018', 'Bad vor drei Jahren modernisiert'). " +
      "Steht nur ein Zeitraum ('in den 2010er Jahren'), nimm das späteste plausible Jahr; steht eine relative " +
      "Angabe ('vor drei Jahren'), rechne sie in ein Jahr um. Findest du wirklich kein Jahr: null.\n" +
      "- zitatAusExpose: Die belegende Textstelle wörtlich (ein Satz genügt). Kannst du nichts zitieren, setze " +
      "erneuertLautExpose=false und zitatAusExpose=null.\n" +
      "WICHTIG: Nenne in der Checkliste KEINE Beträge. Der Kostenrahmen je Gewerk wird nachgelagert aus einer " +
      "hinterlegten Referenztabelle (Kostenkennwert mal Bezugsmenge) berechnet. Deine Aufgabe ist die " +
      "Zustandsbeurteilung und die Beleglage – sie entscheiden, ob ein Gewerk in den Sanierungsstau eingeht.\n\n" +
      "WICHTIG: objektdaten.besonderheitenAusExpose enthält Notizen aus dem Fließtext des Exposés (Schäden, " +
      "Rückbauten, unfertige Räume, Widersprüche zu Tabellenfeldern). Für JEDE Notiz darin MUSST du eine eigene " +
      "Hypothese mit konkreten Prüffragen " +
      "aufnehmen – das sind vom Verkäufer/Makler selbst offengelegte Sachverhalte, die nicht untergehen dürfen, " +
      "nur weil sie im Fließtext statt in einer Tabelle standen." +
      energieausweisHinweisText(objektdaten),
    messages: [
      {
        role: "user",
        content:
          `Objektdaten: ${JSON.stringify(objektdaten)}` +
          (freitext ? `\nBesonderheiten/Mängel laut Nutzer: ${freitext}` : "") +
          "\n\nErstelle die priorisierte Hypothesenliste mit eindeutigen keys (H1, H2, H3, ...).",
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
  kaufnebenkostenEur: number,
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
      "sie nicht neu und widersprich ihnen nicht. Nenne KEINE geschätzten laufenden Nebenkosten (Grundsteuer, " +
      "Gebäudeversicherung, Energie) als Zahl: Sie hängen von Angaben ab, die nicht im Exposé stehen, und werden " +
      "im Report bewusst nicht beziffert.\n\n" +
      "Erstelle zusätzlich einen Risiko-Stresstest mit 2-3 Szenarien:\n" +
      "1) 'Zinsanstieg bei Anschlussfinanzierung': nutze exakt die vorberechnete Annuität-bei-Zinsanstieg-" +
      "Differenz als deltaMonatlicheBelastungEur (einmaligerBetragMinEur/MaxEur = null). WICHTIG: Das Vorzeichen " +
      "ist bereits eindeutig festgelegt – schreibe im Text den vorzeichenrichtigen Wert aus (z.B. 'sinkt um rund " +
      "43 EUR/Monat' bei negativem Wert, 'steigt um rund X EUR/Monat' bei positivem). Schreibe NIEMALS '+/-' oder " +
      "'ca. +/-X' – das ist keine Unsicherheit, sondern ein konkret berechneter Wert. Falls der Wert nahe null " +
      `oder negativ ist, erkläre kurz warum (die Restschuld ist durch die Tilgung über ${ZINSBINDUNG_JAHRE} Jahre bereits so weit ` +
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
          `Kaufnebenkosten: ${kaufnebenkostenEur} EUR\n\n` +
          `Bereits berechnete Zahlen (Standardannahme ${formatProzent(STANDARD_ZINS)} Zins/` +
          `${formatProzent(STANDARD_TILGUNG)} Tilgung, Zinsanstiegs-Stresstest ${formatProzent(STRESS_ZINS)} Zins ` +
          `nach ${ZINSBINDUNG_JAHRE} Jahren, nicht selbst neu berechnen):\n` +
          `Darlehenssumme: ${kennzahlen.darlehenEur} EUR\n` +
          `Monatliche Annuität: ${kennzahlen.monatlicheAnnuitaetEur} EUR\n` +
          `Instandhaltungsrücklage: ${instandhaltungsruecklageEur} EUR\n` +
          `Restschuld nach ${ZINSBINDUNG_JAHRE} Jahren: ${kennzahlen.restschuldNach10JahrenEur} EUR\n` +
          `Annuität bei Zinsanstieg auf ${formatProzent(STRESS_ZINS)}: ${kennzahlen.annuitaetBeiZinsanstiegEur} EUR ` +
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

// Abschließende, unabhängige Vier-Augen-Prüfung über den GESAMTEN Report –
// nicht derselbe Agent, der einen Abschnitt noch einmal liest, sondern ein
// eigener Prompt mit eigenem Fokus auf genau die Fehler, die entstehen,
// wenn mehrere unabhängige Agenten-Ergebnisse zu einem Dokument
// zusammengefügt werden, ohne dass jemand das Gesamtbild noch einmal
// gegenprüft (z.B. eine Ampel, die nicht zu den eigenen Hypothesen passt,
// ein Pro-Argument, das einer Hypothese widerspricht, oder ein
// Sprachregel-Verstoß, der nur in einem von sechs Agenten-Outputs steckt).
// Objektdaten, Preiskorridor, Kaufnebenkosten, Hypothesen-Kostenrahmen,
// Sanierungsstau, Cashflow und der Sanierungsfahrplan sind an dieser Stelle
// bereits deterministisch berechnet bzw. eigens geprüft und werden dem
// Modell nur als feststehender Kontext mitgegeben, nicht zur Veränderung.
async function gesamtPruefungAgent(report: AnalysisReport): Promise<GesamtPruefungResult> {
  const message = await anthropic.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 8192,
    system:
      PERSONA_PREAMBLE +
      "\n\nDu bist die abschließende, unabhängige Vier-Augen-Prüfung für den GESAMTEN Report. Du hast keinen der " +
      "Abschnitte selbst geschrieben und liest ihn deshalb nicht wohlwollend, sondern suchst gezielt nach " +
      "Widersprüchen und Fehlern, die entstehen, wenn unabhängig erstellte Abschnitte zusammengefügt werden.\n\n" +
      "Objektdaten, der Preiskorridor (orientierungswertMinEur/MaxEur), die Kaufnebenkosten, die " +
      "Hypothesen-Kostenrahmen, der daraus abgeleitete Sanierungsstau, alle Cashflow-Zahlen und der " +
      "Sanierungsfahrplan sind bereits deterministisch berechnet bzw. durch eine eigene Prüfinstanz abgesichert – " +
      "das ist feststehender Kontext für dich, verändere und wiederhole diese Zahlen NICHT.\n\n" +
      "Prüfe konkret:\n" +
      "1. Ampel-Konsistenz: ROT erfordert mindestens eine KAUFENTSCHEIDEND-Hypothese mit Risiko HOCH und/oder " +
      "einen Angebotspreis spürbar über der oberen Korridorgrenze; GELB einzelne relevante, aber im Rahmen " +
      "liegende Punkte; GRUEN wenige Auffälligkeiten und Preis im/unter Korridor. Passt die mitgelieferte Ampel " +
      "nicht zu den mitgelieferten Hypothesen/Zahlen, korrigiere ampel und kurzfazit entsprechend.\n" +
      "2. Sprachregel-Verstoß-Scan: Durchsuche marktEinschaetzung, marktwertText, alle Argumente, " +
      "gesamtbildText und kurzfazit auf die weiter oben genannten verbotenen Begriffe/Tatsachenbehauptungen " +
      "(z.B. 'Gutachten', 'ist sicher', 'empfehle den Kauf', ein Preisurteil ohne Hypothesen-Framing) und " +
      "formuliere jede Fundstelle ins vorgegebene Hypothesen-Framing um.\n" +
      "3. Pro/Contra-Widerspruchsfreiheit: Kein Pro-Argument darf einem Contra-Argument oder einer " +
      "mitgelieferten Hypothese faktisch widersprechen; jedes Argument muss durch Objektdaten oder Hypothesen " +
      "gedeckt sein, nicht frei erfunden.\n" +
      "4. Zahlen-Text-Konsistenz: Zahlen, die in marktwertText genannt werden (z.B. 'X EUR über Korridor'), " +
      "müssen exakt zum mitgelieferten Preiskorridor und Angebotspreis passen. Beschreibungen in " +
      "risikoSzenarien dürfen den mitgelieferten deltaMonatlicheBelastungEur/einmaligerBetrag-Werten nicht " +
      "widersprechen – diese Zahlen selbst nicht verändern, nur Formulierungen bei Bedarf präzisieren.\n" +
      "5. offenePunkte-Redundanz: Keine offenePunkte-Zeile darf eine Prüffrage aus den Hypothesen wortgleich " +
      "wiederholen – zusammenfassen oder Duplikate entfernen.\n" +
      "6. Marktdaten-Zitation: Wurde dir im marktwertText eine amtliche Marktdaten-Referenz mitgeteilt, muss " +
      "sie erkennbar benannt sein; wurde explizit das Fehlen einer amtlichen Grundlage vermerkt, darf das nicht " +
      "verschwiegen/entfernt werden.\n" +
      "7. Verbrauchsausweis-Hinweis: Liegt laut objektdaten.energieausweisTyp ein VERBRAUCHSAUSWEIS vor, muss der " +
      "Report an mindestens einer Stelle (typischerweise in einer energiebezogenen Hypothese, die du hier nicht " +
      "verändern kannst) explizit darauf hinweisen, dass der ausgewiesene Wert auf dem tatsächlichen Verbrauch der " +
      "Vorbewohner beruht und vom realen Bedarf abweichen kann. Fehlt dieser Hinweis komplett, ergänze ihn knapp in " +
      "gesamtbildText (ohne dafür bereits vorhandene Kernaussagen zu verdrängen).\n\n" +
      "Ist bereits alles konsistent, gib alle Felder UNVERÄNDERT zurück und aenderungen = []. Sind Korrekturen " +
      "nötig, gib ALLE Felder vollständig zurück (auch die unveränderten, nicht nur Ausschnitte) und liste in " +
      "aenderungen knapp auf (je ein Satz), was geändert wurde und warum.",
    messages: [
      {
        role: "user",
        content:
          "Vollständiger Report zur Prüfung (Objektdaten, Preiskorridor, Kaufnebenkosten, Hypothesen-" +
          "Kostenrahmen, Sanierungsstau, Cashflow und Sanierungsfahrplan sind feststehend, nicht verändern):\n" +
          JSON.stringify(report),
      },
    ],
    output_config: { format: zodOutputFormat(gesamtPruefungSchema), effort: "high" },
  });
  if (!message.parsed_output) throw new Error("Gesamt-Prüfung des Reports fehlgeschlagen");
  return message.parsed_output;
}

// Führt das Ergebnis der Gesamt-Prüfung mit dem bereits zusammengesetzten
// Report zusammen und validiert das Ergebnis erneut deterministisch (siehe
// consistency.ts) – als letzte Absicherung, falls die Prüfinstanz selbst
// versehentlich eine neue Inkonsistenz einführen sollte.
function wendeGesamtPruefungAn(
  report: AnalysisReport,
  pruefung: GesamtPruefungResult,
): AnalysisReport {
  const { ampel, wurdeKorrigiert } = erzwingeAmpelKonsistenz(pruefung.ampel, report.hypothesen, {
    sanierungsstauMaxEur: report.sanierungsstauMaxEur,
    angebotspreisEur: report.objektdaten.angebotspreisEur,
    orientierungswertMaxEur: report.orientierungswertMaxEur,
  });
  if (wurdeKorrigiert) {
    console.warn(
      `[HauskaufChecker] Ampel deterministisch auf ${ampel} korrigiert (Gesamt-Prüfung), Modell lieferte "${pruefung.ampel}".`,
    );
  }
  const finalReport = analysisReportSchema.parse({
    ...report,
    marktEinschaetzung: pruefung.marktEinschaetzung,
    marktwertText: pruefung.marktwertText,
    verhandlungsargumente: pruefung.verhandlungsargumente,
    risikoSzenarien: pruefung.risikoSzenarien,
    argumenteContra: pruefung.argumenteContra,
    argumentePro: pruefung.argumentePro,
    gesamtbildText: pruefung.gesamtbildText,
    offenePunkte: pruefung.offenePunkte,
    ampel,
    kurzfazit: pruefung.kurzfazit,
  });
  validateReport(finalReport);
  return finalReport;
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
  gesamtPruefung?: GesamtPruefungResult;
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
  // Den Lauf beanspruchen, statt den Status blind zu setzen.
  //
  // Zwei Wege können hier gleichzeitig ankommen: der Anstoß über die
  // Hintergrundroute und der Ersatzweg im aufrufenden Prozess, falls dieser
  // Anstoß zu scheitern schien. Genau das ist im Test passiert – zwei
  // Pipelines liefen auf demselben Datensatz, überschrieben sich gegenseitig
  // die Zwischenstände und endeten im Fehler. Nebenbei kostete es doppelt.
  //
  // updateMany mit Statusbedingung ist eine einzelne atomare Anweisung: Nur
  // wer den Datensatz von PENDING oder ERROR auf PROCESSING dreht, hat den
  // Zuschlag. Netlify stellt Hintergrundaufrufe im Fehlerfall ausserdem
  // erneut zu – auch dagegen schützt das.
  const beansprucht = await prisma.analysis.updateMany({
    where: { id: analysisId, status: { in: ["PENDING", "ERROR"] } },
    data: { status: "PROCESSING" },
  });
  if (beansprucht.count === 0) {
    console.info(
      `[HauskaufChecker] Analyse ${analysisId} wird bereits ausgewertet – zweiter Anlauf verworfen.`,
    );
    return;
  }

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
    // Risikostufe und Kategorie werden hier aus den Faktenangaben berechnet,
    // nicht vom Modell vergeben (siehe risiko.ts).
    const hypothesen = bewerteHypothesen(risiko.hypothesen, objektdaten.angebotspreisEur);

    // Zweite Stufe der Vereinheitlichung: Wo eine belegte Nutzungsdauer
    // vorliegt, wird auch der Status gerechnet statt beurteilt (siehe
    // nutzungsdauer.ts). Für die übrigen Gewerke fehlt bislang eine Quelle –
    // dort bleibt es bei der Einschätzung des Modells.
    const bewertungsjahr = new Date().getFullYear();
    const gewerkeMitStatus = risiko.gewerke.map((g) => {
      const hergeleitet = leiteStatusAb(
        g.gewerk,
        {
          erneuertLautExpose: g.erneuertLautExpose,
          erneuerungsJahr: g.erneuerungsJahr,
          zitatAusExpose: g.zitatAusExpose,
        },
        objektdaten.baujahr,
        bewertungsjahr,
        energetischerBedarf(objektdaten),
      );
      if (!hergeleitet) return g;
      if (hergeleitet.status !== g.status) {
        console.info(
          `[HauskaufChecker] Analyse ${analysisId}: Gewerk ${g.gewerk} von ${g.status} auf ` +
            `${hergeleitet.status} korrigiert – ${hergeleitet.herleitung}`,
        );
      }
      return {
        ...g,
        status: hergeleitet.status,
        begruendung: hergeleitet.herleitung,
        statusBasis: hergeleitet.basis,
        annahmeHinweis: hergeleitet.annahmeHinweis,
        klaerungsfrage: hergeleitet.klaerungsfrage,
      };
    });

    // Der Sanierungsstau kommt aus der Referenztabelle: Das Modell beurteilt
    // nur den Zustand je Gewerk, die Beträge ergeben sich aus Kostenkennwert
    // mal Bezugsmenge (siehe sanierungskosten.ts). Bei gleichem Zustandsbild
    // ist die Summe damit reproduzierbar.
    const stau = berechneSanierungsstau(gewerkeMitStatus, objektdaten);
    const { sanierungsstauMinEur, sanierungsstauMaxEur, nichtBeurteilbar } = stau;
    // Die Checkliste für den Report um die gerechneten Beträge ergänzen.
    const gewerkeMitKosten = gewerkeMitStatus.map((g) => {
      const berechnet = stau.posten.find((p) => p.gewerk === g.gewerk);
      if (berechnet) return { ...g, ...berechnet, ausserhalbDerSumme: false };
      // Nicht beurteilbare Gewerke bekommen ihren Betrag ebenfalls, aber
      // ausdrücklich als nicht mitgezählt markiert.
      const offen = stau.nichtBeurteilbarePosten.find((p) => p.gewerk === g.gewerk);
      if (offen) return { ...g, ...offen, ausserhalbDerSumme: true };
      return { ...g, kostenMinEur: null, kostenMaxEur: null };
    });
    if (nichtBeurteilbar.length > 0) {
      console.warn(
        `[HauskaufChecker] Analyse ${analysisId}: ${nichtBeurteilbar.length} Gewerk(e) nicht beurteilbar:`,
        nichtBeurteilbar,
      );
    }
    const instandhaltungsruecklageEur = instandhaltungsruecklage(objektdaten.wohnflaecheQm);
    // Kaufnebenkosten werden gerechnet, nicht geschaetzt (siehe finance.ts).
    const kaufnebenkosten = berechneKaufnebenkosten({
      angebotspreisEur: objektdaten.angebotspreisEur,
      bundesland: objektdaten.bundesland,
      maklerprovisionKaeuferProzent: objektdaten.maklerprovisionKaeuferProzent,
      mitMakler: analysis.verkaufsart === "MAKLER",
    });
    const kennzahlen = berechneFinanzierungsKennzahlen({
      angebotspreisEur: objektdaten.angebotspreisEur,
      kaufnebenkostenEur: kaufnebenkosten.summeEur,
      eigenkapitalEur: analysis.eigenkapital,
    });

    if (!checkpoint.finanz) {
      checkpoint.finanz = await withRetry(async () => {
        const result = await finanzAgent(
          objektdaten,
          analysis.eigenkapital,
          marktwert,
          kaufnebenkosten.summeEur,
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
      const syntheseResult = await withRetry(
        () => syntheseAgent({ objektdaten, marktwert, risiko, finanz }),
        AGENT_RETRY_OPTIONS,
      );
      const { ampel, wurdeKorrigiert } = erzwingeAmpelKonsistenz(syntheseResult.ampel, hypothesen, {
        sanierungsstauMaxEur,
        angebotspreisEur: objektdaten.angebotspreisEur,
        orientierungswertMaxEur: marktwert.orientierungswertMaxEur,
      });
      if (wurdeKorrigiert) {
        console.warn(
          `[HauskaufChecker] Ampel deterministisch auf ROT korrigiert bei Analyse ${analysisId} ` +
            `(Modell lieferte "${syntheseResult.ampel}").`,
        );
      }
      checkpoint.synthese = { ...syntheseResult, ampel };
      await speichereCheckpointSchritt(analysisId, "synthese", checkpoint.synthese);
    }
    const synthese = checkpoint.synthese;

    if (!checkpoint.pruefung) {
      checkpoint.pruefung = await withRetry(
        () => sanierungsfahrplanPruefungAgent(objektdaten, hypothesen, synthese.sanierungsfahrplan),
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
      gesamtbelastungEur: kennzahlen.monatlicheAnnuitaetEur + instandhaltungsruecklageEur,
    };
    const finanzAnnahmen = {
      sollzins: STANDARD_ZINS,
      tilgung: STANDARD_TILGUNG,
      zinsbindungJahre: ZINSBINDUNG_JAHRE,
      stressZins: STRESS_ZINS,
      instandhaltungEurProQmMonat: INSTANDHALTUNG_EUR_PRO_QM_MONAT,
    };

    const report: AnalysisReport = analysisReportSchema.parse({
      objektdaten,
      orientierungswertMinEur: marktwert.orientierungswertMinEur,
      orientierungswertMaxEur: marktwert.orientierungswertMaxEur,
      marktEinschaetzung: marktwert.marktEinschaetzung,
      marktwertText: marktwert.marktwertText,
      verhandlungsargumente: marktwert.verhandlungsargumente,
      kaufnebenkostenSchaetzungEur: kaufnebenkosten.summeEur,
      kaufnebenkostenAufstellung: {
        grunderwerbsteuerEur: kaufnebenkosten.grunderwerbsteuerEur,
        grunderwerbsteuerProzent: kaufnebenkosten.grunderwerbsteuerProzent,
        notarGrundbuchEur: kaufnebenkosten.notarGrundbuchEur,
        maklerprovisionEur: kaufnebenkosten.maklerprovisionEur,
        maklerprovisionProzent: kaufnebenkosten.maklerprovisionProzent,
        bundeslandGeschaetzt: kaufnebenkosten.bundeslandGeschaetzt,
        maklerprovisionGeschaetzt: kaufnebenkosten.maklerprovisionGeschaetzt,
      },
      cashflow,
      finanzAnnahmen,
      risikoSzenarien: finanz.risikoSzenarien,
      argumenteContra: synthese.argumenteContra,
      argumentePro: synthese.argumentePro,
      hypothesen,
      gewerke: gewerkeMitKosten,
      sanierungsstauMinEur,
      sanierungsstauMaxEur,
      sanierungsfahrplan: pruefung.sanierungsfahrplan,
      gesamtbildText: synthese.gesamtbildText,
      offenePunkte: synthese.offenePunkte,
      ampel: synthese.ampel,
      kurzfazit: synthese.kurzfazit,
    });
    validateReport(report);

    if (!checkpoint.gesamtPruefung) {
      checkpoint.gesamtPruefung = await withRetry(async () => {
        const result = await gesamtPruefungAgent(report);
        wendeGesamtPruefungAn(report, result); // wirft bei Inkonsistenz -> löst Retry aus
        return result;
      }, AGENT_RETRY_OPTIONS);
      await speichereCheckpointSchritt(analysisId, "gesamtPruefung", checkpoint.gesamtPruefung);
    }
    const gesamtPruefung = checkpoint.gesamtPruefung;
    if (gesamtPruefung.aenderungen.length > 0) {
      console.warn(
        `[HauskaufChecker] Gesamt-Report-Korrekturen bei Analyse ${analysisId}:`,
        gesamtPruefung.aenderungen,
      );
    }
    const finalReport = wendeGesamtPruefungAn(report, gesamtPruefung);

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: { analysisId, version: 1, payload: finalReport },
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
    // Fertigmeldung. Bewusst ohne Reportinhalt – die Mail sagt nur, dass
    // etwas fertig ist, und verlinkt ins Konto.
    await halteFest(EREIGNIS.ANALYSE_FERTIG, analysisId);
    await benachrichtigeUeberErgebnis(analysisId, true);
  } catch (error) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
    });
    await halteFest(EREIGNIS.ANALYSE_FEHLGESCHLAGEN, analysisId);
    await benachrichtigeUeberErgebnis(analysisId, false);
  }
}

/**
 * Verschickt die Fertig- bzw. Fehlermeldung. Schlägt der Versand fehl, wird
 * das protokolliert und sonst nichts – eine fertige Analyse darf nicht
 * daran scheitern, dass ein Mailserver gerade nicht erreichbar ist.
 */
async function benachrichtigeUeberErgebnis(analysisId: string, erfolgreich: boolean): Promise<void> {
  try {
    const analyse = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        email: true,
        results: { orderBy: { version: "desc" }, take: 1, select: { payload: true } },
      },
    });
    if (!analyse?.email) return;

    if (!erfolgreich) {
      await sendeAnalyseFehlgeschlagen(analyse.email, analysisId);
      return;
    }
    const report = analyse.results[0]?.payload as { objektdaten?: { adresseOderLage?: string } } | undefined;
    await sendeAnalyseFertig(analyse.email, analysisId, report?.objektdaten?.adresseOderLage ?? null);
  } catch (fehler) {
    console.error(`[HauskaufChecker] Benachrichtigung zu ${analysisId} fehlgeschlagen:`, fehler);
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
    // Die Rechenannahmen sind keine inhaltliche Erkenntnis der Besichtigung,
    // sondern Parameter des Laufs. Da der Agent den Report komplett neu
    // ausgibt und das Feld optional ist, würde es hier sonst verloren gehen –
    // der Report zeigte danach Zahlen ohne die zugehörigen Annahmen.
    const bisherigeAnnahmen = analysisReportSchema.safeParse(latestResult.payload);
    if (bisherigeAnnahmen.success && bisherigeAnnahmen.data.finanzAnnahmen) {
      updatedReport.finanzAnnahmen = bisherigeAnnahmen.data.finanzAnnahmen;
    }
    const pruefung = await withRetry(
      () =>
        sanierungsfahrplanPruefungAgent(
          updatedReport.objektdaten,
          updatedReport.hypothesen,
          updatedReport.sanierungsfahrplan,
        ),
      AGENT_RETRY_OPTIONS,
    );
    if (pruefung.aenderungen.length > 0) {
      console.warn(
        `[HauskaufChecker] Sanierungsfahrplan-Korrekturen bei Anreicherung ${analysisId}:`,
        pruefung.aenderungen,
      );
      updatedReport.sanierungsfahrplan = pruefung.sanierungsfahrplan;
    }
    validateReport(updatedReport);

    const gesamtPruefung = await withRetry(async () => {
      const result = await gesamtPruefungAgent(updatedReport);
      wendeGesamtPruefungAn(updatedReport, result); // wirft bei Inkonsistenz -> löst Retry aus
      return result;
    }, AGENT_RETRY_OPTIONS);
    if (gesamtPruefung.aenderungen.length > 0) {
      console.warn(
        `[HauskaufChecker] Gesamt-Report-Korrekturen bei Anreicherung ${analysisId}:`,
        gesamtPruefung.aenderungen,
      );
    }
    const finalReport = wendeGesamtPruefungAn(updatedReport, gesamtPruefung);

    await prisma.$transaction([
      prisma.analysisResult.create({
        data: {
          analysisId,
          version: latestResult.version + 1,
          payload: finalReport,
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
