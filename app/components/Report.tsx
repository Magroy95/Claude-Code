import type { AnalysisReport, Hypothese } from "@/lib/analysis/schema";
import { DISCLAIMER } from "@/lib/analysis/pipeline";

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
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className={`rpt-kpi tone-${tone}`}>
      <b>{value}</b>
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
}: {
  report: AnalysisReport;
  analysisId: string;
  createdAt: Date;
  changeSummary?: string | null;
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
        <Kachel
          label="Geschätzter Sanierungsstau"
          value={`${formatEur(report.sanierungsstauMinEur)}–${formatEur(report.sanierungsstauMaxEur)}`}
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

      <Section title="Einschätzung">
        <p className="rpt-text">{report.marktEinschaetzung}</p>
      </Section>

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

      <footer className="rpt-disclaimer">{DISCLAIMER}</footer>
    </article>
  );
}
