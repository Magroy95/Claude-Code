import { NextResponse } from "next/server";
import { aktuellerNutzer, meldeAb } from "@/lib/auth/session";
import { fordereKontoLoeschungAn } from "@/lib/loeschung";
import { sendeLoeschbestaetigung } from "@/lib/mail";

export async function POST() {
  const nutzer = await aktuellerNutzer();
  if (!nutzer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  await fordereKontoLoeschungAn(nutzer.id);
  // Bestätigung bewusst sofort, nicht erst nach Ablauf der Nachfrist: Der
  // Nutzer soll schwarz auf weiß haben, was passiert und was aus
  // steuerrechtlichen Gründen bleibt.
  await sendeLoeschbestaetigung(nutzer.email);
  await meldeAb();
  return NextResponse.json({ ok: true });
}
