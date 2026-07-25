export const metadata = { title: "Impressum – HauskaufChecker" };

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 prose prose-sm dark:prose-invert">
      <h1>Impressum</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Platzhalter: Bitte vor Live-Betrieb mit den echten Anbieterangaben
        gemäß § 5 TMG befüllen (Name/Firma, ladungsfähige Anschrift,
        Kontaktdaten, ggf. Vertretungsberechtigte, Registereintrag,
        Umsatzsteuer-ID).
      </p>
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        [Name / Firma]
        <br />
        [Straße, Hausnummer]
        <br />
        [PLZ, Ort]
      </p>
      <h2>Kontakt</h2>
      <p>
        E-Mail: [kontakt@beispiel.de]
      </p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Name der verantwortlichen Person]</p>
    </div>
  );
}
