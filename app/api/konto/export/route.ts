import { NextResponse } from "next/server";
import { aktuellerNutzer } from "@/lib/auth/session";
import { exportiereNutzerdaten } from "@/lib/loeschung";

/** Datenauskunft nach Art. 15 DSGVO als JSON-Download. */
export async function GET() {
  const nutzer = await aktuellerNutzer();
  if (!nutzer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const daten = await exportiereNutzerdaten(nutzer.id);
  const datum = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(daten, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="hauskaufchecker-daten-${datum}.json"`,
    },
  });
}
