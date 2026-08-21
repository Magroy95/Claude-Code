// Anstoßen der Analyse-Pipeline.
//
// Bisher stand in create.ts schlicht `void runAnalysisPipeline(id)` – die
// Auswertung lief also im selben Prozess weiter, nachdem die Antwort schon
// draußen war. Lokal funktioniert das; auf Netlify nicht: Sobald eine
// Funktion geantwortet hat, wird sie eingefroren. Die Pipeline braucht fünf
// bis zehn Minuten und käme dort nie über den ersten Agenten hinaus – die
// Analyse bliebe für immer auf PROCESSING stehen.
//
// Netlify löst das mit Background-Routen: Eine Route, die
// `type: "experimental-background"` deklariert, antwortet sofort mit 202 und
// läuft danach bis zu 15 Minuten weiter. Das passt zur Pipeline, ohne dass
// eine Warteschlange mit eigenem Dienst nötig wird.
//
// Der Upload ruft diese Route deshalb per HTTP auf, statt die Pipeline
// direkt zu starten. Lokal ist das ein Aufruf an den eigenen Entwicklungs-
// server und verhält sich genauso – ein Sonderweg für die Entwicklung wäre
// gerade der Weg, auf dem sich Fehler bis in die Produktion verstecken.

import { runAnalysisPipeline } from "./pipeline";

/**
 * Öffentliche Adresse der laufenden Instanz. Netlify setzt URL selbst;
 * DEPLOY_PRIME_URL zeigt bei Vorschau-Deployments auf die jeweilige
 * Zweig-Adresse.
 */
function eigeneAdresse(): string {
  return (
    process.env.DEPLOY_PRIME_URL ??
    process.env.URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

/**
 * Gemeinsames Geheimnis zwischen Upload und Auswertungsroute. Ohne das wäre
 * der Endpunkt ein offener Weg, fremde Analysen neu zu starten und damit
 * Kosten zu erzeugen.
 */
export function pipelineGeheimnis(): string | null {
  return process.env.PIPELINE_SECRET ?? null;
}

export function pipelineAufrufErlaubt(request: Request): boolean {
  const erwartet = pipelineGeheimnis();
  if (!erwartet) return false;
  return request.headers.get("x-pipeline-secret") === erwartet;
}

/**
 * Stößt die Auswertung an und kehrt sofort zurück.
 *
 * Fällt der Aufruf aus – kein Geheimnis gesetzt, Netz nicht erreichbar –,
 * läuft die Pipeline ersatzweise im laufenden Prozess. Das rettet die
 * Entwicklungsumgebung und einen Betrieb auf einem eigenen Server; auf
 * Netlify wäre es wirkungslos, weshalb der Fehlschlag zusätzlich
 * protokolliert wird.
 */
export async function stosseAnalyseAn(analysisId: string): Promise<void> {
  const geheimnis = pipelineGeheimnis();
  if (!geheimnis) {
    console.warn(
      "[HauskaufChecker] PIPELINE_SECRET ist nicht gesetzt – Auswertung läuft im " +
        "aktuellen Prozess. Auf Netlify wird sie dadurch nicht fertig.",
    );
    void runAnalysisPipeline(analysisId);
    return;
  }

  // Bewusst ohne await auf die Antwort.
  //
  // Auf Netlify kommt sofort ein 202 zurück; lokal antwortet die Route erst,
  // wenn die Pipeline durch ist. Auf diese Antwort zu warten – oder sie mit
  // einer Frist abzubrechen – führte im Test genau in die Irre: Die Frist
  // lief ab, der Ersatzweg startete eine zweite Pipeline auf demselben
  // Datensatz, und beide überschrieben sich gegenseitig. Ob der Aufruf
  // ankam, entscheidet deshalb allein, ob die Verbindung zustande kam.
  //
  // Der Doppellauf ist zusätzlich in runAnalysisPipeline abgesichert: Dort
  // wird der Lauf atomar beansprucht, ein zweiter Anlauf verwirft sich
  // selbst.
  fetch(`${eigeneAdresse()}/api/analyses/${analysisId}/auswerten`, {
    method: "POST",
    headers: { "x-pipeline-secret": geheimnis },
  }).catch((fehler) => {
    console.error(
      `[HauskaufChecker] Auswertung für ${analysisId} konnte nicht angestoßen werden:`,
      fehler,
    );
  });
}
