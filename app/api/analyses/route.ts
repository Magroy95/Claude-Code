import { NextResponse } from "next/server";
import { createAnalysisFromForm } from "@/lib/analysis/create";
import { aktuellerNutzer } from "@/lib/auth/session";
import { ermittleIp, pruefeLimit, warteText } from "@/lib/ratelimit";

export async function POST(request: Request) {
  // Jede Analyse löst sieben Modellaufrufe aus und kostet uns knapp einen
  // Euro. Ohne Bremse wäre dieser Endpunkt eine offene Rechnung.
  const limit = await pruefeLimit("analyseStarten", ermittleIp(request));
  if (!limit.erlaubt) {
    return NextResponse.json(
      {
        error:
          `Sie haben in kurzer Zeit mehrere Analysen gestartet. ` +
          `Bitte versuchen Sie es in ${warteText(limit.erneutInSekunden)} erneut.`,
      },
      { status: 429 },
    );
  }

  const nutzer = await aktuellerNutzer();
  const formData = await request.formData();
  const result = await createAnalysisFromForm(formData, nutzer?.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
