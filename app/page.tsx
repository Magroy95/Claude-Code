import type { Metadata } from "next";
import Link from "next/link";
import { StartAnalysisForm } from "./components/StartAnalysisForm";
import { siteConfig, ANBIETER } from "@/lib/site-config";
import {
  formatPreis,
  GUTACHTEN_VERGLEICH_EUR,
  PAKET_LAUFZEIT_TAGE,
  PRODUKT,
} from "@/lib/auth/berechtigung";
import { FRIST_EXPOSE_TAGE } from "@/lib/loeschung";
import { LIMITS } from "@/lib/ratelimit";
import { BEISPIELREPORT_PFAD } from "@/lib/beispiel";
import { DAUER_OBERGRENZE_MINUTEN, DAUER_TYPISCH_MINUTEN } from "@/lib/dauer";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const preisEinzel = formatPreis(PRODUKT.SINGLE.betragCent);
const preisPaket = formatPreis(PRODUKT.PAKET_3M.betragCent);

/**
 * Der Ablauf in der ersten Person und im Aktiv. „Es wird extrahiert" nennt
 * niemanden, der handelt – und wo niemand handelt, übernimmt auch niemand
 * Verantwortung. Wer den Text liest, soll wissen, wer hier was tut.
 */
const ablauf = [
  {
    titel: "Wir lesen Ihr Exposé",
    text: "Wohnfläche, Baujahr, Energiekennwert, Grundstück, Ausstattung — und die Nebensätze, in denen die interessanten Dinge stehen.",
  },
  {
    titel: "Wir ordnen den Preis ein",
    text: "Wir vergleichen den Angebotspreis mit dem, was das Objekt nach Lage, Größe und Zustand wert sein dürfte, und nennen Ihnen einen Korridor statt einer Scheingenauigkeit.",
  },
  {
    titel: "Wir gehen die acht Gewerke durch",
    text: "Dach, Fassade, Fenster, Heizung, Elektro, Sanitär, Innenausbau, Schadstoffe. Wo das Exposé kein Erneuerungsjahr nennt, rechnen wir ab Baujahr — und schreiben dazu, dass wir das getan haben.",
  },
  {
    titel: "Wir rechnen Ihre Monatsrate",
    text: "Mit Ihrem Eigenkapital, den Kaufnebenkosten Ihres Bundeslands und einem Stresstest für den Fall, dass die Zinsen bei der Anschlussfinanzierung höher stehen.",
  },
  {
    titel: "Wir prüfen uns selbst",
    text: "Mehrere unabhängige Durchgänge lesen das fertige Ergebnis gegen und suchen nach Widersprüchen. Was sie nicht belegen können, fliegt raus, bevor Sie es zu sehen bekommen.",
  },
];

/**
 * Die Ampel wird eingeordnet, bevor sie urteilt. Sonst liest ein Käufer
 * „Rot" als „Finger weg" und wirft ein Haus weg, das nach einer
 * Preisverhandlung genau das richtige gewesen wäre.
 */
const ampel = [
  {
    farbe: "Grün",
    klasse: "bg-emerald-500",
    bedeutung: "Gehen Sie hin.",
    text: "Wir haben nichts gefunden, das gegen das Objekt spricht — und der Preis liegt im Rahmen. Die Fragen in Ihrer Mappe sind trotzdem einen Termin wert.",
  },
  {
    farbe: "Gelb",
    klasse: "bg-amber-500",
    bedeutung: "Gehen Sie hin, aber mit Liste.",
    text: "Es gibt offene Punkte, die den Preis verschieben können. Klären Sie sie vor dem Angebot, nicht danach.",
  },
  {
    farbe: "Rot",
    klasse: "bg-rose-500",
    bedeutung: "Nicht: Finger weg.",
    text: "Rot heißt, dass mindestens ein Punkt kaufentscheidend ist und ungeklärt bleibt. Manchmal löst ein Dokument das auf. Manchmal ist es ein Preisnachlass. Und manchmal ist es der Grund, den Termin abzusagen — aber das entscheiden Sie, nicht wir.",
  },
];

const faqs = [
  {
    frage: `Was kostet mich das?`,
    antwort: `Die Kurzfassung mit Ampel, Kurzfazit, Kennzahlen und den zwei wichtigsten offenen Fragen kostet nichts und braucht kein Konto. Die vollständige Besichtigungsmappe kostet ${preisEinzel} für ein Haus. Wenn Sie mitten in der Suche stecken, ist der Hausjäger-Pass für ${preisPaket} günstiger: ${PAKET_LAUFZEIT_TAGE} Tage lang so viele Häuser, wie Sie wollen. Kein Abonnement, keine Kündigung.`,
  },
  {
    frage: "Gibt es eine Obergrenze beim Hausjäger-Pass?",
    antwort: `Es gibt keine Gesamtzahl, aber eine technische Bremse: bis zu ${LIMITS.analyseStarten.anzahl} Analysen pro Stunde. Sie ist da, damit niemand den Dienst automatisiert leerräumt. Wer Häuser sucht, wird sie im Alltag nicht bemerken.`,
  },
  {
    frage: "Ersetzt das einen Bausachverständigen?",
    antwort: `Nein, und das soll es auch nicht. Wir sehen das Haus nie. Wir arbeiten mit den Unterlagen, die Sie uns geben. Ein Sachverständiger steht im Keller, klopft die Wand ab und riecht, ob es feucht ist — das kann keine Auswertung von Papier leisten. Die Mappe hilft Ihnen bei der Frage davor: Lohnt sich für dieses Haus überhaupt ein Termin, und wenn ja, worauf soll der Sachverständige schauen?`,
  },
  {
    frage: "Wie lange dauert die Auswertung?",
    antwort: `In der Regel etwa ${DAUER_TYPISCH_MINUTEN} Minuten. Bei unseren bisherigen Läufen hat keiner länger als ${DAUER_OBERGRENZE_MINUTEN} Minuten gebraucht. Sie können den Fortschritt live mitverfolgen und die Seite zwischendurch schließen — der Link bleibt gültig.`,
  },
  {
    frage: "Welche Unterlagen brauche ich?",
    antwort:
      "Für den Start reicht ein PDF oder ein Foto des Exposés. Wenn Sie mehr haben — Energieausweis, Grundriss, Protokolle — reichen Sie es nach der Besichtigung nach; daraus entsteht eine überarbeitete Fassung Ihrer Mappe.",
  },
  {
    frage: "Was passiert mit dem Exposé?",
    antwort: `Wir löschen die hochgeladene Datei automatisch nach ${FRIST_EXPOSE_TAGE} Tagen. Ihre Analyse bleibt in Ihrem Konto, solange Sie sie behalten wollen; löschen können Sie sie jederzeit selbst mit einem Klick.`,
  },
  {
    frage: "Und wenn die Auswertung schiefgeht?",
    antwort:
      "Dann zahlen Sie nichts. Sie kaufen die Mappe erst, wenn sie fertig vor Ihnen liegt und Sie die Kurzfassung gesehen haben.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.url,
      offers: [
        {
          "@type": "Offer",
          name: PRODUKT.SINGLE.bezeichnung,
          price: (PRODUKT.SINGLE.betragCent / 100).toFixed(2),
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: PRODUKT.PAKET_3M.bezeichnung,
          price: (PRODUKT.PAKET_3M.betragCent / 100).toFixed(2),
          priceCurrency: "EUR",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.frage,
        acceptedAnswer: { "@type": "Answer", text: f.antwort },
      })),
    },
  ],
};

/** Wiederkehrende Einwandbehandlung direkt am Aufruf zum Handeln. */
function Einwaende() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-black/55 dark:text-white/55">
      <li>Kurzfassung kostenlos, ohne Konto</li>
      <li>Kein Abonnement</li>
      <li>Sie zahlen erst, wenn das Ergebnis vor Ihnen liegt</li>
      <li>Exposé wird nach {FRIST_EXPOSE_TAGE} Tagen gelöscht</li>
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Überschrift nennt das Ergebnis, nicht das Werkzeug. Niemand will
          eine Analyse; man will vorbereitet in einen Termin gehen. */}
      <section id="start" className="mx-auto max-w-2xl px-4 pt-14 pb-10 scroll-mt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
          Für Käuferinnen und Käufer beim ersten Mal
        </p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          Sie gehen in die Besichtigung und wissen genau, wonach Sie fragen müssen.
        </h1>
        {/* Der Gegner ist die Uhr, nicht der Makler. Wer den Verkäufer zum
            Feind erklärt, macht den Leser misstrauisch statt handlungsfähig –
            und trifft obendrein die Falschen. */}
        <p className="mt-5 text-black/70 dark:text-white/70 leading-relaxed">
          Gegen Sie arbeitet selten der Verkäufer. Gegen Sie arbeitet die Uhr: Der Termin ist kurz,
          eine Zusage soll schnell kommen, und in diesen paar Tagen sollen Sie etwas beurteilen, das
          Sie die nächsten dreißig Jahre abbezahlen. Laden Sie vorher das Exposé hoch. Sie bekommen
          die Fragen, die im Haus gestellt werden müssen — und eine Einschätzung, was im
          ungünstigen Fall an Kosten dahintersteckt.
        </p>

        <div className="mt-8 rounded-lg border border-black/10 dark:border-white/10 p-6">
          <StartAnalysisForm />
        </div>
        <Einwaende />
      </section>

      {/* Was drin ist – und zwar unter dem Namen, den es im Alltag hat. */}
      <section
        aria-labelledby="mappe-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="mappe-heading" className="text-xl font-semibold tracking-tight">
          Was Sie zum Termin mitnehmen
        </h2>
        <p className="mt-3 text-black/70 dark:text-white/70 leading-relaxed">
          Am Ende steht Ihre Besichtigungsmappe: ein Dokument, das Sie ausdrucken oder auf dem Handy
          öffnen können, während Sie durch das Haus gehen.
        </p>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
              Kostenlos
            </p>
            <ul className="mt-3 space-y-2 text-sm text-black/75 dark:text-white/75">
              <li>Ampel mit Begründung</li>
              <li>Kurzfazit in drei Sätzen</li>
              <li>Kennzahlen: Preis je Quadratmeter, Sanierungsstau, Monatsrate</li>
              <li>Die ausgelesenen Objektdaten</li>
              <li>Die zwei wichtigsten offenen Fragen, vollständig ausformuliert</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-black/25 dark:border-white/25 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
              Vollständige Mappe
            </p>
            <ul className="mt-3 space-y-2 text-sm text-black/75 dark:text-white/75">
              <li>Alle offenen Fragen, jede mit Beleg aus dem Exposé</li>
              <li>Preiskorridor und Argumente für die Verhandlung</li>
              <li>Alle acht Gewerke einzeln beurteilt, mit Kostenrahmen</li>
              <li>Sanierungsstau beziffert, mit Rechenweg und Quelle</li>
              <li>Monatsrate, Nebenkosten und Zinsstresstest</li>
              <li>Reihenfolge der Sanierungsschritte</li>
              <li>PDF für den Termin</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Die eigenen Grenzen stehen weit vorn und nicht im Kleingedruckten.
          Wer zuerst sagt, was er nicht kann, wird beim Rest eher geglaubt. */}
      <section
        aria-labelledby="grenzen-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="grenzen-heading" className="text-xl font-semibold tracking-tight">
          Was wir nicht können — vorweg
        </h2>
        <ul className="mt-5 space-y-3 text-black/75 dark:text-white/75">
          <li>
            <strong className="font-medium">Wir sehen das Haus nicht.</strong> Kein Blick in den
            Keller, keine Feuchtemessung, kein Klopfen an der Wand.
          </li>
          <li>
            <strong className="font-medium">Wir ersetzen kein Gutachten.</strong> Was wir liefern,
            ist eine Ersteinschätzung — sie hat vor Gericht und bei der Bank keinerlei Gewicht.
          </li>
          <li>
            <strong className="font-medium">Wir kennen nur, was in den Unterlagen steht.</strong>{" "}
            Was das Exposé verschweigt, können wir nicht wissen.
          </li>
        </ul>
        <p className="mt-5 text-black/70 dark:text-white/70 leading-relaxed">
          Was wir dafür können: aus dem, was drinsteht — und vor allem aus dem, was auffällig fehlt
          — die Fragen ableiten, die Sie im Termin stellen müssen. Ein Baujahr ohne genanntes
          Erneuerungsjahr für die Heizung ist keine Nebensache, sondern eine Rechnung, die irgendwann
          jemand bezahlt.
        </p>
      </section>

      {/* Die Ampel wird erklärt, bevor sie urteilt. */}
      <section
        aria-labelledby="ampel-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="ampel-heading" className="text-xl font-semibold tracking-tight">
          Rot heißt nicht: Finger weg
        </h2>
        <p className="mt-3 text-black/70 dark:text-white/70 leading-relaxed">
          Die Ampel bewertet nicht das Haus. Sie sagt Ihnen, wie Sie in den Termin gehen sollten.
        </p>
        <dl className="mt-6 space-y-5">
          {ampel.map((a) => (
            <div key={a.farbe} className="flex gap-4">
              <span
                aria-hidden
                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${a.klasse}`}
              />
              <div>
                <dt className="font-medium">
                  {a.farbe} — {a.bedeutung}
                </dt>
                <dd className="mt-1 text-sm text-black/70 dark:text-white/70 leading-relaxed">
                  {a.text}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Der Ablauf, damit die Wartezeit als Arbeit lesbar wird und nicht als
          Ladebalken. Wer weiß, was in den Minuten passiert, wartet lieber. */}
      <section
        aria-labelledby="ablauf-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="ablauf-heading" className="text-xl font-semibold tracking-tight">
          Was in den {DAUER_TYPISCH_MINUTEN} Minuten passiert
        </h2>
        <ol className="mt-6 flex flex-col gap-5">
          {ablauf.map((schritt, i) => (
            <li key={schritt.titel} className="flex gap-4">
              <span className="font-mono text-sm text-black/40 dark:text-white/40 pt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-medium">{schritt.titel}</p>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed">
                  {schritt.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-black/60 dark:text-white/60">
          Sie sehen währenddessen, an welchem Schritt wir gerade sind. Sie dürfen die Seite
          schließen — den Link bekommen Sie zusätzlich per E-Mail, sobald das Ergebnis da ist.
        </p>
      </section>

      {/* Wortlaut vom Betreiber vorgegeben. Statt erfundener Stimmen ein
          nachprüfbares Angebot: der vollständige Report zu einem Objekt. */}
      <section
        aria-labelledby="vertrauen-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="vertrauen-heading" className="text-xl font-semibold tracking-tight">
          Noch keine Kundenstimmen. Dafür ein vollständiger Beispielreport.
        </h2>
        <p className="mt-3 text-black/70 dark:text-white/70 leading-relaxed">
          HauskaufChecker ist neu. Statt Bewertungen zu erfinden, zeigen wir Ihnen einen kompletten
          Report zu einem echten Objekt — jede Seite, ohne Unschärfe, ohne Anmeldung. Sie sehen vor
          dem Kauf genau, was Sie bekommen.
        </p>
        <a
          href={BEISPIELREPORT_PFAD}
          className="mt-6 inline-block rounded-md border border-black/20 dark:border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Beispielreport ansehen (PDF)
        </a>
      </section>

      {/* Der Gründer mit Namen und einer eigenen Zahl. Die 600 EUR sind seine
          eigene Rechnung, keine Marktrecherche – deshalb steht der Satz in
          der ersten Person und behauptet nichts über andere. */}
      <section
        aria-labelledby="gruender-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="gruender-heading" className="text-xl font-semibold tracking-tight">
          Warum es das gibt
        </h2>
        <div className="mt-5 space-y-4 text-black/75 dark:text-white/75 leading-relaxed">
          <p>
            Ich habe für die Begleitung durch einen Bausachverständigen rund{" "}
            {GUTACHTEN_VERGLEICH_EUR} Euro bezahlt. Das war gut angelegtes Geld — aber es ist ein
            Betrag, den man nicht für jedes Haus ausgibt, das man sich anschaut.
          </p>
          <p>
            Genau deshalb fällt die Prüfung dort aus, wo sie am meisten bringen würde: vorher, bei
            den Häusern, die man noch aussortieren kann, ohne dass es weh tut. Man geht mit einem
            Bauchgefühl in Termine und merkt erst beim vierten Haus, welche Frage man beim ersten
            hätte stellen müssen.
          </p>
          <p>
            HauskaufChecker schließt diese Lücke. Nicht als Ersatz für den Sachverständigen, sondern
            als das, was davor kommt.
          </p>
          <p className="text-sm text-black/60 dark:text-white/60">
            — {ANBIETER.verantwortlich}, {siteConfig.name}
          </p>
        </div>
      </section>

      {/* Preise stehen nie allein, sondern neben der Summe, um die es geht. */}
      <section
        aria-labelledby="preise-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="preise-heading" className="text-xl font-semibold tracking-tight">
          Was es kostet
        </h2>
        <p className="mt-3 text-black/70 dark:text-white/70 leading-relaxed">
          Sie treffen gerade die teuerste Entscheidung Ihres Lebens. Die Mappe kostet ungefähr so
          viel wie das Mittagessen danach.
        </p>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-5">
            <h3 className="font-medium">{PRODUKT.SINGLE.bezeichnung}</h3>
            <p className="mt-1 text-2xl font-semibold">{preisEinzel}</p>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              Für das eine Haus, das Sie schon fest im Blick haben.
            </p>
          </div>
          <div className="rounded-lg border-2 border-black/25 dark:border-white/25 p-5">
            <h3 className="font-medium">{PRODUKT.PAKET_3M.bezeichnung}</h3>
            <p className="mt-1 text-2xl font-semibold">{preisPaket}</p>
            {/* Zweite, leisere Ansprache neben dem Jäger-Bild: Nicht jedes
                Käuferpaar erkennt sich in „Jagd" wieder. */}
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              Für die aktive Suchphase: {PAKET_LAUFZEIT_TAGE} Tage lang so viele Häuser, wie Sie
              wollen. Wenn Sie gerade jedes Wochenende unterwegs sind, ist das der günstigere Weg.
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-black/70 dark:text-white/70 leading-relaxed">
          Zum Vergleich: Für die Begleitung durch einen Bausachverständigen habe ich rund{" "}
          {GUTACHTEN_VERGLEICH_EUR} Euro gezahlt — für ein einziges Haus, und erst dann, wenn die
          Entscheidung schon fast gefallen war.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/preise" className="underline">
            Preise im Detail ansehen
          </Link>
        </p>
      </section>

      <section
        aria-labelledby="faq-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="faq-heading" className="text-xl font-semibold tracking-tight">
          Häufige Fragen
        </h2>
        <div className="mt-6 flex flex-col gap-6">
          {faqs.map((f) => (
            <div key={f.frage}>
              <h3 className="font-medium mb-1">{f.frage}</h3>
              <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed">
                {f.antwort}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10">
        <h2 className="text-xl font-semibold tracking-tight">
          Der nächste Termin steht schon im Kalender?
        </h2>
        <p className="mt-3 text-black/70 dark:text-white/70 leading-relaxed">
          Dann laden Sie das Exposé jetzt hoch. In {DAUER_TYPISCH_MINUTEN} Minuten haben Sie Ihre
          Fragen.
        </p>
        <a
          href="#start"
          className="mt-6 inline-block rounded-md bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 text-sm font-medium"
        >
          Exposé hochladen — Ergebnis in {DAUER_TYPISCH_MINUTEN} Minuten
        </a>
        <Einwaende />
      </section>
    </>
  );
}
