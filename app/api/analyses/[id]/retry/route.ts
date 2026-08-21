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

  // Sofort auf PROCESSING setzen, damit die Statusabfrage direkt danach
  // konsistent ist; runAnalysisPipeline setzt denselben Status ohnehin noch
  // einmal, das ist unschädlich. Die Pipeline selbst setzt bei bereits
  // abgeschlossenen Schritten (siehe pipelineState) dort fort, statt von
  // vorn zu beginnen.
  await prisma.analysis.update({
    where: { id },
    data: { status: "PROCESSING", errorMessage: null },
  });
  await stosseAnalyseAn(id);

  return NextResponse.json({ ok: true });
}
