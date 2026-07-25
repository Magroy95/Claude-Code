import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { status: true, errorMessage: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(analysis);
}
