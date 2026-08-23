import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { analysisReportSchema } from "@/lib/analysis/schema";
import { EnrichForm } from "@/app/components/EnrichForm";

/**
 * Aktualisierung nach der Besichtigung.
 *
 * Vorerst nicht Teil des Leistungsumfangs – weder im Einzelkauf noch im
 * Paket. Der Weg ist bewusst nur gesperrt und nicht gelöscht: Die
 * Impact-Pipeline dahinter funktioniert und soll in einer späteren
 * Ausbaustufe wieder freigeschaltet werden. Bis dahin wäre ein erreichbares
 * Formular ein Versprechen, das die AGB nicht decken.
 */
const AKTUALISIERUNG_FREIGESCHALTET = false;

export default async function AnreichernPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!AKTUALISIERUNG_FREIGESCHALTET) notFound();

  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { results: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!analysis) notFound();

  if (analysis.results.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-medium mb-2">Noch nicht bereit</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Diese Analyse ist aktuell nicht abgeschlossen und kann noch nicht
          angereichert werden.
        </p>
      </div>
    );
  }

  if (analysis.status === "PENDING" || analysis.status === "PROCESSING") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-medium mb-2">Bitte kurz warten</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Diese Analyse wird gerade aktualisiert. Die Anreicherung ist wieder
          möglich, sobald der aktuelle Lauf abgeschlossen ist.
        </p>
      </div>
    );
  }

  const report = analysisReportSchema.parse(analysis.results[0].payload);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold mb-2">
        Besichtigungsergebnisse eintragen
      </h1>
      <p className="text-sm text-black/60 dark:text-white/60 mb-8">
        Beantworten Sie die offenen Fragen aus Ihrer Analyse ({id}) – so genau wie möglich.
        Anschließend überarbeiten wir den Report und zeigen Ihnen, was sich durch Ihre neuen
        Informationen ändert.
      </p>
      <EnrichForm analysisId={id} hypothesen={report.hypothesen} />
    </div>
  );
}
