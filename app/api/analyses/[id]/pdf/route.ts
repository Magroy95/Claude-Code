import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { renderPdfFromUrl } from "@/lib/pdf/render";

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

  const pageUrl = new URL(`/analyse/${id}${version ? `?v=${version}` : ""}`, url.origin);
  const pdf = await renderPdfFromUrl(pageUrl.toString());

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="HauskaufChecker_${id}.pdf"`,
    },
  });
}
