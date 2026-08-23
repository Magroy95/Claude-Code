import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PIPELINE_SCHRITTE } from "@/lib/dauer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { status: true, errorMessage: true, pipelineState: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }

  // Der Fortschritt wird nicht simuliert, sondern aus den tatsächlich
  // gespeicherten Zwischenergebnissen abgeleitet. Ein Balken, der einfach
  // losläuft, ist eine Behauptung; das hier ist eine Auskunft.
  const checkpoint = (analysis.pipelineState ?? {}) as Record<string, unknown>;
  const fertigeSchritte = PIPELINE_SCHRITTE.filter((s) => checkpoint[s.key] != null).length;

  return NextResponse.json({
    status: analysis.status,
    errorMessage: analysis.errorMessage,
    fertigeSchritte,
    gesamtSchritte: PIPELINE_SCHRITTE.length,
  });
}
