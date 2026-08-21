import { NextResponse } from "next/server";
import { fuehreLoeschungenDurch } from "@/lib/loeschung";

/**
 * Täglicher Löschlauf. Auf Vercel über vercel.json ausgelöst.
 *
 * Der Endpunkt ist durch ein Geheimnis geschützt: Ein offener Löschendpunkt
 * wäre zwar nicht direkt gefährlich (er hält sich an dieselben Fristen),
 * ließe sich aber zum Erzeugen von Last missbrauchen.
 */
export async function GET(request: Request) {
  const erwartet = process.env.CRON_SECRET;
  if (!erwartet) {
    return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 503 });
  }
  const mitgegeben = request.headers.get("authorization");
  if (mitgegeben !== `Bearer ${erwartet}`) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  }

  const bericht = await fuehreLoeschungenDurch();
  console.info("[HauskaufChecker] Löschlauf:", bericht);
  return NextResponse.json(bericht);
}
