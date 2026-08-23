import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { renderPdfFromUrl } from "@/lib/pdf/render";
import { aktuellerNutzer } from "@/lib/auth/session";
import { erzeugePdfToken } from "@/lib/pdf/token";
import { BEISPIEL_ANALYSE_ID } from "@/lib/beispiel";

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

  // Der öffentliche Beispielreport wird anders ausgeliefert als ein gekaufter.
  //
  // "ansehen" heißt ansehen: inline statt Download, sonst landet der erste
  // Eindruck als Datei im Ordner "Downloads" statt vor Augen. Und er darf
  // zwischengespeichert werden – er ändert sich nie, während jeder Aufruf
  // sonst einen Chromium startet. Auf einer Startseite, die auf diesen Knopf
  // zeigt, wäre das pro Klick ein Kaltstart.
  //
  // Für gekaufte Reports gilt beides ausdrücklich nicht: Sie gehören einem
  // Nutzer, dürfen nirgendwo zwischengespeichert werden und sollen als Datei
  // zum Termin mitgehen.
  const istBeispiel = id === BEISPIEL_ANALYSE_ID;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": istBeispiel
        ? `inline; filename="HauskaufChecker_Beispielreport.pdf"`
        : `attachment; filename="HauskaufChecker_${id}.pdf"`,
      "Cache-Control": istBeispiel
        ? "public, max-age=3600, s-maxage=86400"
        : "private, no-store",
    },
  });
}
