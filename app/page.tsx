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
import { BEISPIELREPORT_PFAD, BEISPIEL_AUSZUG } from "@/lib/beispiel";
import { DAUER_OBERGRENZE_MINUTEN, DAUER_TYPISCH_MINUTEN } from "@/lib/dauer";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const preisEinzel = formatPreis(PRODUKT.SINGLE.betragCent);
const preisPaket = formatPreis(PRODUKT.PAKET_3M.betragCent);

function eur(betrag: number): string {
  return betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

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
    text: "Wir vergleichen den Angebotspreis mit dem, was das Objekt nach Lage, Größe und Zustand wert sein dürfte, verankert am amtlichen Bodenrichtwert — und nennen einen Korridor statt einer Scheingenauigkeit.",
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
    klasse: "gruen",
    bedeutung: "Gehen Sie hin.",
    text: "Wir haben nichts gefunden, das gegen das Objekt spricht — und der Preis liegt im Rahmen. Die Fragen in Ihrer Mappe sind trotzdem einen Termin wert.",
  },
  {
    farbe: "Gelb",
    klasse: "gelb",
    bedeutung: "Gehen Sie hin, aber mit Liste.",
    text: "Es gibt offene Punkte, die den Preis verschieben können. Klären Sie sie vor dem Angebot, nicht danach.",
  },
  {
    farbe: "Rot",
    klasse: "rot",
    bedeutung: "Nicht: Finger weg.",
    text: "Rot heißt, dass mindestens ein Punkt kaufentscheidend ist und ungeklärt bleibt. Manchmal löst ein Dokument das auf. Manchmal ist es ein Preisnachlass. Und manchmal ist es der Grund, den Termin abzusagen — aber das entscheiden Sie, nicht wir.",
  },
];

const faqs = [
  {
    frage: "Was kostet mich das?",
    antwort: `Die Kurzfassung mit Ampel, Kurzfazit, Kennzahlen und den zwei wichtigsten offenen Fragen kostet nichts und braucht kein Konto. Die vollständige Besichtigungsmappe kostet ${preisEinzel} für ein Haus. Wenn Sie mitten in der Suche stecken, ist der Hausjäger-Pass für ${preisPaket} günstiger: ${PAKET_LAUFZEIT_TAGE} Tage lang so viele Häuser, wie Sie wollen. Kein Abonnement, keine Kündigung.`,
  },
  {
    frage: "Gibt es eine Obergrenze beim Hausjäger-Pass?",
    antwort: `Es gibt keine Gesamtzahl, aber eine technische Bremse: bis zu ${LIMITS.analyseStarten.anzahl} Analysen pro Stunde. Sie ist da, damit niemand den Dienst automatisiert leerräumt. Wer Häuser sucht, wird sie im Alltag nicht bemerken.`,
  },
  {
    frage: "Ersetzt das einen Bausachverständigen?",
    antwort:
      "Nein, und das soll es auch nicht. Wir sehen das Haus nie. Wir arbeiten mit den Unterlagen, die Sie uns geben. Ein Sachverständiger steht im Keller, klopft die Wand ab und riecht, ob es feucht ist — das kann keine Auswertung von Papier leisten. Die Mappe hilft Ihnen bei der Frage davor: Lohnt sich für dieses Haus überhaupt ein Termin, und wenn ja, worauf soll der Sachverständige schauen?",
  },
  {
    frage: "Wie lange dauert die Auswertung?",
    antwort: `In der Regel etwa ${DAUER_TYPISCH_MINUTEN} Minuten. Bei unseren bisherigen Läufen hat keiner länger als ${DAUER_OBERGRENZE_MINUTEN} Minuten gebraucht. Sie sehen den Fortschritt Schritt für Schritt und können die Seite zwischendurch schließen — der Link bleibt gültig und kommt zusätzlich per E-Mail.`,
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
    <ul className="lp-einwaende">
      <li>Kurzfassung kostenlos, ohne Konto</li>
      <li>Kein Abonnement</li>
      <li>Sie zahlen erst, wenn das Ergebnis vor Ihnen liegt</li>
      <li>Exposé wird nach {FRIST_EXPOSE_TAGE} Tagen gelöscht</li>
    </ul>
  );
}

/**
 * Der Auszug aus dem Beispielreport, direkt neben der Überschrift.
 *
 * Statt einer Behauptung über die Leistung steht hier die Leistung selbst.
 * Alle Werte stammen aus dem verlinkten Beispielreport (lib/beispiel.ts) –
 * wer daneben klickt, findet sie dort wieder.
 */
function Auszug() {
  const a = BEISPIEL_AUSZUG;
  // Der Preis wird auf einer Skala verortet, die etwas über den Korridor
  // hinausreicht. So sieht man nicht nur DASS er darüber liegt, sondern
  // auch wie weit – das ist die Verhandlungsmasse.
  const skalaMin = a.korridorMinEur * 0.95;
  const skalaMax = Math.max(a.angebotspreisEur, a.korridorMaxEur) * 1.04;
  const anteil = (wert: number) => ((wert - skalaMin) / (skalaMax - skalaMin)) * 100;

  return (
    <aside className="lp-karte" aria-label="Auszug aus dem Beispielreport">
      <div className="lp-karte-kopf">
        <span className="kreuz">+</span>
        <span>Auszug · Beispielreport</span>
        <span className="kennung">{a.kennung}</span>
      </div>
      <div className="lp-karte-leib">
        <div className="lp-reiter" aria-hidden="true">
          <span>Ersteinschätzung</span>
          <span className="aktiv">Vollreport</span>
        </div>

        <div className="lp-karte-ampel">
          <div className="marke">Hoher Klärungsbedarf</div>
          <p>{a.ampelText}</p>
        </div>

        <div className="lp-korridor">
          <div className="lp-korridor-kopf">
            <span>Orientierungskorridor</span>
            <span>Angebotspreis</span>
          </div>
          <div className="lp-skala">
            <span
              className="spanne"
              style={{
                left: `${anteil(a.korridorMinEur)}%`,
                width: `${anteil(a.korridorMaxEur) - anteil(a.korridorMinEur)}%`,
              }}
            />
            <span className="zeiger" style={{ left: `${anteil(a.angebotspreisEur)}%` }} />
          </div>
          <div className="lp-korridor-fuss">
            <span>
              {eur(a.korridorMinEur)}–{eur(a.korridorMaxEur)}
            </span>
            <span className="aus">{eur(a.angebotspreisEur)} · über Korridor</span>
          </div>
          <p className="fussnote">
            Korridor aus Bodenrichtwert, Baujahr, Fläche und Zustand — keine Wertermittlung nach
            ImmoWertV.
          </p>
        </div>

        <div className="lp-karte-kacheln">
          <div className="lp-kachel">
            <b>
              {a.wohnflaecheQm} m² · {a.baujahr}
            </b>
            <span>Wohnfläche · Baujahr</span>
          </div>
          <div className="lp-kachel warn">
            <b>
              {eur(a.sanierungsstauMinEur)}–{eur(a.sanierungsstauMaxEur)}
            </b>
            <span>Geschätzter Sanierungsstau</span>
          </div>
        </div>
        <p className="lp-karte-notiz">{a.stauNotiz}</p>

        <ul className="lp-punkte">
          {a.punkte.map((p) => (
            <li key={p.titel} className={p.hoch ? "hoch" : undefined}>
              <b>{p.titel}:</b> {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-karte-fuss">{a.objekt}</div>
    </aside>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="lp-raster">
        <div className="lp-bahn">
          {/* Überschrift nennt das Ergebnis, nicht das Werkzeug. Niemand will
              eine Analyse; man will vorbereitet in einen Termin gehen. */}
          <section className="lp-hero">
            <div>
              <p className="lp-augenbraue">Vor der Besichtigung, nicht vor dem Notartermin</p>
              <h1 className="lp-titel">
                Sie gehen in die Besichtigung und wissen genau, <em>wonach Sie fragen müssen.</em>
              </h1>
              {/* Der Gegner ist die Uhr, nicht der Makler. Wer den Verkäufer
                  zum Feind erklärt, macht den Leser misstrauisch statt
                  handlungsfähig – und trifft obendrein die Falschen. */}
              <p className="lp-vorspann">
                Gegen Sie arbeitet selten der Verkäufer. Gegen Sie arbeitet die Uhr: Der Termin ist
                kurz, eine Zusage soll schnell kommen, und in diesen paar Tagen sollen Sie etwas
                beurteilen, das Sie die nächsten dreißig Jahre abbezahlen.
              </p>

              <div className="lp-hero-tat">
                <a href="#start" className="lp-knopf">
                  Exposé hochladen
                </a>
                <a href={BEISPIELREPORT_PFAD} className="lp-textlink">
                  Beispielreport ansehen — ohne Anmeldung →
                </a>
              </div>
              <Einwaende />

              <p className="lp-dringend">
                <b>Besichtigung am Wochenende?</b> Die Kurzfassung liegt in rund{" "}
                {DAUER_TYPISCH_MINUTEN} Minuten vor Ihnen.
              </p>
            </div>

            <Auszug />
          </section>
        </div>
      </div>

      <div className="lp-bahn">
        {/* Der Ablauf, damit die Wartezeit als Arbeit lesbar wird und nicht
            als Ladebalken. Wer weiß, was in den Minuten passiert, wartet
            lieber. */}
        <section id="methode" className="lp-abschnitt" style={{ scrollMarginTop: "80px" }}>
          <div className="lp-zweispaltig">
            <div className="lp-kopfzeile">
              <p className="lp-augenbraue">Methode</p>
              <h2 className="lp-h2">Was in den {DAUER_TYPISCH_MINUTEN} Minuten passiert</h2>
              <p className="lp-text">
                Ihr Exposé geht durch acht Schritte. Sie sehen dabei zu — angezeigt wird der
                tatsächliche Stand, kein Balken, der einfach losläuft.
              </p>
            </div>
            <ol className="lp-schritte">
              {ablauf.map((schritt, i) => (
                <li key={schritt.titel}>
                  <span className="nr">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="lp-h3">{schritt.titel}</h3>
                    <p className="lp-text" style={{ fontSize: "15.5px" }}>
                      {schritt.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Die eigenen Grenzen stehen weit vorn und nicht im Kleingedruckten.
            Wer zuerst sagt, was er nicht kann, wird beim Rest eher geglaubt. */}
        <section className="lp-abschnitt">
          <div className="lp-zweispaltig">
            <div className="lp-kopfzeile">
              <p className="lp-augenbraue">Grenzen</p>
              <h2 className="lp-h2">Was wir nicht können — vorweg</h2>
            </div>
            <div>
              <ul className="lp-grenzen">
                <li>
                  <b>Wir sehen das Haus nicht.</b> Kein Blick in den Keller, keine Feuchtemessung,
                  kein Klopfen an der Wand.
                </li>
                <li>
                  <b>Wir ersetzen kein Gutachten.</b> Was wir liefern, ist eine Ersteinschätzung —
                  sie hat vor Gericht und bei der Bank keinerlei Gewicht.
                </li>
                <li>
                  <b>Wir kennen nur, was in den Unterlagen steht.</b> Was das Exposé verschweigt,
                  können wir nicht wissen.
                </li>
              </ul>
              <p className="lp-text" style={{ marginTop: "22px" }}>
                Was wir dafür können: aus dem, was drinsteht — und vor allem aus dem, was auffällig
                fehlt — die Fragen ableiten, die Sie im Termin stellen müssen. Ein Baujahr ohne
                genanntes Erneuerungsjahr für die Heizung ist keine Nebensache, sondern eine
                Rechnung, die irgendwann jemand bezahlt.
              </p>
            </div>
          </div>
        </section>

        {/* Die Ampel wird erklärt, bevor sie urteilt. */}
        <section className="lp-abschnitt">
          <div className="lp-zweispaltig">
            <div className="lp-kopfzeile">
              <p className="lp-augenbraue">Die Ampel</p>
              <h2 className="lp-h2">Rot heißt nicht: Finger weg</h2>
              <p className="lp-text">
                Die Ampel bewertet nicht das Haus. Sie sagt Ihnen, wie Sie in den Termin gehen
                sollten.
              </p>
            </div>
            <dl className="lp-ampelliste">
              {ampel.map((a) => (
                <div key={a.farbe}>
                  <span aria-hidden className={`punkt ${a.klasse}`} />
                  <div>
                    <dt>
                      {a.farbe} — {a.bedeutung}
                    </dt>
                    <dd>{a.text}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Wortlaut vom Betreiber vorgegeben. Statt erfundener Stimmen ein
            nachprüfbares Angebot: der vollständige Report zu einem Objekt. */}
        <section className="lp-abschnitt">
          <div className="lp-tafel">
            <p className="lp-augenbraue">Belege statt Behauptungen</p>
            <h2 className="lp-h2">
              Noch keine Kundenstimmen. Dafür ein vollständiger Beispielreport.
            </h2>
            <p className="lp-text">
              HauskaufChecker ist neu. Statt Bewertungen zu erfinden, zeigen wir Ihnen einen
              kompletten Report zu einem echten Objekt — jede Seite, ohne Unschärfe, ohne Anmeldung.
              Sie sehen vor dem Kauf genau, was Sie bekommen.
            </p>
            <p style={{ marginTop: "24px" }}>
              <a href={BEISPIELREPORT_PFAD} className="lp-knopf stumm">
                Beispielreport ansehen (PDF)
              </a>
            </p>
          </div>
        </section>

        {/* Der Gründer mit Namen und einer eigenen Zahl. Die 600 EUR sind
            seine eigene Rechnung, keine Marktrecherche – deshalb steht der
            Satz in der ersten Person und behauptet nichts über andere. */}
        <section className="lp-abschnitt">
          <div className="lp-zweispaltig">
            <div className="lp-kopfzeile">
              <p className="lp-augenbraue">Warum es das gibt</p>
              <h2 className="lp-h2">
                {GUTACHTEN_VERGLEICH_EUR} Euro für ein Haus. Und für die davor?
              </h2>
            </div>
            <div>
              <p className="lp-text">
                Ich habe für die Begleitung durch einen Bausachverständigen rund{" "}
                {GUTACHTEN_VERGLEICH_EUR} Euro bezahlt. Das war gut angelegtes Geld — aber es ist
                ein Betrag, den man nicht für jedes Haus ausgibt, das man sich anschaut.
              </p>
              <p className="lp-text">
                Genau deshalb fällt die Prüfung dort aus, wo sie am meisten bringen würde: vorher,
                bei den Häusern, die man noch aussortieren kann, ohne dass es weh tut. Man geht mit
                einem Bauchgefühl in Termine und merkt erst beim vierten Haus, welche Frage man beim
                ersten hätte stellen müssen.
              </p>
              <p className="lp-text">
                HauskaufChecker schließt diese Lücke. Nicht als Ersatz für den Sachverständigen,
                sondern als das, was davor kommt.
              </p>
              <p className="lp-klein" style={{ marginTop: "18px" }}>
                — {ANBIETER.verantwortlich}, {siteConfig.name}
              </p>
            </div>
          </div>
        </section>

        {/* Preise stehen nie allein, sondern neben der Summe, um die es geht. */}
        <section id="preise" className="lp-abschnitt" style={{ scrollMarginTop: "80px" }}>
          <div className="lp-kopfzeile">
            <p className="lp-augenbraue">Preise</p>
            <h2 className="lp-h2">Was es kostet</h2>
            <p className="lp-text">
              Sie treffen gerade die teuerste Entscheidung Ihres Lebens. Die Mappe kostet ungefähr
              so viel wie das Mittagessen danach.
            </p>
          </div>

          <div className="lp-preise">
            <div className="lp-preiskarte">
              <span className="name">{PRODUKT.SINGLE.bezeichnung}</span>
              <span className="betrag">
                {preisEinzel} <small>einmalig</small>
              </span>
              <p className="wofuer">Für das eine Haus, das Sie schon fest im Blick haben.</p>
              <ul>
                <li>Die vollständige Besichtigungsmappe</li>
                <li>PDF für den Termin</li>
                <li>Bleibt dauerhaft in Ihrem Konto</li>
              </ul>
            </div>
            <div className="lp-preiskarte hervor">
              <span className="name">{PRODUKT.PAKET_3M.bezeichnung}</span>
              <span className="betrag">
                {preisPaket} <small>{PAKET_LAUFZEIT_TAGE} Tage</small>
              </span>
              {/* Zweite, leisere Ansprache neben dem Jäger-Bild: Nicht jedes
                  Käuferpaar erkennt sich in „Jagd" wieder. */}
              <p className="wofuer">
                Für die aktive Suchphase. Wenn Sie gerade jedes Wochenende unterwegs sind, ist das
                der günstigere Weg.
              </p>
              <ul>
                <li>So viele Häuser, wie Sie wollen</li>
                <li>Lohnt sich ab dem zweiten Haus</li>
                <li>Endet automatisch, keine Kündigung</li>
              </ul>
            </div>
          </div>

          <p className="lp-text" style={{ marginTop: "26px", fontSize: "15.5px" }}>
            Zum Vergleich: Für die Begleitung durch einen Bausachverständigen habe ich rund{" "}
            {GUTACHTEN_VERGLEICH_EUR} Euro gezahlt — für ein einziges Haus, und erst dann, wenn die
            Entscheidung schon fast gefallen war.
          </p>
          <p style={{ marginTop: "14px" }}>
            <Link href="/preise" className="lp-textlink">
              Preise im Detail →
            </Link>
          </p>
        </section>

        {/* Das Formular am Ende: Die Startseite muss erst erklären, wofür man
            sein Exposé hergibt. Der Knopf oben springt hierher. */}
        <section id="start" className="lp-abschnitt" style={{ scrollMarginTop: "80px" }}>
          <div className="lp-zweispaltig">
            <div className="lp-kopfzeile">
              <p className="lp-augenbraue">Loslegen</p>
              <h2 className="lp-h2">Ihr Exposé, Ihre Fragen</h2>
              <p className="lp-text">
                Ein PDF oder ein Foto genügt. Die Kurzfassung ist kostenlos und braucht kein Konto —
                Sie entscheiden erst danach, ob Sie die vollständige Mappe wollen.
              </p>
              <Einwaende />
            </div>
            <div className="lp-tafel">
              <StartAnalysisForm />
            </div>
          </div>
        </section>

        <section id="fragen" className="lp-abschnitt" style={{ scrollMarginTop: "80px" }}>
          <div className="lp-kopfzeile">
            <p className="lp-augenbraue">Fragen</p>
            <h2 className="lp-h2">Häufige Fragen</h2>
          </div>
          <div className="lp-faq">
            {faqs.map((f) => (
              <details key={f.frage}>
                <summary>{f.frage}</summary>
                <p className="antwort">{f.antwort}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-abschnitt eng">
          <div className="lp-schluss">
            <p className="lp-augenbraue">Der nächste Termin</p>
            <h2 className="lp-h2">Steht er schon im Kalender?</h2>
            <p className="lp-text">
              Dann laden Sie das Exposé jetzt hoch. In {DAUER_TYPISCH_MINUTEN} Minuten haben Sie
              Ihre Fragen.
            </p>
            <a href="#start" className="lp-knopf" style={{ marginTop: "26px" }}>
              Exposé hochladen — Ergebnis in {DAUER_TYPISCH_MINUTEN} Minuten
            </a>
            <Einwaende />
          </div>
        </section>
      </div>
    </>
  );
}
