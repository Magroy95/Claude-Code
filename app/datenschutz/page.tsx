import { RechtsSeite } from "@/app/components/RechtsSeite";
import { ANBIETER } from "@/lib/site-config";
import {
  FRIST_EXPOSE_TAGE,
  FRIST_KONTO_LOESCHUNG_TAGE,
  FRIST_EREIGNISSE_TAGE,
  FRIST_MAGICLINK_TAGE,
  FRIST_TEASER_TAGE,
} from "@/lib/loeschung";
import { SESSION_GUELTIG_TAGE } from "@/lib/auth/session";

export const metadata = { title: "Datenschutzerklärung" };

/**
 * Die Fristen kommen aus lib/loeschung.ts, nicht aus dem Fließtext. Sonst
 * driften Zusage und Umsetzung auseinander, sobald jemand eine Frist im Code
 * ändert – und ein Datenschutzhinweis, der nicht stimmt, ist schlimmer als
 * keiner.
 */
export default function DatenschutzSeite() {
  return (
    <RechtsSeite titel="Datenschutzerklärung">
      <h2>Verantwortlicher</h2>
      <p>
        {ANBIETER.name}
        <br />
        {ANBIETER.strasse}
        <br />
        {ANBIETER.plzOrt}
        <br />
        E-Mail: {ANBIETER.email}
      </p>

      <h2>Worum es hier geht</h2>
      <p>
        Sie laden ein Exposé hoch, wir werten es aus und geben Ihnen eine Ersteinschätzung. Dabei
        verarbeiten wir nicht nur Ihre eigenen Angaben, sondern auch Daten aus dem Exposé — Adresse,
        Kaufpreis, Angaben zum Gebäude. Das sind teils Daten Dritter. Wir behandeln sie entsprechend
        zurückhaltend und löschen sie so früh wie möglich.
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <h3>Beim Start einer Analyse</h3>
      <ul>
        <li>Das hochgeladene Exposé (PDF oder Bild) mit allen darin enthaltenen Angaben</li>
        <li>Ihre E-Mail-Adresse</li>
        <li>Ihr angegebenes Eigenkapital und die Verkaufsart</li>
        <li>Ihre freiwilligen Zusatzangaben</li>
      </ul>
      <p>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO — die Verarbeitung ist zur Erbringung der von
        Ihnen angeforderten Leistung erforderlich.
      </p>

      <h3>Bei einem Konto</h3>
      <ul>
        <li>Ihre E-Mail-Adresse</li>
        <li>Anmeldezeitpunkte und eine Sitzungskennung (jeweils nur als Hashwert)</li>
        <li>Ihre Käufe: Betrag, Zeitpunkt, Zahlungsreferenz</li>
      </ul>

      <h3>Beim Aufruf der Seite</h3>
      <p>
        Unser Hoster verarbeitet technisch notwendige Zugriffsdaten, darunter Ihre IP-Adresse.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist der sichere
        Betrieb der Seite. Wir setzen kein Tracking und keine Analysewerkzeuge ein, deshalb finden
        Sie hier auch kein Cookie-Banner. Das einzige Cookie, das wir setzen, hält Ihre Anmeldung
        aufrecht; es ist technisch notwendig und {SESSION_GUELTIG_TAGE} Tage gültig.
      </p>
      <p>
        Für den Schutz vor Missbrauch zählen wir Anfragen je Absender. Ihre IP-Adresse wird dabei
        nur als nicht rückrechenbarer Hashwert gespeichert.
      </p>
      <p>
        Um zu erkennen, an welcher Stelle unser Angebot nicht funktioniert, zählen wir außerdem
        einzelne Schritte im Ablauf mit — etwa dass eine Analyse gestartet oder ein Report fertig
        wurde. Gespeichert wird ausschließlich der Name des Schritts und, wo vorhanden, die Kennung
        der betroffenen Analyse. <strong>Keine IP-Adresse, keine Browserkennung, keine
        Verweisquelle und keine Wiedererkennung über Besuche hinweg.</strong> Diese Zählung erfolgt
        auf unseren eigenen Systemen; ein externer Analysedienst ist nicht beteiligt.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
      </p>

      <h2>Empfänger</h2>
      <p>
        Wir geben Daten nur an Dienstleister weiter, die wir zur Erbringung der Leistung brauchen.
        Mit allen bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO.
      </p>
      <table>
        <thead>
          <tr>
            <th>Dienstleister</th>
            <th>Zweck</th>
            <th>Übermittelte Daten</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Anthropic PBC, USA</td>
            <td>Auswertung des Exposés</td>
            <td>Inhalt des Exposés, Ihre Zusatzangaben</td>
          </tr>
          <tr>
            <td>Netlify (EU-Region)</td>
            <td>Betrieb der Anwendung und Ablage der hochgeladenen Exposés</td>
            <td>Zugriffsdaten, hochgeladenes Exposé</td>
          </tr>
          <tr>
            <td>Datenbank-Hoster (EU)</td>
            <td>Speicherung</td>
            <td>alle oben genannten Daten</td>
          </tr>
          <tr>
            <td>Brevo (Sendinblue GmbH)</td>
            <td>Versand von Anmelde- und Benachrichtigungsmails</td>
            <td>E-Mail-Adresse, Mailinhalt</td>
          </tr>
          <tr>
            <td>Stripe Payments Europe Ltd., Irland</td>
            <td>Zahlungsabwicklung</td>
            <td>E-Mail-Adresse, Betrag, Zahlungsdaten</td>
          </tr>
        </tbody>
      </table>
      <p>
        Die Auswertung erfolgt bei Anthropic in den USA. Grundlage der Übermittlung sind die
        Standardvertragsklauseln der EU-Kommission nach Art. 46 Abs. 2 lit. c DSGVO. Ihre
        Zahlungsdaten geben Sie unmittelbar bei Stripe ein — wir sehen und speichern sie nicht.
      </p>

      <h2>Wie lange wir speichern</h2>
      <table>
        <thead>
          <tr>
            <th>Daten</th>
            <th>Frist</th>
            <th>Grund</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hochgeladenes Exposé</td>
            <td>{FRIST_EXPOSE_TAGE} Tage</td>
            <td>Wiederholungslauf und Rückfragen; danach nicht mehr erforderlich</td>
          </tr>
          <tr>
            <td>Report und ausgelesene Objektdaten</td>
            <td>solange Ihr Konto besteht</td>
            <td>Das ist die von Ihnen erworbene Leistung</td>
          </tr>
          <tr>
            <td>Analyse ohne Konto (kostenlose Kurzfassung)</td>
            <td>{FRIST_TEASER_TAGE} Tage</td>
            <td>Kein Vertragsverhältnis, keine längere Erforderlichkeit</td>
          </tr>
          <tr>
            <td>Anmeldelinks</td>
            <td>{FRIST_MAGICLINK_TAGE} Tage</td>
            <td>Fehlersuche</td>
          </tr>
          <tr>
            <td>Sitzungen</td>
            <td>bis zum Ablauf, längstens {SESSION_GUELTIG_TAGE} Tage</td>
            <td>Aufrechterhaltung der Anmeldung</td>
          </tr>
          <tr>
            <td>Konto nach Löschanforderung</td>
            <td>{FRIST_KONTO_LOESCHUNG_TAGE} Tage</td>
            <td>Nachfrist, falls die Löschung ein Versehen war</td>
          </tr>
          <tr>
            <td>Zählwerte zum Ablauf</td>
            <td>{FRIST_EREIGNISSE_TAGE} Tage</td>
            <td>Vergleich von Zeiträumen; danach ohne Aussagewert</td>
          </tr>
          <tr>
            <td>Rechnungs- und Zahlungsbelege</td>
            <td>8 Jahre</td>
            <td>Gesetzliche Aufbewahrungspflicht nach § 147 AO</td>
          </tr>
        </tbody>
      </table>
      <p>
        Löschen Sie Ihr Konto, werden Analysen und Exposés vollständig entfernt. Erhalten bleiben
        allein die Zahlungsbelege — sie enthalten Betrag, Datum und Ihre E-Mail-Adresse, aber keine
        Inhalte Ihrer Analysen. Diese Aufbewahrung ist gesetzlich vorgeschrieben und geht dem
        Löschanspruch vor (Art. 17 Abs. 3 lit. b DSGVO).
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
        (Art. 21).
      </p>
      <p>
        Auskunft und Löschung können Sie ohne Umweg selbst ausüben: In Ihrem Konto finden Sie einen
        Knopf, der Ihre Daten als Datei herunterlädt, und einen, der Ihr Konto löscht. Für alles
        Übrige schreiben Sie an {ANBIETER.email}.
      </p>
      <p>
        Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der für
        unseren Sitz zuständigen Behörde.
      </p>

      <h2>Keine automatisierte Entscheidung im Rechtssinne</h2>
      <p>
        Unsere Auswertung wird maschinell erstellt, entfaltet Ihnen gegenüber aber keine rechtliche
        Wirkung und beeinträchtigt Sie nicht in ähnlicher Weise im Sinne des Art. 22 DSGVO. Sie ist
        eine Orientierungshilfe zur Vorbereitung Ihrer eigenen Entscheidung — sie trifft keine
        Entscheidung für Sie und ersetzt kein Sachverständigengutachten.
      </p>
    </RechtsSeite>
  );
}
