import Link from "next/link";
import { redirect } from "next/navigation";
import { loeseMagicLinkEin, setzeSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Ziel des Anmeldelinks. Löst das Token ein und leitet ins Konto weiter.
 *
 * Bewusst eine Server-Komponente mit Weiterleitung statt einer API-Route:
 * Der Nutzer klickt in seinem Mailprogramm und landet direkt auf einer
 * Seite – ohne Zwischenschritt, ohne JavaScript-Anforderung.
 */
export default async function Bestaetigen({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    const ergebnis = await loeseMagicLinkEin(token);
    if (ergebnis) {
      await setzeSessionCookie(ergebnis.sessionToken);
      redirect("/konto");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Dieser Anmeldelink gilt nicht mehr</h1>
      <p className="mt-4 text-sm leading-relaxed opacity-80">
        Anmeldelinks sind 20 Minuten gültig und können nur einmal verwendet werden. Das schützt Ihr
        Konto, wenn die E-Mail einmal in falsche Hände gerät.
      </p>
      <p className="mt-6">
        <Link href="/anmelden" className="underline">
          Neuen Anmeldelink anfordern
        </Link>
      </p>
    </main>
  );
}
