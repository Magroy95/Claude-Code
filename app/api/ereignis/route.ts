import { NextResponse } from "next/server";
import { halteFest, istErlaubtesEreignis } from "@/lib/ereignisse";
import { ermittleIp, pruefeLimit } from "@/lib/ratelimit";

/**
 * Ereignisse, die nur der Browser kennt – etwa dass die Bezahlschranke
 * tatsächlich zu sehen war.
 *
 * Nur Namen aus der festen Liste werden angenommen. Ein offener Endpunkt,
 * der beliebige Zeichenketten in die Datenbank schreibt, wäre eine
 * Einladung.
 */
export async function POST(request: Request) {
  const limit = await pruefeLimit("ereignis", ermittleIp(request));
  if (!limit.erlaubt) {
    // Still ablehnen: Eine Messung ist es nicht wert, dem Aufrufer etwas zu
    // erklären.
    return NextResponse.json({ ok: true });
  }

  const daten = await request.json().catch(() => null);
  const name = typeof daten?.name === "string" ? daten.name : "";
  if (!istErlaubtesEreignis(name)) {
    return NextResponse.json({ error: "Unbekanntes Ereignis" }, { status: 400 });
  }

  const analysisId = typeof daten?.analysisId === "string" ? daten.analysisId : undefined;
  await halteFest(name, analysisId);
  return NextResponse.json({ ok: true });
}
