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
    <div className="lp-bahn mittel lp-seite">
      <p className="lp-augenbraue">Letzte {zeitraum} Tage</p>
      <h1 className="lp-h2" style={{ marginBottom: "34px" }}>
        Auswertung
      </h1>

      <table className="lp-tabelle">
        <thead>
          <tr>
            <th>Schritt</th>
            <th className="zahl">Anzahl</th>
            <th className="zahl">davon weiter</th>
          </tr>
        </thead>
        <tbody>
          {trichter.map((stufe) => (
            <tr key={stufe.name}>
              <td>{stufe.name}</td>
              <td className="zahl">{stufe.anzahl}</td>
              <td className="zahl leise">
                {stufe.anteilVorstufe === null ? "—" : `${stufe.anteilVorstufe} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="lp-h3" style={{ marginTop: "42px" }}>
        War der Report hilfreich?
      </h2>
      {gesamt === 0 ? (
        <p className="lp-text">Noch keine Rückmeldungen.</p>
      ) : (
        <p className="lp-text" style={{ fontVariantNumeric: "tabular-nums" }}>
          {rueckmeldung.hilfreich} von {gesamt} sagen ja (
          {Math.round((rueckmeldung.hilfreich / gesamt) * 100)} %).
        </p>
      )}

      <p className="lp-klein" style={{ marginTop: "44px", maxWidth: "70ch" }}>
        Gezählt werden ausschließlich Ereignisnamen und, wo vorhanden, die Analyse-ID. Keine
        IP-Adressen, keine Browserkennungen, keine Wiedererkennung über Besuche hinweg — deshalb
        braucht die Seite weder Einwilligung noch Cookie-Banner.
      </p>
    </div>
  );
}
