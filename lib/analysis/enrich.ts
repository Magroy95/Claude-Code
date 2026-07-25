import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { analysisReportSchema } from "./schema";
import { runImpactPipeline } from "./pipeline";

export type EnrichResult = { ok: true } | { ok: false; error: string };

export async function createEnrichmentFromForm(
  analysisId: string,
  formData: FormData,
): Promise<EnrichResult> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { results: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!analysis || analysis.results.length === 0) {
    return { ok: false, error: "Analyse ist aktuell nicht bereit für eine Anreicherung." };
  }
  if (analysis.status === "PENDING" || analysis.status === "PROCESSING") {
    return { ok: false, error: "Diese Analyse wird gerade aktualisiert. Bitte kurz warten." };
  }

  const report = analysisReportSchema.parse(analysis.results[0].payload);
  const validKeys = new Set(report.hypothesen.map((h) => h.key));

  let anyAnswer = false;

  for (const hypothese of report.hypothesen) {
    const key = hypothese.key;
    if (!validKeys.has(key)) continue;
    const answerText = (formData.get(`answer_${key}`) as string | null)?.trim() || null;
    const files = formData
      .getAll(`files_${key}`)
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (!answerText && files.length === 0) continue;
    anyAnswer = true;

    const answer = await prisma.hypothesisAnswer.upsert({
      where: { analysisId_hypothesisKey: { analysisId, hypothesisKey: key } },
      create: {
        analysisId,
        hypothesisKey: key,
        question: hypothese.pruefragen.join(" "),
        answerText,
      },
      update: { answerText },
    });

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = await storage.save({
        buffer,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        namespace: analysisId,
      });
      const attachment = await prisma.attachment.create({
        data: {
          analysisId,
          kind: file.type.startsWith("image/") ? "BESICHTIGUNG_FOTO" : "BESICHTIGUNG_DOKUMENT",
          storageKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        },
      });
      await prisma.hypothesisAnswerAttachment.create({
        data: { hypothesisAnswerId: answer.id, attachmentId: attachment.id },
      });
    }
  }

  if (!anyAnswer) {
    return { ok: false, error: "Bitte mindestens eine Frage beantworten oder eine Datei hochladen." };
  }

  void runImpactPipeline(analysisId);

  return { ok: true };
}
