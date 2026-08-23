import Link from "next/link";
import { RechtsSeite } from "@/app/components/RechtsSeite";
import { ANBIETER, siteConfig } from "@/lib/site-config";
import { formatPreis, PAKET_LAUFZEIT_TAGE, PRODUKT } from "@/lib/auth/berechtigung";
import { LIMITS } from "@/lib/ratelimit";

export const metadata = { title: "Allgemeine Geschäftsbedingungen" };

/**
 * ACHTUNG – vor dem Livegang anwaltlich prüfen lassen.
 *
 * Der entscheidende Punkt in § 2: die Abgrenzung zum Sachverständigen-
 * gutachten. Wer eine Ersteinschätzung verkauft und dabei den Eindruck einer
 * Begutachtung erweckt, haftet anders – deshalb steht die Abgrenzung nicht
 * im Kleingedruckten, sondern an erster Stelle der Leistungsbeschreibung.
 */
export default function AgbSeite() {
  return (
    <RechtsSeite titel="Allgemeine Geschäftsbedingungen">
      <h2>§ 1 Geltungsbereich und Anbieter</h2>
      <p>
        Diese Bedingungen gelten für alle Verträge zwischen {ANBIETER.name}, {ANBIETER.strasse},{" "}
        {ANBIETER.plzOrt} (nachfolgend &bdquo;Anbieter&ldquo;) und Nutzerinnen und Nutzern des Dienstes{" "}
        {siteConfig.name} über {siteConfig.url}.
      </p>
      <p>
        Das Angebot richtet sich an Verbraucherinnen und Verbraucher im Sinne des § 13 BGB sowie an
        Unternehmer im Sinne des § 14 BGB.
      </p>

      <h2>§ 2 Gegenstand der Leistung</h2>
      <p>
        Der Anbieter erstellt auf Grundlage eines vom Nutzer hochgeladenen Exposés eine
        maschinell erzeugte Ersteinschätzung zu einer Immobilie. Sie umfasst insbesondere eine
        Einordnung des Kaufpreises, Hypothesen zu möglichen Substanz- und Kostenrisiken, eine
        Schätzung des Sanierungsstaus, eine überschlägige Finanzierungsrechnung sowie Prüffragen für
        die Besichtigung. Die vollständige Fassung dieser Ersteinschätzung wird auf der Website und
        in der Kommunikation des Anbieters auch als &bdquo;Besichtigungsmappe&ldquo; bezeichnet;
        gemeint ist dieselbe Leistung.
      </p>
      <p>
        <strong>
          Die Ersteinschätzung ist ausdrücklich kein Sachverständigengutachten, keine
          Wertermittlung im Sinne der ImmoWertV, keine Bau-, Rechts-, Steuer- oder Anlageberatung
          und keine Kaufempfehlung.
        </strong>{" "}
        Sie beruht ausschließlich auf den Angaben des vom Nutzer übermittelten Exposés und öffentlich
        zugänglichen Referenzdaten. Eine Besichtigung, Bauteilöffnung, Messung oder Einsicht in
        Bauakten findet nicht statt. Die Ergebnisse sind als Hypothesen formuliert, die vor Ort oder
        anhand von Unterlagen zu prüfen sind.
      </p>
      <p>
        Der Anbieter schuldet die sorgfältige Erstellung der Einschätzung, nicht jedoch einen
        bestimmten Erfolg, insbesondere nicht die Richtigkeit oder Vollständigkeit der im Exposé
        enthaltenen Angaben Dritter.
      </p>

      <h2>§ 3 Vertragsschluss</h2>
      <p>
        Die kostenlose Kurzfassung kann ohne Konto genutzt werden. Für den vollständigen Report ist
        ein Konto und ein kostenpflichtiger Kauf erforderlich. Mit dem Abschluss des Bezahlvorgangs
        gibt der Nutzer ein verbindliches Angebot ab; der Vertrag kommt mit der Bestätigung des
        Zahlungsdienstleisters zustande.
      </p>

      <h2>§ 4 Preise und Zahlung</h2>
      <ul>
        <li>
          {PRODUKT.SINGLE.bezeichnung}: {formatPreis(PRODUKT.SINGLE.betragCent)} — ein vollständiger
          Report für eine Immobilie
        </li>
        <li>
          {PRODUKT.PAKET_3M.bezeichnung}: {formatPreis(PRODUKT.PAKET_3M.betragCent)} — vollständige
          Reports für beliebig viele Immobilien innerhalb von {PAKET_LAUFZEIT_TAGE} Tagen ab Kauf
        </li>
      </ul>
      <p>
        Alle Preise sind Endpreise. Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine
        Umsatzsteuer erhoben und daher auch nicht ausgewiesen.
      </p>
      <p>
        Das Paket ist ein einmaliger Kauf mit fester Laufzeit und verlängert sich nicht
        automatisch. Es entsteht kein Abonnement und keine Kündigungsnotwendigkeit.
      </p>
      <p>
        Die Anzahl der Analysen innerhalb der Laufzeit ist nicht begrenzt. Zum Schutz vor
        automatisiertem Missbrauch gilt jedoch eine technische Obergrenze von{" "}
        {LIMITS.analyseStarten.anzahl} gestarteten Analysen pro Stunde je Nutzer.
      </p>
      <p>
        Die Zahlungsabwicklung erfolgt über Stripe. Der Anbieter erhebt und speichert keine
        Zahlungsdaten.
      </p>

      <h2>§ 5 Widerrufsrecht</h2>
      <p>
        Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Einzelheiten und das
        Muster-Widerrufsformular finden Sie in der{" "}
        <Link href="/widerruf">Widerrufsbelehrung</Link>. Das Widerrufsrecht erlischt vorzeitig,
        wenn der Nutzer dem sofortigen Beginn der Leistung ausdrücklich zugestimmt und seine
        Kenntnis vom Erlöschen bestätigt hat und der Report vollständig erstellt wurde.
      </p>

      <h2>§ 6 Pflichten des Nutzers</h2>
      <p>
        Der Nutzer sichert zu, dass er zur Übermittlung des Exposés berechtigt ist. Exposés können
        urheberrechtlich geschützt sein und personenbezogene Daten Dritter enthalten; die
        Übermittlung zum Zweck der eigenen Kaufprüfung ist davon regelmäßig gedeckt, eine
        darüber hinausgehende Nutzung nicht.
      </p>
      <p>
        Der Nutzer verpflichtet sich, den Dienst nicht automatisiert massenhaft abzurufen und keine
        Inhalte hochzuladen, die Rechte Dritter verletzen.
      </p>

      <h2>§ 7 Haftung</h2>
      <p>
        Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung
        von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz.
      </p>
      <p>
        Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer wesentlichen
        Vertragspflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst
        ermöglicht und auf deren Einhaltung der Nutzer regelmäßig vertrauen darf. In diesem Fall ist
        die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
      </p>
      <p>
        Der Anbieter haftet insbesondere nicht für Vermögensdispositionen, die der Nutzer auf
        Grundlage der Ersteinschätzung trifft. Die Einschätzung ersetzt weder eine Besichtigung noch
        ein Sachverständigengutachten; darauf wird im Report an mehreren Stellen ausdrücklich
        hingewiesen.
      </p>

      <h2>§ 8 Verfügbarkeit</h2>
      <p>
        Der Anbieter bemüht sich um einen störungsfreien Betrieb, schuldet aber keine bestimmte
        Verfügbarkeit. Kann eine bezahlte Analyse aus technischen Gründen nicht erstellt werden,
        wird der Kaufpreis erstattet oder die Berechtigung bleibt für eine erneute Analyse erhalten.
      </p>

      <h2>§ 9 Löschung und Beendigung</h2>
      <p>
        Der Nutzer kann sein Konto jederzeit im Konto-Bereich löschen. Zu Fristen und
        Aufbewahrungspflichten siehe die <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>§ 10 Streitbeilegung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit. Der
        Anbieter ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>§ 11 Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der
        Nutzer Verbraucher, bleiben zwingende Verbraucherschutzvorschriften seines Aufenthaltsstaats
        unberührt. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen
        unberührt.
      </p>
    </RechtsSeite>
  );
}
