import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stosseAnalyseAn } from "@/lib/analysis/anstossen";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }
  if (analysis.status !== "ERROR") {
    return NextResponse.json(
      { error: "Nur fehlgeschlagene Analysen können erneut gestartet werden." },
      { status: 400 },
    );
  }

  // Den Status hier NICHT auf PROCESSING setzen.
  //
  // Die Pipeline beansprucht den Lauf selbst mit einem atomaren updateMany,
  // das nur von PENDING oder ERROR aus greift (siehe runAnalysisPipeline).
  // Wer hier vorab auf PROCESSING dreht, nimmt ihr genau diese Bedingung
  // weg: Der Anspruch scheitert, der Lauf wird als Doppelaufruf verworfen –
  // und die Analyse bleibt für immer in PROCESSING stehen, ohne dass
  // irgendetwas rechnet.
  //
  // Die Fehlermeldung wird trotzdem gelöscht: Sie gehört zum letzten
  // Versuch, nicht zum nächsten. Den Status auf PROCESSING setzt die
  // Pipeline eine Sekundenbruchteil später selbst; bis dahin zeigt die
  // Oberfläche kurz weiter den alten Stand, was ehrlicher ist als eine
  // Verarbeitung, die vielleicht gar nicht läuft.
  await prisma.analysis.update({ where: { id }, data: { errorMessage: null } });
  await stosseAnalyseAn(id);

  return NextResponse.json({ ok: true });
}
