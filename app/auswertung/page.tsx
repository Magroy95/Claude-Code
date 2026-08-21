import { notFound } from "next/navigation";
import { holeRueckmeldungen, holeTrichter } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auswertung", robots: { index: false } };

/**
 * Innenansicht auf den Ablauf. Kein Dashboard, sondern die sechs Zahlen,
 * die im Test tatsächlich eine Entscheidung ändern.
 *
 * Zugang über ein Geheimnis in der Adresse statt über ein Konto: Es gibt
 * (noch) keine Rollen, und ein Login-System für eine einzige Seite zu bauen
 * wäre unverhältnismäßig. Ohne gesetztes AUSWERTUNG_SECRET ist die Seite
 * nicht erreichbar.
 */
export default async function AuswertungSeite({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; tage?: string }>;
}) {
  const { key, tage } = await searchParams;
  const erwartet = process.env.AUSWERTUNG_SECRET;
  if (!erwartet || key !== erwartet) notFound();

  const zeitraum = Number(tage) > 0 ? Number(tage) : 30;
  const [trichter, rueckmeldung] = await Promise.all([
    holeTrichter(zeitraum),
    holeRueckmeldungen(zeitraum),
  ]);
  const gesamt = rueckmeldung.hilfreich + rueckmeldung.nicht;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold">Auswertung</h1>
      <p className="mt-1 text-sm opacity-70">Letzte {zeitraum} Tage</p>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-current/20 text-left">
            <th className="py-2 font-medium">Schritt</th>
            <th className="py-2 text-right font-medium">Anzahl</th>
            <th className="py-2 text-right font-medium">davon weiter</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {trichter.map((stufe) => (
            <tr key={stufe.name} className="border-b border-current/10">
              <td className="py-2">{stufe.name}</td>
              <td className="py-2 text-right">{stufe.anzahl}</td>
              <td className="py-2 text-right opacity-70">
                {stufe.anteilVorstufe === null ? "—" : `${stufe.anteilVorstufe} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-lg font-medium">War der Report hilfreich?</h2>
      {gesamt === 0 ? (
        <p className="mt-2 text-sm opacity-70">Noch keine Rückmeldungen.</p>
      ) : (
        <p className="mt-2 text-sm tabular-nums">
          {rueckmeldung.hilfreich} von {gesamt} sagen ja (
          {Math.round((rueckmeldung.hilfreich / gesamt) * 100)} %).
        </p>
      )}

      <p className="mt-10 text-xs leading-relaxed opacity-60">
        Gezählt werden ausschließlich Ereignisnamen und, wo vorhanden, die Analyse-ID. Keine
        IP-Adressen, keine Browserkennungen, keine Wiedererkennung über Besuche hinweg — deshalb
        braucht die Seite weder Einwilligung noch Cookie-Banner.
      </p>
    </main>
  );
}
