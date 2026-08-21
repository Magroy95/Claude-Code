import type { AnalysisReport, Hypothese } from "@/lib/analysis/schema";
import { DISCLAIMER } from "@/lib/analysis/pipeline";
import { Bezahlschranke } from "./Bezahlschranke";
import { Rueckmeldung, SchrankeGesehen } from "./Rueckmeldung";

type Tone = "gruen" | "gelb" | "rot" | "neutral";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatProzent(anteil: number): string {
  return `${(anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rpt-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const KATEGORIE_LABEL: Record<Hypothese["kategorie"], string> = {
  KAUFENTSCHEIDEND: "Kaufentscheidend",
  KOSTENRELEVANT: "Kostenrelevant",
  STRATEGISCH: "Strategisch",
};

const KATEGORIE_SLUG: Record<Hypothese["kategorie"], string> = {
  KAUFENTSCHEIDEND: "kat-kaufentscheidend",
  KOSTENRELEVANT: "kat-kostenrelevant",
  STRATEGISCH: "kat-strategisch",
};

const GEWERK_LABEL: Record<string, string> = {
  DACH: "Dach",
  FASSADE: "Fassade / Außenwand",
  FENSTER: "Fenster",
  HEIZUNG: "Heizung & Warmwasser",
  ELEKTRO: "Elektroinstallation",
  SANITAER: "Sanitär & Leitungen",
  INNENAUSBAU: "Innenausbau",
  SCHADSTOFFE: "Schadstoffe",
};

const GEWERK_STATUS_LABEL: Record<string, string> = {
  ERNEUERT: "Erneuert",
  HANDLUNGSBEDARF: "Handlungsbedarf",
  NICHT_BEURTEILBAR: "Nicht beurteilbar",
};

const RISIKO_CLASS: Record<Hypothese["risiko"], string> = {
  HOCH: "hoch",
  MITTEL: "mittel",
  NIEDRIG: "niedrig",
};

const ENERGIEKLASSE_TONE: Record<string, Tone> = {
  "A+": "gruen",
  A: "gruen",
  B: "gruen",
  C: "gelb",
  D: "gelb",
  E: "rot",
  F: "rot",
  G: "rot",
  H: "rot",
};

function energieklasseTone(klasse: string | null): Tone {
  if (!klasse) return "neutral";
  return ENERGIEKLASSE_TONE[klasse.toUpperCase()] ?? "neutral";
}

// Der Sanierungsfahrplan-Text ("H → vermutlich F") enthält die Zielklasse als
// letzten A-H-Treffer im Freitext statt als eigenes striktes Enum-Feld.
function letzteEnergieklasse(text: string): string | null {
  const treffer = text.match(/\b[A-H]\+?\b/g);
  return treffer ? treffer[treffer.length - 1] : null;
}

function preisTone(angebotspreis: number, korridorMax: number): Tone {
  if (angebotspreis <= korridorMax) return "gruen";
  if (angebotspreis <= korridorMax * 1.1) return "gelb";
  return "rot";
}

function sanierungsstauTone(maxEur: number, angebotspreisEur: number): Tone {
  const anteil = angebotspreisEur > 0 ? maxEur / angebotspreisEur : 0;
  if (anteil > 0.15) return "rot";
  if (anteil > 0.05) return "gelb";
  return "gruen";
}

const AMPEL_CONFIG: Record<
  AnalysisReport["ampel"],
  { label: string; modifier: string }
> = {
  GRUEN: {
    label: "Niedriger Klärungs- und Verhandlungsbedarf",
    modifier: "is-gruen",
  },
  GELB: {
    label: "Mittlerer Klärungs- und Verhandlungsbedarf",
    modifier: "is-gelb",
  },
  ROT: {
    label: "Hoher Klärungs- und Verhandlungsbedarf",
    modifier: "is-rot",
  },
};

function Kachel({
  label,
  value,
  tone = "neutral",
  zusatz,
}: {
  label: string;
  value: string;
  tone?: Tone;
  /** Zweite, nachgeordnete Zahl – z.B. der Gesamtansatz inklusive Annahmen. */
  zusatz?: string;
}) {
  return (
    <div className={`rpt-kpi tone-${tone}`}>
      <b>{value}</b>
      {zusatz && <i className="rpt-kpi-zusatz">{zusatz}</i>}
      <span>{label}</span>
    </div>
  );
}

function FeldWert({
  value,
  suffix = "",
}: {
  value: string | number | null;
  suffix?: string;
}) {
  if (value === null || value === "") {
    return <span className="rpt-unbekannt">unbekannt – bei Besichtigung klären</span>;
  }
  return (
    <>
      {typeof value === "number" ? value.toLocaleString("de-DE") : value}
      {suffix}
    </>
  );
}

function ObjektdatenZeile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <FeldWert value={value} suffix={suffix} />
      </dd>
    </div>
  );
}

function PreiskorridorBar({
  min,
  max,
  preis,
}: {
  min: number;
  max: number;
  preis: number;
}) {
  const spanMin = Math.min(min, preis);
  const spanMax = Math.max(max, preis);
  const polster = (spanMax - spanMin) * 0.18 || 1000;
  const skalaMin = spanMin - polster;
  const skalaMax = spanMax + polster;
  const pct = (wert: number) => ((wert - skalaMin) / (skalaMax - skalaMin)) * 100;
  const minPct = pct(min);
  const maxPct = pct(max);
  const preisPct = pct(preis);

  // Der Angebotspreis kann außerhalb des Korridors liegen – die Einordnung
  // sagt qualitativ, ob (nicht: um wie viel genau), damit das Label kurz
  // bleibt und nicht aus der Kartenbreite herausläuft.
  const einordnung =
    preis > max
      ? { text: "über Korridor", klasse: "over" }
      : preis < min
        ? { text: "unter Korridor", klasse: "in" }
        : { text: "im Korridor", klasse: "in" };

  // Label an den Rändern nicht zentrieren, sonst läuft es dort aus der
  // Kartenbreite heraus – stattdessen ab 75%/25% am jeweiligen Rand verankern.
  const labelStyle: React.CSSProperties =
    preisPct >= 75
      ? { right: `${100 - preisPct}%` }
      : preisPct <= 25
        ? { left: `${preisPct}%` }
        : { left: `${preisPct}%`, transform: "translateX(-50%)" };

  return (
    <div className="rpt-korridor">
      <div className="rpt-korridor-wrap">
        <div className="rpt-korridor-label" style={labelStyle}>
          <b>Angebotspreis {formatEur(preis)}</b>{" "}
          <span className={einordnung.klasse}>({einordnung.text})</span>
        </div>
        <div className="rpt-korridor-track">
          <div
            className="rpt-korridor-fill"
            style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
          />
          <div className="rpt-korridor-marker" style={{ left: `${preisPct}%` }} />
        </div>
        <div className="rpt-korridor-scale">
          <span style={{ left: `${minPct}%` }}>{formatEur(min)}</span>
          <span style={{ left: `${maxPct}%`, transform: "translateX(-100%)" }}>
            {formatEur(max)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Rangfolge für den kostenlosen Anriss: Kaufentscheidendes zuerst, dann
// nach Risikostufe. Innerhalb gleicher Einstufung bleibt die Reihenfolge des
// Reports erhalten – die ist bereits priorisiert.
const KATEGORIE_RANG: Record<Hypothese["kategorie"], number> = {
  KAUFENTSCHEIDEND: 0,
  KOSTENRELEVANT: 1,
  STRATEGISCH: 2,
};
const RISIKO_RANG: Record<Hypothese["risiko"], number> = { HOCH: 0, MITTEL: 1, NIEDRIG: 2 };

function nachWichtigkeit(hypothesen: Hypothese[]): Hypothese[] {
  return [...hypothesen].sort(
    (a, b) =>
      KATEGORIE_RANG[a.kategorie] - KATEGORIE_RANG[b.kategorie] ||
      RISIKO_RANG[a.risiko] - RISIKO_RANG[b.risiko],
  );
}

function HypotheseCard({ h }: { h: Hypothese }) {
  return (
    <div className="hyp-card">
      <div className="hyp-card-head">
        <span className="hyp-title">
          <span className="hyp-key">{h.key} ·</span> {h.titel}
        </span>
        <span className={`hyp-badge ${RISIKO_CLASS[h.risiko]}`}>
          Risiko: {h.risiko}
        </span>
      </div>
      <div className="hyp-cost">{h.kostenrahmenText}</div>
      {h.risikoBegruendung && h.risikoBegruendung.length > 0 && (
        <p className="hyp-begruendung">
          <span className="hyp-begruendung-label">Einstufung:</span>{" "}
          {h.risikoBegruendung.join(" · ")}
        </p>
      )}
      {h.zitatAusExpose && (
        <blockquote className="hyp-zitat">&bdquo;{h.zitatAusExpose}&ldquo;</blockquote>
      )}
      <p className="hyp-text">{h.hypothese}</p>
      <ul className="hyp-questions">
        {h.pruefragen.map((frage, i) => (
          <li key={i}>{frage}</li>
        ))}
      </ul>
    </div>
  );
}

export function Report({
  report,
  analysisId,
  createdAt,
  changeSummary,
  freigeschaltet = true,
  angemeldet = false,
  preisEinzel,
  preisPaket,
}: {
  report: AnalysisReport;
  analysisId: string;
  createdAt: Date;
  changeSummary?: string | null;
  /**
   * Ist der vollständige Report freigeschaltet? Ohne Freischaltung endet die
   * Darstellung nach den Objektdaten. Standardmäßig true, damit der
   * PDF-Export und interne Aufrufe unverändert funktionieren – die Seite
   * setzt den Wert ausdrücklich.
   */
  freigeschaltet?: boolean;
  angemeldet?: boolean;
  preisEinzel?: string;
  preisPaket?: string;
}) {
  const o = report.objektdaten;
  const ampel = AMPEL_CONFIG[report.ampel];
  // Bewusst aus den Bestandteilen summiert statt aus cashflow.gesamtbelastungEur
  // gelesen: Ältere, vor der Umstellung gespeicherte Reports enthalten dort noch
  // die früher mitgerechneten geschätzten Nebenkosten. Die Summe hier hält die
  // Kennzahl deckungsgleich mit der darunter ausgewiesenen Rechnung.
  const rateUndRuecklageEur =
    report.cashflow.monatlicheAnnuitaetEur + report.cashflow.instandhaltungsruecklageEur;
  const annahmen = report.finanzAnnahmen;
  const kaufnebenkosten = report.kaufnebenkostenAufstellung;
  const gewerke = report.gewerke;
  // Quellen einmal gesammelt und entdoppelt unter der Tabelle ausweisen statt
  // je Zeile – mehrere Gewerke teilen sich dieselbe Quelle.
  const gewerkeQuellen = [
    ...new Set((gewerke ?? []).flatMap((g) => (g.status === "HANDLUNGSBEDARF" ? (g.quellen ?? []) : []))),
  ].sort();
  // Wie viel der Summe auf einer Annahme statt auf einer Angabe beruht. Das
  // gehört sichtbar neben die Zahl: Ein aus dem Baujahr gerechneter Posten
  // fällt in sich zusammen, sobald der Verkäufer ein Erneuerungsjahr nennt.
  const ohneJahr = (gewerke ?? []).filter(
    (g) => g.statusBasis === "BAUJAHR" && g.status === "HANDLUNGSBEDARF",
  );
  const ohneJahrSummeMin = ohneJahr.reduce((s, g) => s + (g.kostenMinEur ?? 0), 0);
  const ohneJahrSummeMax = ohneJahr.reduce((s, g) => s + (g.kostenMaxEur ?? 0), 0);
  // Der Teil des Sanierungsstaus, der auf einem belegten Erneuerungsjahr
  // beruht statt auf der Annahme "seit Baujahr nichts passiert".
  const belegterStauMin = report.sanierungsstauMinEur - ohneJahrSummeMin;
  const belegterStauMax = report.sanierungsstauMaxEur - ohneJahrSummeMax;
  // Zwei Hypothesen bleiben frei. Nicht als Häppchen, sondern vollständig:
  // Wer eine ganze Karte gelesen hat, weiß, was die übrigen wert sind – ein
  // angerissener Halbsatz erzeugt Misstrauen statt Neugier.
  const wichtigste = freigeschaltet ? [] : nachWichtigkeit(report.hypothesen).slice(0, 2);
  const weitereHypothesen = Math.max(report.hypothesen.length - wichtigste.length, 0);
  const klaerungsfragen = (gewerke ?? [])
    .map((g) => g.klaerungsfrage)
    .filter((f): f is string => typeof f === "string" && f.length > 0);
  const hypothesenByKategorie = (
    ["KAUFENTSCHEIDEND", "KOSTENRELEVANT", "STRATEGISCH"] as const
  ).map((kategorie) => ({
    kategorie,
    items: report.hypothesen.filter((h) => h.kategorie === kategorie),
  }));

  return (
    <article className="report-doc mx-auto max-w-3xl px-6 py-10 print:py-0">
      <header className="rpt-header">
        <h1>HauskaufChecker</h1>
        <p className="rpt-sub">Orientierungshilfe zur Vorbereitung auf die Besichtigung</p>
        <p className="rpt-meta">
          {analysisId} ·{" "}
          {createdAt.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      {changeSummary && (
        <div className="rpt-change">
          <b>Aktualisiert nach Besichtigung</b>
          <p>{changeSummary}</p>
        </div>
      )}

      {/*
        Kurzfassung: bewusst als eigenständiger, in sich abgeschlossener Block
        gebaut (Ampel + 1-2 Sätze) – vorgesehen als künftige kostenlose
        Preview, während der ausführliche Report darunter der kostenpflichtige
        Teil werden soll.
      */}
      <section id="kurzfassung" className={`rpt-ampel ${ampel.modifier}`}>
        <div className="rpt-ampel-label">
          <span aria-hidden className="rpt-ampel-dot" />
          {ampel.label}
        </div>
        <p className="rpt-ampel-text">{report.kurzfazit}</p>
        <p className="rpt-ampel-note">
          Die Ampel zeigt den Klärungs- und Verhandlungsbedarf vor einer Entscheidung – keine
          Kaufempfehlung.
        </p>
      </section>

      {/* Die Kennzahlen sind bewusst frei: Sie sind der Grund, aus dem
          jemand weiterlesen will. Wer sieht, dass hier bis zu 195.000 EUR
          Sanierungsstau stehen, will wissen, woraus die sich zusammensetzen –
          eine verborgene Zahl weckt dieses Bedürfnis nicht. Die Herleitung
          dahinter (Gewerke, Hypothesen, Rechenweg) bleibt kostenpflichtig. */}
      <div className="rpt-kennzahlen">
        <Kachel
          label="Angebotspreis"
          value={formatEur(o.angebotspreisEur)}
          tone={preisTone(o.angebotspreisEur, report.orientierungswertMaxEur)}
        />
        <Kachel
          label="Orientierungswert"
          value={`${formatEur(report.orientierungswertMinEur)}–${formatEur(report.orientierungswertMaxEur)}`}
        />
        <Kachel
          label="Energieklasse"
          value={o.energieklasse ?? "–"}
          tone={energieklasseTone(o.energieklasse)}
        />
        <Kachel
          label="Grundstück"
          value={o.grundstueckQm ? `${o.grundstueckQm.toLocaleString("de-DE")} m²` : "–"}
        />
        <Kachel
          label="Rate + Rücklage / Monat"
          value={`ca. ${formatEur(rateUndRuecklageEur)}`}
        />
        {/*
          Zweistufig, weil eine einzelne Zahl in beide Richtungen in die Irre
          führt.

          Nennt das Exposé Erneuerungsjahre, steht oben der belegte Betrag und
          darunter der Gesamtansatz – der Abstand ist genau das, was der
          Verkäufer mit einer Jahreszahl auflösen kann.

          Nennt es KEINE, war hier zunächst "keine belegten Posten" zu lesen.
          Das ist zwar wörtlich richtig, wird aber als "kein Sanierungsstau"
          verstanden – bei einem Haus mit sechsstelligem Ansatz das genaue
          Gegenteil der Aussage. Dann steht deshalb der Gesamtansatz oben und
          die Herkunft darunter.
        */}
        <Kachel
          label={belegterStauMax > 0 ? "Sanierungsstau · belegt" : "Sanierungsstau"}
          value={
            report.sanierungsstauMaxEur === 0
              ? "kein Handlungsbedarf erkennbar"
              : belegterStauMax > 0
                ? `${formatEur(belegterStauMin)}–${formatEur(belegterStauMax)}`
                : `${formatEur(report.sanierungsstauMinEur)}–${formatEur(report.sanierungsstauMaxEur)}`
          }
          zusatz={
            report.sanierungsstauMaxEur === 0
              ? undefined
              : belegterStauMax > 0
                ? `bis ${formatEur(report.sanierungsstauMaxEur)} inkl. Annahmen`
                : "ab Baujahr gerechnet – kein Erneuerungsjahr im Exposé"
          }
          tone={sanierungsstauTone(report.sanierungsstauMaxEur, o.angebotspreisEur)}
        />
      </div>

      {/*
        Annahmen offen ausweisen: Die Monatsbelastung ist die am leichtesten
        angreifbare Zahl im Report, solange nicht dabeisteht, mit welchem Zins
        und welcher Tilgung gerechnet wurde. Die Werte stammen aus dem Report
        selbst (nicht aus den aktuellen Konstanten), damit ein später geänderter
        Marktzins die Annahmen eines alten Reports nicht verfälscht.
      */}
      {annahmen && (
        <div className="rpt-annahmen">
          <p className="rpt-annahmen-head">Annahmen der Finanzierungsrechnung</p>
          <dl className="rpt-annahmen-liste">
            <div>
              <dt>Sollzins</dt>
              <dd>{formatProzent(annahmen.sollzins)} p.&nbsp;a.</dd>
            </div>
            <div>
              <dt>Anfangstilgung</dt>
              <dd>{formatProzent(annahmen.tilgung)} (Standardannahme)</dd>
            </div>
            <div>
              <dt>Zinsbindung</dt>
              <dd>{annahmen.zinsbindungJahre} Jahre</dd>
            </div>
            <div>
              <dt>Stresstest-Zins</dt>
              <dd>{formatProzent(annahmen.stressZins)} nach Ablauf der Bindung</dd>
            </div>
          </dl>
          <p className="rpt-annahmen-formel">
            {formatEur(rateUndRuecklageEur)} = Annuität{" "}
            {formatEur(report.cashflow.monatlicheAnnuitaetEur)} + Instandhaltungsrücklage{" "}
            {formatEur(report.cashflow.instandhaltungsruecklageEur)} (
            {annahmen.instandhaltungEurProQmMonat.toLocaleString("de-DE")} €/m² im Monat). Laufende
            Nebenkosten wie Grundsteuer, Gebäudeversicherung und Energie sind bewusst{" "}
            <strong>nicht</strong> enthalten – sie hängen von Angaben ab, die nicht im Exposé
            stehen, und werden hier nicht geschätzt.
          </p>
        </div>
      )}

      {/* Die Finanzierungsannahmen darüber bleiben frei: Sie erklären die
          Monatsrate, die ebenfalls frei steht – eine Zahl ohne ihre
          Grundlage wäre unseriös. Die Markteinschätzung ist dagegen eine
          Bewertung und damit Teil der Leistung. */}
      {freigeschaltet && (
        <Section title="Einschätzung">
          <p className="rpt-text">{report.marktEinschaetzung}</p>
        </Section>
      )}
      <Section title="Objektdaten (aus Exposé extrahiert)">
        <dl className="rpt-dl">
          <ObjektdatenZeile label="Lage" value={o.adresseOderLage} />
          <ObjektdatenZeile label="Baujahr" value={o.baujahr !== null ? String(o.baujahr) : null} />
          <ObjektdatenZeile label="Wohnfläche" value={o.wohnflaecheQm} suffix=" m²" />
          <ObjektdatenZeile label="Grundstück" value={o.grundstueckQm} suffix=" m²" />
          <ObjektdatenZeile label="Zimmer" value={o.zimmer} />
          <ObjektdatenZeile label="Energieklasse" value={o.energieklasse} />
          <ObjektdatenZeile label="Energiebedarf" value={o.energiebedarfKwhM2a} suffix=" kWh/(m²·a)" />
          <ObjektdatenZeile
            label="Energieausweistyp"
            value={
              o.energieausweisTyp === "BEDARF"
                ? "Bedarfsausweis"
                : o.energieausweisTyp === "VERBRAUCH"
                  ? "Verbrauchsausweis"
                  : null
            }
          />
          <ObjektdatenZeile label="Heizungstyp" value={o.heizungstyp} />
        </dl>
        {o.energieausweisTyp === "VERBRAUCH" && (
          <p className="rpt-hinweis">
            Verbrauchsausweis: Der ausgewiesene Energiewert beruht auf dem tatsächlichen
            Heizverhalten der Vorbewohner, nicht auf einer Gebäudeberechnung – der reale
            energetische Bedarf kann davon abweichen.
          </p>
        )}
      </Section>

      {!freigeschaltet && wichtigste.length > 0 && (
        <Section
          title={
            wichtigste.length === 1
              ? "Der wichtigste Punkt vor der Besichtigung"
              : "Die zwei wichtigsten Punkte vor der Besichtigung"
          }
        >
          <p className="rpt-text" style={{ marginBottom: "16px" }}>
            Aus {report.hypothesen.length} geprüften Hypothesen — vollständig ausformuliert, mit
            Beleg aus dem Exposé und den Fragen, die Sie beim Termin stellen sollten.
          </p>
          <div className="hyp-liste">
            {wichtigste.map((h) => (
              <HypotheseCard key={h.key} h={h} />
            ))}
          </div>
        </Section>
      )}

      {!freigeschaltet && (
        <>
          <Bezahlschranke
            analysisId={analysisId}
            angemeldet={angemeldet}
            preisEinzel={preisEinzel ?? ""}
            preisPaket={preisPaket ?? ""}
            weitereHypothesen={weitereHypothesen}
          />
          <SchrankeGesehen analysisId={analysisId} />
          <footer className="rpt-disclaimer">{DISCLAIMER}</footer>
        </>
      )}

      {freigeschaltet && (
      <>
      <Section title="Marktwert-Orientierung">
        <PreiskorridorBar
          min={report.orientierungswertMinEur}
          max={report.orientierungswertMaxEur}
          preis={o.angebotspreisEur}
        />
        <p className="rpt-text">{report.marktwertText}</p>
        <h3 className="rpt-subhead">Verhandlungsargumente</h3>
        {report.verhandlungsargumente.map((a, i) => (
          <div key={i} className="rpt-argu">
            <b>
              {i + 1}. {a.titel}
            </b>
            <p>{a.text}</p>
          </div>
        ))}
        {kaufnebenkosten ? (
          <div className="rpt-nebenkosten">
            <p className="rpt-nebenkosten-head">
              Kaufnebenkosten: {formatEur(report.kaufnebenkostenSchaetzungEur)}
            </p>
            <dl className="rpt-nebenkosten-liste">
              <div>
                <dt>Grunderwerbsteuer ({formatProzent(kaufnebenkosten.grunderwerbsteuerProzent)})</dt>
                <dd>{formatEur(kaufnebenkosten.grunderwerbsteuerEur)}</dd>
              </div>
              <div>
                <dt>Notar &amp; Grundbuch</dt>
                <dd>{formatEur(kaufnebenkosten.notarGrundbuchEur)}</dd>
              </div>
              {kaufnebenkosten.maklerprovisionEur > 0 && (
                <div>
                  <dt>Maklercourtage ({formatProzent(kaufnebenkosten.maklerprovisionProzent)})</dt>
                  <dd>{formatEur(kaufnebenkosten.maklerprovisionEur)}</dd>
                </div>
              )}
            </dl>
            {(kaufnebenkosten.bundeslandGeschaetzt || kaufnebenkosten.maklerprovisionGeschaetzt) && (
              <p className="rpt-nebenkosten-note">
                {kaufnebenkosten.bundeslandGeschaetzt &&
                  "Das Bundesland war aus der Lageangabe nicht eindeutig bestimmbar — für die Grunderwerbsteuer wurde ein Standardsatz angesetzt. "}
                {kaufnebenkosten.maklerprovisionGeschaetzt &&
                  "Das Exposé nennt keinen Courtage-Satz — angesetzt ist ein regionsüblicher Wert. "}
                Bitte vor der Finanzierungsanfrage gegenprüfen.
              </p>
            )}
          </div>
        ) : (
          <p className="rpt-text" style={{ marginTop: "14px" }}>
            Kaufnebenkosten (Schätzung): {formatEur(report.kaufnebenkostenSchaetzungEur)}
          </p>
        )}
      </Section>

      <Section title="Risiko-Stress-Test">
        {report.risikoSzenarien.map((s, i) => (
          <div key={i} className="rpt-scenario">
            <div className="rpt-scenario-head">
              <b>{s.titel}</b>
              {s.deltaMonatlicheBelastungEur != null ? (
                <span
                  className={`rpt-delta ${s.deltaMonatlicheBelastungEur >= 0 ? "bad" : "good"}`}
                >
                  {s.deltaMonatlicheBelastungEur >= 0 ? "+" : ""}
                  {formatEur(s.deltaMonatlicheBelastungEur)}/Monat
                </span>
              ) : (
                s.einmaligerBetragMinEur != null &&
                s.einmaligerBetragMaxEur != null && (
                  <span className="rpt-delta bad">
                    {formatEur(s.einmaligerBetragMinEur)}–{formatEur(s.einmaligerBetragMaxEur)}{" "}
                    einmalig
                  </span>
                )
              )}
            </div>
            <p>{s.beschreibung}</p>
            <p>{s.auswirkungText}</p>
          </div>
        ))}
      </Section>

      <Section title="Abwägung: Pro & Contra">
        <div className="rpt-procon">
          <div className="contra">
            <h3>Contra</h3>
            {report.argumenteContra.map((a, i) => (
              <div key={i} className="rpt-argu-mini">
                <b>
                  {i + 1}. {a.titel}
                </b>
                {a.text}
              </div>
            ))}
          </div>
          <div className="pro">
            <h3>Pro</h3>
            {report.argumentePro.map((a, i) => (
              <div key={i} className="rpt-argu-mini">
                <b>
                  {i + 1}. {a.titel}
                </b>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Hypothesen zur Klärung vor dem Besichtigungstermin">
        {hypothesenByKategorie.map(
          ({ kategorie, items }) =>
            items.length > 0 && (
              <div
                key={kategorie}
                className={`rpt-hyp-group ${KATEGORIE_SLUG[kategorie]}-cards`}
              >
                <h3 className={`rpt-kat ${KATEGORIE_SLUG[kategorie]}`}>
                  <span className="rpt-kat-name">{KATEGORIE_LABEL[kategorie]}</span>
                  <span className="rpt-kat-anzahl">
                    {items.length} {items.length === 1 ? "Hypothese" : "Hypothesen"}
                  </span>
                </h3>
                {items.map((h) => (
                  <HypotheseCard key={h.key} h={h} />
                ))}
              </div>
            ),
        )}
      </Section>

      {gewerke && gewerke.length > 0 && (
        <Section title="Gewerke-Checkliste">
          <p className="rpt-text" style={{ marginBottom: "14px" }}>
            Jedes Gewerk wird bei jedem Objekt beurteilt — auch dann, wenn die Unterlagen nichts
            hergeben. So ist erkennbar, was tatsächlich geprüft werden konnte und wo eine Lücke
            bleibt. Der geschätzte Sanierungsstau ist die Summe der Positionen mit Handlungsbedarf.
          </p>
          {ohneJahr.length > 0 && (
            <div className="rpt-annahme-box">
              <b>
                {ohneJahr.length === 1
                  ? "Eine Position ohne Erneuerungsjahr"
                  : `${ohneJahr.length} Positionen ohne Erneuerungsjahr`}
              </b>
              <p>
                Für {ohneJahr.length === 1 ? "dieses Gewerk" : "diese Gewerke"} nennt das Exposé kein
                Jahr der letzten Erneuerung:{" "}
                <strong>{ohneJahr.map((g) => GEWERK_LABEL[g.gewerk]).join(", ")}</strong>. Gerechnet
                wurde deshalb ab Baujahr {o.baujahr ?? "—"}, also unter der Annahme, dass seitdem
                nichts erneuert wurde. Das sind{" "}
                <strong>
                  {formatEur(ohneJahrSummeMin)}–{formatEur(ohneJahrSummeMax)}
                </strong>{" "}
                der ausgewiesenen Summe.
              </p>
              <p>
                Das ist keine Feststellung, sondern eine Annahme — im Exposé steht nur nichts
                Gegenteiliges. Jedes Erneuerungsjahr, das der Verkäufer nennt, senkt diesen Betrag
                oder lässt ihn entfallen. Die Fragen dazu stehen unten.
              </p>
            </div>
          )}
          <p className="rpt-text" style={{ marginBottom: "14px" }}>
            Die Kostenrahmen sind nicht frei geschätzt, sondern gerechnet: Kostenkennwert mal
            Bezugsmenge. Der Kennwert stammt aus einer hinterlegten Referenztabelle, die Menge
            aus den Angaben des Exposés. Beides steht unter jedem Posten, damit Sie die Rechnung
            nachvollziehen und mit einem Handwerkerangebot vergleichen können.
          </p>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "40%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Gewerk</th>
                  <th>Status</th>
                  <th>Kostenrahmen</th>
                  <th>Einschätzung</th>
                </tr>
              </thead>
              <tbody>
                {gewerke.map((g) => (
                  <tr key={g.gewerk}>
                    <td>{GEWERK_LABEL[g.gewerk]}</td>
                    <td>
                      <span className={`gewerk-status status-${g.status.toLowerCase()}`}>
                        {GEWERK_STATUS_LABEL[g.status]}
                      </span>
                    </td>
                    <td>
                      {g.kostenMinEur !== null && g.kostenMaxEur !== null ? (
                        <>
                          <span className={g.ausserhalbDerSumme ? "gewerk-betrag-offen" : undefined}>
                            {`${formatEur(g.kostenMinEur)}–${formatEur(g.kostenMaxEur)}`}
                          </span>
                          {g.bezugsmenge !== undefined && g.eurProEinheitMin !== undefined && (
                            <span className="gewerk-rechnung">
                              {g.bezugsmenge.toLocaleString("de-DE")} {g.bezugsEinheit} ×{" "}
                              {formatEur(g.eurProEinheitMin)}–{formatEur(g.eurProEinheitMax ?? 0)}
                            </span>
                          )}
                          {g.ausserhalbDerSumme && (
                            <span className="gewerk-rechnung">nicht in der Summe</span>
                          )}
                          {g.statusBasis === "BAUJAHR" && (
                            <span className="gewerk-rechnung">ab Baujahr gerechnet</span>
                          )}
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>
                      {g.begruendung}
                      {g.mengenHerleitung && (
                        <span className="gewerk-herleitung">
                          {g.leistungsumfang && <>{g.leistungsumfang}. </>}
                          Menge: {g.mengenHerleitung}.
                        </span>
                      )}
                      {/*
                        Nur der zeilenspezifische Fall wird hier ausgeschrieben.
                        Der Baujahr-Fall trifft fast alle Zeilen gleichzeitig und
                        stünde sonst sechsmal wortgleich in der Tabelle – er steht
                        einmal im Kasten über der Tabelle, in der Zeile genügt die
                        Markierung "ab Baujahr gerechnet" neben dem Betrag.
                      */}
                      {g.annahmeHinweis && g.statusBasis !== "BAUJAHR" && (
                        <span className="gewerk-annahme">
                          <strong>Kein Erneuerungsjahr angegeben.</strong> {g.annahmeHinweis}
                        </span>
                      )}
                      {g.unvollstaendigerAnsatz && (
                        <span className="gewerk-herleitung">
                          <strong>Nicht in der Summe enthalten:</strong> {g.unvollstaendigerAnsatz}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {klaerungsfragen.length > 0 && (
            <div className="rpt-fragen">
              <b>Fragen zum Erneuerungsstand — für die Besichtigung</b>
              <p>
                Diese Jahresangaben fehlen im Exposé und haben unmittelbar Einfluss auf die Summe
                oben — ohne sie wurde ab Baujahr gerechnet. Jede beantwortete Frage macht die
                Schätzung belastbarer.
              </p>
              <ol>
                {klaerungsfragen.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </div>
          )}
          {gewerkeQuellen.length > 0 && (
            <div className="rpt-quellen">
              <b>Quellen der Kostenkennwerte</b>
              <ul>
                {gewerkeQuellen.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <p>
                Öffentlich zugängliche Fachportale, je Position gegeneinander abgeglichen. Die
                Spannen sind bewusst breit und ersetzen kein Angebot. Regionale Preisunterschiede —
                die Stundensätze im Bauhauptgewerbe unterscheiden sich zwischen Süd- und
                Ostdeutschland um rund ein Drittel — sind darin nicht abgebildet.
              </p>
            </div>
          )}
        </Section>
      )}

      <Section title="Vorschlag: Sanierungsfahrplan">
        {/*
          Abgrenzung zum iSFP: Der Fahrplan nennt an mehreren Stellen den
          iSFP-Foerderbonus. Ohne diesen Hinweis koennte der Eindruck
          entstehen, dieser Vorschlag sei bereits ein iSFP - der ist aber ein
          rechtlich definiertes Dokument einer zugelassenen Energieberatung
          und Voraussetzung fuer den Bonus.
        */}
        <p className="rpt-vorschlag-hinweis">
          <strong>Das ist ein Vorschlag, kein beauftragter Plan.</strong> Die Reihenfolge ist eine
          hypothetische Priorisierung auf Basis der Exposé-Angaben und ersetzt keinen individuellen
          Sanierungsfahrplan (iSFP) im Sinne der BEG-Förderung — ein iSFP muss von einer
          zugelassenen Energieberatung erstellt werden und ist Voraussetzung für den Förderbonus.
        </p>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "31%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Maßnahme</th>
                <th>Kostenrahmen</th>
                <th>Förderung</th>
                <th>Energieklasse danach</th>
              </tr>
            </thead>
            <tbody>
              {report.sanierungsfahrplan.map((step, i) => {
                const klasse = letzteEnergieklasse(
                  step.voraussichtlicheEnergieklasseNachMassnahme,
                );
                return (
                  <tr key={i}>
                    <td>{step.zeitpunkt}</td>
                    <td>{step.massnahme}</td>
                    <td>{step.kostenrahmenText}</td>
                    <td>{step.foerderung}</td>
                    <td>
                      <span className={`rpt-eklasse tone-${energieklasseTone(klasse)}`}>
                        {step.voraussichtlicheEnergieklasseNachMassnahme}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Gesamtbild & offene Punkte">
        <p className="rpt-text" style={{ whiteSpace: "pre-line" }}>
          {report.gesamtbildText}
        </p>
        <h3 className="rpt-subhead">Wichtigste offene Punkte vor der Kaufentscheidung</h3>
        <ul className="rpt-offen">
          {report.offenePunkte.map((punkt, i) => (
            <li key={i}>
              <span aria-hidden className="box">
                ☐
              </span>
              <span>{punkt}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Rueckmeldung analysisId={analysisId} />

      <footer className="rpt-disclaimer">{DISCLAIMER}</footer>
      </>
      )}
    </article>
  );
}
