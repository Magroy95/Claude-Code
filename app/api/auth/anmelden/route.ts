import { NextResponse } from "next/server";
import { erstelleMagicLink, normalisiereEmail } from "@/lib/auth/session";
import { sendeAnmeldelink } from "@/lib/mail";
import { ermittleIp, pruefeLimit, warteText } from "@/lib/ratelimit";
import { siteConfig } from "@/lib/site-config";

// Grobe Formprüfung. Eine strengere Validierung bringt nichts – ob die
// Adresse existiert, zeigt erst die Zustellung.
const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailRoh = String(formData.get("email") ?? "");
  const email = normalisiereEmail(emailRoh);

  if (!EMAIL_MUSTER.test(email)) {
    return NextResponse.json({ error: "Bitte geben Sie eine gültige E-Mail-Adresse an." }, { status: 400 });
  }

  // Zwei Bremsen: eine je Adresse, damit ein fremdes Postfach nicht
  // zugemüllt werden kann, und eine je IP gegen breit gestreute Versuche.
  for (const kennung of [email, ermittleIp(request)]) {
    const limit = await pruefeLimit("anmeldelink", kennung);
    if (!limit.erlaubt) {
      return NextResponse.json(
        { error: `Zu viele Anmeldeversuche. Bitte versuchen Sie es in ${warteText(limit.erneutInSekunden)} erneut.` },
        { status: 429 },
      );
    }
  }

  try {
    const { token } = await erstelleMagicLink(email);
    const weiter = formData.get("weiter");
    const zielAnhang =
      typeof weiter === "string" && weiter.startsWith("/") && !weiter.startsWith("//")
        ? `&weiter=${encodeURIComponent(weiter)}`
        : "";
    const link = `${siteConfig.url}/api/auth/bestaetigen?token=${encodeURIComponent(token)}${zielAnhang}`;
    await sendeAnmeldelink(email, link);
  } catch (fehler) {
    console.error("[HauskaufChecker] Anmeldelink fehlgeschlagen:", fehler);
    // Bewusst dieselbe Antwort wie im Erfolgsfall: Ob zu einer Adresse ein
    // Konto existiert oder gelöscht wurde, ist eine Information, die Fremde
    // nichts angeht.
  }

  return NextResponse.json({
    ok: true,
    hinweis:
      "Wenn zu dieser Adresse ein Konto besteht oder angelegt werden kann, ist der Anmeldelink unterwegs.",
  });
}
