export const metadata = { title: "Datenschutz – HauskaufChecker" };

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 prose prose-sm dark:prose-invert">
      <h1>Datenschutzerklärung</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Hinweis: Dies ist ein solider Textentwurf für den Prototyp-Betrieb.
        Vor einem echten Live-Betrieb sollte dieser Text von einer
        rechtskundigen Person geprüft werden.
      </p>

      <h2>1. Welche Daten wir verarbeiten</h2>
      <p>
        Wenn du eine Analyse startest, verarbeiten wir folgende Daten: deine
        E-Mail-Adresse, das von dir hochgeladene Exposé, Angaben zu
        Eigenkapital und Verkaufsart, sowie von dir eingegebene Freitexte zu
        Besonderheiten oder Mängeln. Bei einer Anreicherung nach der
        Besichtigung verarbeiten wir zusätzlich die dort eingegebenen Texte,
        Fotos und Dokumente.
      </p>

      <h2>2. Zweck der Verarbeitung</h2>
      <p>
        Diese Daten werden ausschließlich zur Erstellung deiner unverbindlichen
        Immobilien-Ersteinschätzung genutzt, inklusive der Weiterverarbeitung
        durch eine KI-Analyse (Anthropic, siehe Punkt 3) sowie der Erzeugung
        des PDF-Reports und der Bereitstellung über deine Analyse-ID.
      </p>

      <h2>3. Auftragsverarbeitung durch Anthropic</h2>
      <p>
        Zur inhaltlichen Analyse deines Exposés und deiner Angaben wird die
        Claude-API von Anthropic eingesetzt. Die von dir übermittelten
        Informationen werden zu diesem Zweck an Anthropic übertragen und dort
        gemäß den Datenschutzbestimmungen von Anthropic verarbeitet.
      </p>

      <h2>4. Speicherdauer</h2>
      <p>
        Deine Angaben, Anhänge und Analyseergebnisse werden gespeichert,
        solange du die Analyse-ID zur Nutzung des Dienstes benötigst. Eine
        Löschung auf Anfrage ist jederzeit möglich (siehe Kontakt).
      </p>

      <h2>5. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner
        Daten. Wende dich hierfür an die im Impressum genannte Kontaktadresse.
      </p>

      <h2>6. Kontakt</h2>
      <p>Siehe Impressum für die Kontaktdaten des Anbieters.</p>
    </div>
  );
}
