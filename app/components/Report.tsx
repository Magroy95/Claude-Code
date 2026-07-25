import type { AnalysisReport, Hypothese } from "@/lib/analysis/schema";
import { DISCLAIMER } from "@/lib/analysis/pipeline";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function Kachel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-black/60 dark:text-white/60">{label}</div>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <Kachel label="Angebotspreis" value={formatEur(o.angebotspreisEur)} />
        <Kachel
          label="Orientierungswert"
          value={`${formatEur(report.orientierungswertMinEur)}–${formatEur(report.orientierungswertMaxEur)}`}
        />
        <Kachel label="Energieklasse" value={o.energieklasse ?? "–"} />
        <Kachel
          label="Grundstück"
          value={o.grundstueckQm ? `${o.grundstueckQm.toLocaleString("de-DE")} m²` : "–"}
        />
        <Kachel
          label="Gesamtbelastung / Monat"
          value={`ca. ${formatEur(report.cashflow.gesamtbelastungEur)}`}
        />
      </div>

      <Section title="Einschätzung">
        <p className="text-sm">{report.marktEinschaetzung}</p>
      </Section>

      <Section title="Marktwert-Orientierung">
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
              <div className="font-medium mb-1">{s.titel}</div>
              <p className="text-sm text-black/70 dark:text-white/70 mb-1">{s.beschreibung}</p>
              <p className="text-sm">{s.auswirkungText}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Drei Argumente gegen den Kauf">
        <div className="space-y-3">
          {report.argumenteContra.map((a, i) => (
            <div key={i} className="break-inside-avoid">
              <div className="font-medium">
                {i + 1}. {a.titel}
              </div>
              <p className="text-sm text-black/70 dark:text-white/70">{a.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Drei Argumente für den Kauf">
        <div className="space-y-3">
          {report.argumentePro.map((a, i) => (
            <div key={i} className="break-inside-avoid">
              <div className="font-medium">
                {i + 1}. {a.titel}
              </div>
              <p className="text-sm text-black/70 dark:text-white/70">{a.text}</p>
            </div>
          ))}
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
