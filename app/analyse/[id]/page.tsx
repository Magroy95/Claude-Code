import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { analysisReportSchema } from "@/lib/analysis/schema";
import { Report } from "@/app/components/Report";
import { ProcessingScreen } from "@/app/components/ProcessingScreen";

export default async function AnalysePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { results: { orderBy: { version: "asc" } } },
  });

  if (!analysis) notFound();

  if (analysis.status === "PENDING" || analysis.status === "PROCESSING") {
    return <ProcessingScreen analysisId={id} />;
  }

  // Nur wenn es noch NIE ein erfolgreiches Ergebnis gab, ist die Analyse
  // wirklich fehlgeschlagen. Scheitert dagegen nur eine spätere Anreicherung
  // (z.B. nach der Besichtigung), bleibt die letzte gute Version weiterhin
  // sichtbar – siehe Fehlerhinweis weiter unten.
  if (analysis.results.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-medium mb-2">Analyse fehlgeschlagen</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {analysis.errorMessage ?? "Es ist ein unbekannter Fehler aufgetreten."}
        </p>
      </div>
    );
  }

  const requestedVersion = v ? Number(v) : analysis.results.length;
  const result =
    analysis.results.find((r) => r.version === requestedVersion) ??
    analysis.results[analysis.results.length - 1];
  const report = analysisReportSchema.parse(result.payload);

  return (
    <div>
      {analysis.status === "ERROR" && (
        <div className="mx-auto max-w-3xl px-4 pt-6 no-print">
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 text-sm">
            Die letzte Aktualisierung ist fehlgeschlagen ({analysis.errorMessage}). Die
            zuletzt erfolgreich erstellte Version wird unten angezeigt.
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl px-4 pt-6 flex flex-wrap items-center gap-3 no-print">
        <a
          href={`/api/analyses/${id}/pdf?v=${result.version}`}
          className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium"
        >
          Als PDF herunterladen
        </a>
        <Link
          href={`/analyse/${id}/anreichern`}
          className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 text-sm font-medium"
        >
          Mit Besichtigungsergebnissen anreichern
        </Link>
        {analysis.results.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60 ml-auto">
            Version:
            {analysis.results.map((r) => (
              <Link
                key={r.version}
                href={`/analyse/${id}?v=${r.version}`}
                className={
                  r.version === result.version
                    ? "font-semibold text-black dark:text-white"
                    : "underline"
                }
              >
                {r.version}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Report
        report={report}
        analysisId={id}
        createdAt={result.createdAt}
        changeSummary={result.changeSummary}
      />
    </div>
  );
}
