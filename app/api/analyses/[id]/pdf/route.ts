import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { renderPdfFromUrl } from "@/lib/pdf/render";
import { aktuellerNutzer } from "@/lib/auth/session";
import { erzeugePdfToken } from "@/lib/pdf/token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const version = url.searchParams.get("v");

  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis || analysis.status !== "DONE") {
    return NextResponse.json({ error: "Analyse nicht verfügbar" }, { status: 404 });
  }

  // Das PDF enthält den vollständigen Report – es ist damit dem
  // kostenpflichtigen Teil zuzuordnen und braucht denselben Schutz wie die
  // Seite selbst.
  const nutzer = await aktuellerNutzer();
  if (!analysis.freigeschaltet) {
    return NextResponse.json({ error: "Dieser Report ist nicht freigeschaltet." }, { status: 402 });
  }
  if (analysis.userId !== null && analysis.userId !== nutzer?.id) {
    return NextResponse.json({ error: "Analyse nicht verfügbar" }, { status: 404 });
  }

  // Der druckende Browser hat keine Sitzung; er weist sich mit einem
  // kurzlebigen Token aus (siehe lib/pdf/token.ts).
  const token = erzeugePdfToken(id);
  if (!token) {
    console.error("[HauskaufChecker] PDF_TOKEN_SECRET ist nicht gesetzt – PDF-Export nicht möglich.");
    return NextResponse.json(
      { error: "Der PDF-Export ist derzeit nicht verfügbar." },
      { status: 503 },
    );
  }

  const ziel = new URL(`/analyse/${id}`, url.origin);
  if (version) ziel.searchParams.set("v", version);
  ziel.searchParams.set("pdf", token);
  const pdf = await renderPdfFromUrl(ziel.toString());

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="HauskaufChecker_${id}.pdf"`,
    },
  });
}
