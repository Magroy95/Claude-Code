import { NextResponse } from "next/server";
import { aktuellerNutzer } from "@/lib/auth/session";
import { starteKauf, stripeKonfiguriert } from "@/lib/zahlung/stripe";
import { ermittleIp, pruefeLimit, warteText } from "@/lib/ratelimit";
import { EREIGNIS, halteFest } from "@/lib/ereignisse";

export async function POST(request: Request) {
  const nutzer = await aktuellerNutzer();
  if (!nutzer) {
    return NextResponse.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });
  }
  if (!stripeKonfiguriert()) {
    return NextResponse.json(
      { error: "Die Zahlung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut." },
      { status: 503 },
    );
  }

  const limit = await pruefeLimit("kaufStarten", ermittleIp(request));
  if (!limit.erlaubt) {
    return NextResponse.json(
      { error: `Zu viele Versuche. Bitte in ${warteText(limit.erneutInSekunden)} erneut probieren.` },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const kind = String(formData.get("produkt") ?? "");
  if (kind !== "SINGLE" && kind !== "PAKET_3M") {
    return NextResponse.json({ error: "Unbekanntes Produkt" }, { status: 400 });
  }
  const analysisId = formData.get("analysisId");

  try {
    const { url } = await starteKauf({
      userId: nutzer.id,
      email: nutzer.email,
      kind,
      analysisId: typeof analysisId === "string" && analysisId ? analysisId : undefined,
    });
    await halteFest(
      EREIGNIS.KAUF_GESTARTET,
      typeof analysisId === "string" && analysisId ? analysisId : undefined,
    );
    return NextResponse.json({ url });
  } catch (fehler) {
    console.error("[HauskaufChecker] Kauf konnte nicht gestartet werden:", fehler);
    return NextResponse.json(
      { error: "Der Bezahlvorgang konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}
