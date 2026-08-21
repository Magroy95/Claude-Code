import Link from "next/link";
import { aktuellerNutzer } from "@/lib/auth/session";
import { berechtigungsUebersicht, formatPreis, PAKET_LAUFZEIT_TAGE, PRODUKT } from "@/lib/auth/berechtigung";
import { KaufKnoepfe } from "@/app/components/KaufKnoepfe";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preise",
  description: "Eine Einzelanalyse oder alle Häuser für drei Monate — ohne Abonnement.",
};

export default async function PreiseSeite({
  searchParams,
}: {
  searchParams: Promise<{ kauf?: string }>;
}) {
  const { kauf } = await searchParams;
  const nutzer = await aktuellerNutzer();
  const uebersicht = nutzer ? await berechtigungsUebersicht(nutzer.id) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold">Preise</h1>
      <p className="mt-3 text-sm leading-relaxed opacity-80">
        Die Kurzfassung mit Ampel und Objektdaten ist kostenlos und braucht kein Konto. Für den
        vollständigen Report zahlen Sie einmalig — es entsteht kein Abonnement.
      </p>

      {kauf === "abgebrochen" && (
        <p className="mt-6 rounded border border-current/25 p-3 text-sm">
          Der Bezahlvorgang wurde abgebrochen. Es wurde Ihnen nichts berechnet.
        </p>
      )}

      {uebersicht?.paketLaeuftBis && (
        <p className="mt-6 rounded border border-current/25 p-3 text-sm">
          Ihr Paket läuft noch bis{" "}
          {uebersicht.paketLaeuftBis.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          . Sie brauchen nichts weiter zu kaufen.
        </p>
      )}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <section className="rounded border border-current/15 p-5">
          <h2 className="font-medium">{PRODUKT.SINGLE.bezeichnung}</h2>
          <p className="mt-1 text-2xl font-semibold">{formatPreis(PRODUKT.SINGLE.betragCent)}</p>
          <p className="mt-2 text-sm opacity-80">{PRODUKT.SINGLE.beschreibung}</p>
          <ul className="mt-4 space-y-1.5 text-sm opacity-80">
            <li>Vollständiger Report für ein Haus</li>
            <li>PDF für den Besichtigungstermin</li>
            <li>Bleibt dauerhaft in Ihrem Konto</li>
          </ul>
        </section>

        <section className="rounded border-2 border-current/40 p-5">
          <h2 className="font-medium">{PRODUKT.PAKET_3M.bezeichnung}</h2>
          <p className="mt-1 text-2xl font-semibold">{formatPreis(PRODUKT.PAKET_3M.betragCent)}</p>
          <p className="mt-2 text-sm opacity-80">{PRODUKT.PAKET_3M.beschreibung}</p>
          <ul className="mt-4 space-y-1.5 text-sm opacity-80">
            <li>Beliebig viele Häuser, {PAKET_LAUFZEIT_TAGE} Tage lang</li>
            <li>Lohnt sich ab dem zweiten Haus</li>
            <li>Endet automatisch, keine Kündigung nötig</li>
          </ul>
        </section>
      </div>

      {nutzer ? (
        <KaufKnoepfe
          preisEinzel={formatPreis(PRODUKT.SINGLE.betragCent)}
          preisPaket={formatPreis(PRODUKT.PAKET_3M.betragCent)}
        />
      ) : (
        <p className="mt-8 text-sm">
          <Link href="/anmelden?weiter=%2Fpreise" className="underline">
            Anmelden
          </Link>{" "}
          — für den Kauf brauchen wir ein Konto, damit Sie Ihre Häuser später wiederfinden. Ohne
          Passwort, über einen Link per E-Mail.
        </p>
      )}

      <p className="mt-10 text-xs leading-relaxed opacity-70">
        Kein Ausweis von Umsatzsteuer gemäß § 19 UStG (Kleinunternehmerregelung). Mit dem Kauf
        stimmen Sie dem sofortigen Beginn der Leistung zu und nehmen zur Kenntnis, dass Ihr
        Widerrufsrecht mit vollständiger Erbringung erlischt — Einzelheiten in der{" "}
        <Link href="/widerruf" className="underline">
          Widerrufsbelehrung
        </Link>{" "}
        und den{" "}
        <Link href="/agb" className="underline">
          AGB
        </Link>
        .
      </p>
    </main>
  );
}
