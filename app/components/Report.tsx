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

const TONE_STYLE: Record<Tone, string> = {
  gruen:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  gelb:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  rot: "bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  neutral: "border-black/10 dark:border-white/15",
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
    <div className={`rounded-lg border p-4 ${TONE_STYLE[tone]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 break-inside-avoid">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

const KATEGORIE_LABEL: Record<Hypothese["kategorie"], string> = {
  KAUFENTSCHEIDEND: "Kaufentscheidend",
  KOSTENRELEVANT: "Kostenrelevant",
  STRATEGISCH: "Strategisch",
};

const RISIKO_STYLE: Record<Hypothese["risiko"], string> = {
  HOCH: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  MITTEL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  NIEDRIG: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
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
  { label: string; style: string }
> = {
  GRUEN: {
    label: "Niedriger Klärungs- und Verhandlungsbedarf",
    style:
      "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200",
  },
  GELB: {
    label: "Mittlerer Klärungs- und Verhandlungsbedarf",
    style:
      "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200",
  },
  ROT: {
    label: "Hoher Klärungs- und Verhandlungsbedarf",
    style:
      "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-900 text-red-900 dark:text-red-200",
  },
};

function FeldWert({
  value,
  suffix = "",
}: {
  value: string | number | null;
  suffix?: string;
}) {
  if (value === null || value === "") {
    return (
      <span className="italic text-amber-700 dark:text-amber-400">
        unbekannt – bei Besichtigung klären
      </span>
    );
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
    <div className="flex justify-between gap-4 border-b border-black/5 dark:border-white/10 py-1.5">
      <dt className="text-black/60 dark:text-white/60 shrink-0">{label}</dt>
      <dd className="text-right min-w-0 break-words">
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
  const polster = (spanMax - spanMin) * 0.1 || 1000;
  const skalaMin = spanMin - polster;
  const skalaMax = spanMax + polster;
  const pct = (wert: number) => ((wert - skalaMin) / (skalaMax - skalaMin)) * 100;
  const tone = preisTone(preis, max);
  const balkenStyle: Record<Tone, string> = {
    gruen: "bg-emerald-400 dark:bg-emerald-600",
    gelb: "bg-amber-400 dark:bg-amber-600",
    rot: "bg-red-400 dark:bg-red-600",
    neutral: "bg-black/20 dark:bg-white/20",
  };

  return (
    <div className="mb-4">
      <div className="relative h-3 rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`absolute h-3 rounded-full opacity-70 ${balkenStyle[tone]}`}
          style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white dark:border-white dark:bg-black"
          style={{ left: `${pct(preis)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-black/60 dark:text-white/60 mt-1.5">
        <span>Korridor ab {formatEur(min)}</span>
        <span className="font-medium">Angebotspreis {formatEur(preis)}</span>
        <span>Korridor bis {formatEur(max)}</span>
      </div>
    </div>
  );
}

function HypotheseCard({ h }: { h: Hypothese }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 mb-3 break-inside-avoid">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-medium">
          {h.key} · {h.titel}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${RISIKO_STYLE[h.risiko]}`}
        >
          Risiko: {h.risiko}
        </span>
      </div>
      <div className="text-sm text-black/60 dark:text-white/60 mb-2">
        {h.kostenrahmenText}
      </div>
      <p className="text-sm mb-2">{h.hypothese}</p>
      <ul className="text-sm list-disc pl-5 space-y-0.5">
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
  const hypothesenByKategorie = (
    ["KAUFENTSCHEIDEND", "KOSTENRELEVANT", "STRATEGISCH"] as const
  ).map((kategorie) => ({
    kategorie,
    items: report.hypothesen.filter((h) => h.kategorie === kategorie),
  }));

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 print:py-0">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">HauskaufChecker</h1>
        <p className="text-black/60 dark:text-white/60">
          Orientierungshilfe zur Vorbereitung auf die Besichtigung
        </p>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          {analysisId} · {createdAt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </header>

      {changeSummary && (
        <div className="mb-8 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-4 text-sm">
          <div className="font-medium mb-1">Aktualisiert nach Besichtigung</div>
          <p>{changeSummary}</p>
        </div>
      )}

      {/*
        Kurzfassung: bewusst als eigenständiger, in sich abgeschlossener Block
        gebaut (Ampel + 1-2 Sätze) – vorgesehen als künftige kostenlose
        Preview, während der ausführliche Report darunter der kostenpflichtige
        Teil werden soll.
      */}
      <section
        id="kurzfassung"
        className={`mb-8 rounded-lg border p-5 ${AMPEL_CONFIG[report.ampel].style}`}
      >
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold uppercase tracking-wide">
          <span aria-hidden className="text-lg leading-none">●</span>
          {AMPEL_CONFIG[report.ampel].label}
        </div>
        <p className="text-sm">{report.kurzfazit}</p>
        <p className="text-xs mt-2 opacity-70">
          Die Ampel zeigt den Klärungs- und Verhandlungsbedarf vor einer Entscheidung – keine Kaufempfehlung.
        </p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
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
          label="Gesamtbelastung / Monat"
          value={`ca. ${formatEur(report.cashflow.gesamtbelastungEur)}`}
        />
        <Kachel
          label="Geschätzter Sanierungsstau"
          value={`${formatEur(report.sanierungsstauMinEur)}–${formatEur(report.sanierungsstauMaxEur)}`}
          tone={sanierungsstauTone(report.sanierungsstauMaxEur, o.angebotspreisEur)}
        />
      </div>

      <Section title="Einschätzung">
        <p className="text-sm">{report.marktEinschaetzung}</p>
      </Section>

      <Section title="Objektdaten (aus Exposé extrahiert)">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-sm">
          <ObjektdatenZeile label="Lage" value={o.adresseOderLage} />
          <ObjektdatenZeile label="Baujahr" value={o.baujahr !== null ? String(o.baujahr) : null} />
          <ObjektdatenZeile label="Wohnfläche" value={o.wohnflaecheQm} suffix=" m²" />
          <ObjektdatenZeile label="Grundstück" value={o.grundstueckQm} suffix=" m²" />
          <ObjektdatenZeile label="Zimmer" value={o.zimmer} />
          <ObjektdatenZeile label="Energieklasse" value={o.energieklasse} />
          <ObjektdatenZeile label="Energiebedarf" value={o.energiebedarfKwhM2a} suffix=" kWh/(m²·a)" />
          <ObjektdatenZeile label="Heizungstyp" value={o.heizungstyp} />
        </dl>
      </Section>

      <Section title="Marktwert-Orientierung">
        <PreiskorridorBar
          min={report.orientierungswertMinEur}
          max={report.orientierungswertMaxEur}
          preis={o.angebotspreisEur}
        />
        <p className="text-sm mb-3">{report.marktwertText}</p>
        <p className="text-sm mb-3">
          <span className="font-medium">Verhandlungsargumente: </span>
          {report.verhandlungsargumente}
        </p>
        <p className="text-sm">
          Kaufnebenkosten (Schätzung): {formatEur(report.kaufnebenkostenSchaetzungEur)}
        </p>
      </Section>

      <Section title="Cashflow-Analyse">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Kachel
            label="Monatliche Annuität"
            value={formatEur(report.cashflow.monatlicheAnnuitaetEur)}
          />
          <Kachel
            label="Instandhaltungsrücklage"
            value={formatEur(report.cashflow.instandhaltungsruecklageEur)}
          />
          <Kachel
            label="Sonstige Nebenkosten"
            value={formatEur(report.cashflow.sonstigeNebenkostenEur)}
          />
          <Kachel
            label="Gesamtbelastung / Monat"
            value={formatEur(report.cashflow.gesamtbelastungEur)}
          />
        </div>
        <p className="text-sm">
          <span className="font-medium">Opportunitätskostenvergleich: </span>
          {report.opportunitaetskostenText}
        </p>
      </Section>

      <Section title="Risiko-Stress-Test">
        <div className="space-y-3">
          {report.risikoSzenarien.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-black/10 dark:border-white/15 p-4 break-inside-avoid"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="font-medium">{s.titel}</div>
                {s.deltaMonatlicheBelastungEur != null && (
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      s.deltaMonatlicheBelastungEur >= 0
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {s.deltaMonatlicheBelastungEur >= 0 ? "+" : ""}
                    {formatEur(s.deltaMonatlicheBelastungEur)}/Monat
                  </span>
                )}
              </div>
              <p className="text-sm text-black/70 dark:text-white/70 mb-1">{s.beschreibung}</p>
              <p className="text-sm">{s.auswirkungText}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Abwägung: Pro & Contra">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 mb-2">
              Contra
            </h3>
            <div className="space-y-3">
              {report.argumenteContra.map((a, i) => (
                <div
                  key={i}
                  className="break-inside-avoid rounded-lg border border-red-100 dark:border-red-950 bg-red-50/40 dark:bg-red-950/20 p-3"
                >
                  <div className="font-medium text-sm">
                    {i + 1}. {a.titel}
                  </div>
                  <p className="text-sm text-black/70 dark:text-white/70">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-2">
              Pro
            </h3>
            <div className="space-y-3">
              {report.argumentePro.map((a, i) => (
                <div
                  key={i}
                  className="break-inside-avoid rounded-lg border border-emerald-100 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20 p-3"
                >
                  <div className="font-medium text-sm">
                    {i + 1}. {a.titel}
                  </div>
                  <p className="text-sm text-black/70 dark:text-white/70">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Hypothesen zur Klärung vor dem Besichtigungstermin">
        {hypothesenByKategorie.map(
          ({ kategorie, items }) =>
            items.length > 0 && (
              <div key={kategorie} className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60 mb-2">
                  {KATEGORIE_LABEL[kategorie]}
                </h3>
                {items.map((h) => (
                  <HypotheseCard key={h.key} h={h} />
                ))}
              </div>
            ),
        )}
      </Section>

      <Section title="Vorschlag: Sanierungsfahrplan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-black/10 dark:border-white/15">
                <th className="py-2 pr-3">Zeitpunkt</th>
                <th className="py-2 pr-3">Maßnahme</th>
                <th className="py-2 pr-3">Kostenrahmen</th>
                <th className="py-2">Förderung</th>
              </tr>
            </thead>
            <tbody>
              {report.sanierungsfahrplan.map((step, i) => (
                <tr key={i} className="border-b border-black/5 dark:border-white/10 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{step.zeitpunkt}</td>
                  <td className="py-2 pr-3">{step.massnahme}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{step.kostenrahmenText}</td>
                  <td className="py-2">{step.foerderung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Gesamtbild">
        <p className="text-sm whitespace-pre-line">{report.gesamtbild}</p>
      </Section>

      <footer className="mt-10 pt-4 border-t border-black/10 dark:border-white/15 text-xs text-black/50 dark:text-white/50">
        {DISCLAIMER}
      </footer>
    </article>
  );
}
