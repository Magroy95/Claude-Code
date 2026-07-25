export const metadata = { title: "Nutzungsbedingungen – HauskaufChecker" };

export default function NutzungsbedingungenPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 prose prose-sm dark:prose-invert">
      <h1>Nutzungsbedingungen</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Solider Textentwurf für den Prototyp-Betrieb – vor Live-Betrieb
        anwaltlich prüfen lassen.
      </p>

      <h2>1. Leistungsbeschreibung</h2>
      <p>
        HauskaufChecker erstellt auf Basis der von dir bereitgestellten
        Unterlagen (Exposé, Angaben, ggf. Besichtigungsinformationen) eine
        KI-gestützte, unverbindliche Ersteinschätzung einer Immobilie. Die
        Ergebnisse sind Hypothesen auf Basis der übermittelten Informationen,
        keine gutachterliche Feststellung.
      </p>

      <h2>2. Kein Ersatz für fachliche Beratung</h2>
      <p>
        Der Dienst ersetzt keine Begutachtung durch einen Bausachverständigen,
        keine Rechtsberatung und keine Finanzberatung. Vor einer
        Kaufentscheidung wird eine unabhängige fachliche Prüfung dringend
        empfohlen.
      </p>

      <h2>3. Richtigkeit der Angaben</h2>
      <p>
        Die Qualität der Ergebnisse hängt von der Vollständigkeit und
        Richtigkeit der von dir bereitgestellten Unterlagen ab. Wir
        übernehmen keine Gewähr für die Richtigkeit, Vollständigkeit oder
        Aktualität der erzeugten Einschätzungen.
      </p>

      <h2>4. Haftungsausschluss</h2>
      <p>
        Die Nutzung der Ergebnisse erfolgt auf eigene Verantwortung. Eine
        Haftung für Entscheidungen, die auf Basis der bereitgestellten
        Einschätzung getroffen werden, ist ausgeschlossen, soweit gesetzlich
        zulässig.
      </p>

      <h2>5. Änderungen</h2>
      <p>
        Diese Nutzungsbedingungen können angepasst werden, um den Dienst
        weiterzuentwickeln.
      </p>
    </div>
  );
}
