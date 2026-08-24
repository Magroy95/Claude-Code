import Link from "next/link";
import { aktuellerNutzer } from "@/lib/auth/session";
import {
  berechtigungsUebersicht,
  formatPreis,
  GUTACHTEN_VERGLEICH_EUR,
  PAKET_LAUFZEIT_TAGE,
  PRODUKT,
} from "@/lib/auth/berechtigung";
import { LIMITS } from "@/lib/ratelimit";
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
    <div className="lp-bahn lp-seite" style={{ maxWidth: "980px" }}>
      <div className="lp-kopfzeile">
        <p className="lp-augenbraue">Preise</p>
        <h1 className="lp-h2">Was es kostet</h1>
        <p className="lp-text">
          Die Kurzfassung mit Ampel, Kurzfazit, Kennzahlen und Objektdaten ist kostenlos und braucht
          kein Konto. Für die vollständige Besichtigungsmappe zahlen Sie einmalig — es entsteht kein
          Abonnement.
        </p>
        {/* Der Preis steht nie allein. Neben einer sechsstelligen Entscheidung
            ist ein einstelliger Betrag keine Ausgabe, sondern eine Fußnote –
            aber das sieht man nur, wenn beides nebeneinander steht. */}
        <p className="lp-text">
          Für die Begleitung durch einen Bausachverständigen habe ich damals rund{" "}
          {GUTACHTEN_VERGLEICH_EUR} Euro bezahlt — für ein einziges Haus, und erst, als die
          Entscheidung schon fast gefallen war. Was hier steht, ist das, was davor kommt.
        </p>
      </div>

      {kauf === "abgebrochen" && (
        <p className="lp-hinweis">
          Der Bezahlvorgang wurde abgebrochen. Es wurde Ihnen nichts berechnet.
        </p>
      )}

      {uebersicht?.paketLaeuftBis && (
        <p className="lp-hinweis">
          Ihr Paket läuft noch bis{" "}
          {uebersicht.paketLaeuftBis.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          . Sie brauchen nichts weiter zu kaufen.
        </p>
      )}

      <div className="lp-preise" style={{ marginTop: "34px" }}>
        <section className="lp-preiskarte">
          <span className="name">{PRODUKT.SINGLE.bezeichnung}</span>
          <span className="betrag">
            {formatPreis(PRODUKT.SINGLE.betragCent)} <small>einmalig</small>
          </span>
          <p className="wofuer">{PRODUKT.SINGLE.beschreibung}.</p>
          <ul>
            <li>Die vollständige Besichtigungsmappe für ein Haus</li>
            <li>PDF für den Besichtigungstermin</li>
            <li>Bleibt dauerhaft in Ihrem Konto</li>
          </ul>
        </section>

        <section className="lp-preiskarte hervor">
          <span className="name">{PRODUKT.PAKET_3M.bezeichnung}</span>
          <span className="betrag">
            {formatPreis(PRODUKT.PAKET_3M.betragCent)} <small>{PAKET_LAUFZEIT_TAGE} Tage</small>
          </span>
          {/* Zweite, leisere Ansprache neben dem Jäger-Bild: Wer gerade jedes
              Wochenende Termine fährt, erkennt sich darin eher wieder als in
              einer Jagd. Das Produkt heißt trotzdem so, wie es heißt. */}
          <p className="wofuer">
            {PRODUKT.PAKET_3M.beschreibung}. Wenn Sie gerade jedes Wochenende unterwegs sind, ist
            das der günstigere Weg.
          </p>
          <ul>
            <li>Beliebig viele Häuser, {PAKET_LAUFZEIT_TAGE} Tage lang</li>
            <li>Lohnt sich ab dem zweiten Haus</li>
            <li>Endet automatisch, keine Kündigung nötig</li>
          </ul>
        </section>
      </div>

      {/* Einwandbehandlung neben dem Kaufknopf statt in den FAQ: Wer hier
          zögert, scrollt nicht mehr nach unten, um sich beruhigen zu lassen. */}
      <ul className="lp-einwaende" style={{ marginTop: "22px" }}>
        <li>Kein Abonnement</li>
        <li>Sie sehen die Kurzfassung, bevor Sie zahlen</li>
        <li>Anmeldung ohne Passwort</li>
      </ul>

      {nutzer ? (
        <KaufKnoepfe
          preisEinzel={formatPreis(PRODUKT.SINGLE.betragCent)}
          preisPaket={formatPreis(PRODUKT.PAKET_3M.betragCent)}
        />
      ) : (
        <p className="lp-text" style={{ marginTop: "30px", fontSize: "15.5px" }}>
          <Link href="/anmelden?weiter=%2Fpreise" className="lp-textlink">
            Anmelden
          </Link>{" "}
          — für den Kauf brauchen wir ein Konto, damit Sie Ihre Häuser später wiederfinden. Ohne
          Passwort, über einen Link per E-Mail.
        </p>
      )}

      {/* Die Drosselung gehört ins Kleingedruckte, nicht auf die Preiskarte:
          Auf der Karte liest sie sich als Einschränkung des Versprechens,
          hier als das, was sie ist – ein Schutz gegen Automaten. */}
      <p className="lp-klein" style={{ marginTop: "46px", maxWidth: "70ch" }}>
        {PRODUKT.PAKET_3M.bezeichnung} kennt keine Gesamtzahl an Analysen, aber eine technische
        Bremse von {LIMITS.analyseStarten.anzahl} Analysen pro Stunde. Sie verhindert
        automatisierten Missbrauch und fällt bei der Haussuche nicht ins Gewicht.
      </p>

      <p className="lp-klein" style={{ marginTop: "14px", maxWidth: "70ch" }}>
        Kein Ausweis von Umsatzsteuer gemäß § 19 UStG (Kleinunternehmerregelung). Mit dem Kauf
        stimmen Sie dem sofortigen Beginn der Leistung zu und nehmen zur Kenntnis, dass Ihr
        Widerrufsrecht mit vollständiger Erbringung erlischt — Einzelheiten in der{" "}
        <Link href="/widerruf" className="lp-textlink" style={{ fontSize: "inherit" }}>
          Widerrufsbelehrung
        </Link>{" "}
        und den{" "}
        <Link href="/agb" className="lp-textlink" style={{ fontSize: "inherit" }}>
          AGB
        </Link>
        .
      </p>
    </div>
  );
}
