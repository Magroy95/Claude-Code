import { RechtsSeite } from "@/app/components/RechtsSeite";
import { ANBIETER } from "@/lib/site-config";

export const metadata = { title: "Impressum" };

export default function ImpressumSeite() {
  return (
    <RechtsSeite titel="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {ANBIETER.name}
        <br />
        {ANBIETER.strasse}
        <br />
        {ANBIETER.plzOrt}
      </p>

      <h2>Kontakt</h2>
      <p>E-Mail: {ANBIETER.email}</p>

      <h2>Umsatzsteuer</h2>
      <p>
        Gemäß § 19 UStG wird keine Umsatzsteuer erhoben und daher auf Rechnungen nicht ausgewiesen
        (Kleinunternehmerregelung).
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        {ANBIETER.verantwortlich}
        <br />
        {ANBIETER.strasse}
        <br />
        {ANBIETER.plzOrt}
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </RechtsSeite>
  );
}
