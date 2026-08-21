import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { analysisReportSchema } from "@/lib/analysis/schema";
import { Report } from "@/app/components/Report";
import { ProcessingScreen } from "@/app/components/ProcessingScreen";
import { RetryAnalysisButton } from "@/app/components/RetryAnalysisButton";
import { aktuellerNutzer } from "@/lib/auth/session";
import { formatPreis, PRODUKT, schalteFrei } from "@/lib/auth/berechtigung";
import { pruefePdfToken } from "@/lib/pdf/token";

export const dynamic = "force-dynamic";

export default async function AnalysePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; kauf?: string; pdf?: string }>;
}) {
  const { id } = await params;
  const { v, kauf, pdf } = await searchParams;

  const nutzer = await aktuellerNutzer();
  // Der druckende Browser hat keine Sitzung und weist sich stattdessen mit
  // einem kurzlebigen, signierten Token aus, das die PDF-Route nach der
  // Rechteprüfung ausgestellt hat.
  const alsPdf = pruefePdfToken(id, pdf ?? null);

  // Kehrt der Nutzer aus dem Bezahlvorgang zurück, ist die Buchung durch den
  // Webhook in aller Regel schon erfolgt. Falls der Webhook noch unterwegs
  // ist, versuchen wir hier zusätzlich freizuschalten – das ist idempotent
  // und verhindert, dass jemand nach erfolgreicher Zahlung vor einer
  // verschlossenen Tür steht.
  if (kauf === "ok" && nutzer) {
    await schalteFrei(id, nutzer.id).catch(() => {});
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { results: { orderBy: { version: "asc" } } },
  });

  if (!analysis) notFound();

  // Eine Analyse, die zu einem Konto gehört, ist nur für dieses Konto
  // sichtbar. Analysen ohne Konto (kostenlose Kurzfassung) bleiben über die
  // ID erreichbar – sie enthalten nichts, was über die Ampel und die
  // Objektdaten hinausgeht.
  if (!alsPdf && analysis.userId !== null && analysis.userId !== nutzer?.id) {
    notFound();
  }

  if (analysis.status === "PENDING" || analysis.status === "PROCESSING") {
    return <ProcessingScreen analysisId={id} />;
  }

  // Nur wenn es noch NIE ein erfolgreiches Ergebnis gab, ist die Analyse
  // wirklich fehlgeschlagen. Scheitert dagegen nur eine spätere Anreicherung,
  // bleibt die letzte gute Version weiterhin sichtbar.
  if (analysis.results.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-medium mb-2">Die Auswertung ist fehlgeschlagen</h1>
        {/*
          Die technische Fehlermeldung bleibt bewusst im Log: Sie nennt
          Anbieter und Interna ("credit balance is too low") und hilft dem
          Nutzer nicht weiter. Was er braucht, ist der nächste Schritt.
        */}
        <p className="text-sm text-black/60 dark:text-white/60">
          Beim Auswerten des Exposés ist etwas schiefgegangen. Es wurde Ihnen nichts berechnet.
          Versuchen Sie es bitte erneut — klappt es dann immer noch nicht, melden Sie sich bei uns.
        </p>
        <RetryAnalysisButton analysisId={id} />
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
            Die letzte Aktualisierung ist fehlgeschlagen. Unten sehen Sie die zuletzt erfolgreich
            erstellte Fassung.
          </div>
        </div>
      )}
      {analysis.freigeschaltet && (
        <div className="mx-auto max-w-3xl px-4 pt-6 flex flex-wrap items-center gap-3 no-print">
          <a
            href={`/api/analyses/${id}/pdf?v=${result.version}`}
            className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium"
          >
            Als PDF herunterladen
          </a>
          {nutzer && (
            <Link
              href="/konto"
              className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 text-sm font-medium"
            >
              Meine Häuser
            </Link>
          )}
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
      )}
      <Report
        report={report}
        analysisId={id}
        createdAt={result.createdAt}
        changeSummary={result.changeSummary}
        freigeschaltet={analysis.freigeschaltet}
        angemeldet={nutzer !== null}
        preisEinzel={formatPreis(PRODUKT.SINGLE.betragCent)}
        preisPaket={formatPreis(PRODUKT.PAKET_3M.betragCent)}
      />
    </div>
  );
}
