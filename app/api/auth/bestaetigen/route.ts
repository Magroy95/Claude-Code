import { NextResponse } from "next/server";
import { loeseMagicLinkEin, SESSION_COOKIE, SESSION_GUELTIG_TAGE } from "@/lib/auth/session";
import { EREIGNIS, halteFest } from "@/lib/ereignisse";

/**
 * Ziel des Anmeldelinks.
 *
 * Bewusst ein Route Handler und keine Seite: Cookies lassen sich in einer
 * Server-Komponente nicht setzen (Next.js erlaubt das nur in Server Actions
 * und Route Handlern). Ein erster Versuch als Seite scheiterte genau daran –
 * und verbrauchte dabei das Token, ohne anzumelden.
 */
/** Nur seiteninterne Ziele zulassen – sonst wird der Anmeldelink zur
 *  Weiterleitung auf fremde Seiten missbraucht (Open Redirect). */
function sicheresZiel(weiter: string | null): string {
  if (!weiter) return "/konto";
  if (!weiter.startsWith("/") || weiter.startsWith("//")) return "/konto";
  return weiter;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const weiter = new URL(request.url).searchParams.get("weiter");
  const ergebnis = token ? await loeseMagicLinkEin(token) : null;

  // Ziel relativ zum aufrufenden Host, nicht zur konfigurierten
  // Produktionsadresse – sonst landet man aus der Entwicklungsumgebung
  // heraus auf der Live-Domain.
  if (!ergebnis) {
    return NextResponse.redirect(new URL("/anmelden?fehler=link", request.url));
  }

  await halteFest(EREIGNIS.ANMELDUNG_ABGESCHLOSSEN);
  const antwort = NextResponse.redirect(new URL(sicheresZiel(weiter), request.url));
  antwort.cookies.set(SESSION_COOKIE, ergebnis.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_GUELTIG_TAGE * 24 * 60 * 60,
  });
  return antwort;
}
