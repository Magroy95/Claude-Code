import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { generateAnalysisId } from "@/lib/id";
import { runAnalysisPipeline } from "./pipeline";

const ALLOWED_EXPOSE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const createAnalysisInput = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse angeben."),
  eigenkapital: z.coerce
    .number()
    .int()
    .nonnegative("Eigenkapital darf nicht negativ sein."),
  verkaufsart: z.enum(["MAKLER", "PRIVAT"]),
  freitext: z.string().max(4000).optional(),
  consent: z.literal("on", {
    message: "Bitte die Datenschutzhinweise bestätigen.",
  }),
});

export type CreateAnalysisResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createAnalysisFromForm(
  formData: FormData,
): Promise<CreateAnalysisResult> {
  const expose = formData.get("expose");
  if (!(expose instanceof File) || expose.size === 0) {
    return { ok: false, error: "Bitte ein Exposé hochladen." };
  }
  if (!ALLOWED_EXPOSE_TYPES.has(expose.type)) {
    return {
      ok: false,
      error: "Exposé muss ein PDF oder Bild (PNG/JPEG/WebP) sein.",
    };
  }

  const parsed = createAnalysisInput.safeParse({
    email: formData.get("email"),
    eigenkapital: formData.get("eigenkapital"),
    verkaufsart: formData.get("verkaufsart"),
    freitext: formData.get("freitext") || undefined,
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const id = generateAnalysisId();
  const buffer = Buffer.from(await expose.arrayBuffer());
  const storageKey = await storage.save({
    buffer,
    fileName: expose.name,
    mimeType: expose.type,
    namespace: id,
  });

  await prisma.analysis.create({
    data: {
      id,
      email: parsed.data.email,
      eigenkapital: parsed.data.eigenkapital,
      verkaufsart: parsed.data.verkaufsart,
      freitext: parsed.data.freitext || null,
      attachments: {
        create: {
          kind: "EXPOSE",
          storageKey,
          fileName: expose.name,
          mimeType: expose.type,
        },
      },
    },
  });

  // Läuft im Hintergrund weiter; Fehler werden in der Pipeline selbst als
  // Analysis.status = ERROR festgehalten.
  void runAnalysisPipeline(id);

  return { ok: true, id };
}
