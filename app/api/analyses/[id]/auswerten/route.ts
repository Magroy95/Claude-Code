import { NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analysis/pipeline";
import { pipelineAufrufErlaubt } from "@/lib/analysis/anstossen";

/**
 * Die eigentliche Auswertung – als Hintergrundroute.
 *
 * Netlify antwortet auf eine so deklarierte Route sofort mit 202 und lässt
 * sie danach bis zu 15 Minuten weiterlaufen. Genau das braucht eine
 * Pipeline aus sieben Modellaufrufen, die zusammen fünf bis zehn Minuten
 * dauert.
 *
 * Der Endpunkt ist nicht öffentlich: Ohne das gemeinsame Geheimnis ließen
 * sich fremde Analysen beliebig neu starten, und jeder Start kostet rund
 * einen Euro.
 */
export const config = { type: "experimental-background" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!pipelineAufrufErlaubt(request)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  }

  const { id } = await params;
  // Bewusst mit await: Die Hintergrundroute darf und soll so lange laufen.
  // Fehler hält die Pipeline selbst als Analysis.status = ERROR fest.
  await runAnalysisPipeline(id);
  return NextResponse.json({ ok: true });
}
