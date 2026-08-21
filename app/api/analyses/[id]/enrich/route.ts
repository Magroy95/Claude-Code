import { NextResponse } from "next/server";
import { createEnrichmentFromForm } from "@/lib/analysis/enrich";

/**
 * Muss zusammen mit AKTUALISIERUNG_FREIGESCHALTET in
 * app/analyse/[id]/anreichern/page.tsx umgestellt werden. Die gesperrte
 * Seite allein genügt nicht – dieser Endpunkt löst eine vollständige
 * Pipeline aus und kostet damit Geld.
 */
const AKTUALISIERUNG_FREIGESCHALTET = false;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!AKTUALISIERUNG_FREIGESCHALTET) {
    return NextResponse.json(
      { error: "Die Aktualisierung nach der Besichtigung ist derzeit nicht verfügbar." },
      { status: 404 },
    );
  }

  const { id } = await params;
  const formData = await request.formData();
  const result = await createEnrichmentFromForm(id, formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
