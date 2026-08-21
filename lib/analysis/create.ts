import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { generateAnalysisId } from "@/lib/id";
import { stosseAnalyseAn } from "./anstossen";
import { normalisiereEmail } from "@/lib/auth/session";

/**
 * Obergrenze für das Exposé. Große Dateien treiben die Tokenkosten und
 * damit direkt unsere Kosten je Analyse – 15 MB reichen für jedes reale
 * Exposé mit Fotos.
 */
const MAX_EXPOSE_BYTES = 15 * 1024 * 1024;

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
  /** Angemeldeter Nutzer, falls vorhanden – dann gehört die Analyse zum Konto. */
  userId?: string,
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
  if (expose.size > MAX_EXPOSE_BYTES) {
    return {
      ok: false,
      error: `Das Exposé ist zu groß (maximal ${MAX_EXPOSE_BYTES / 1024 / 1024} MB).`,
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

  // Ohne Konto bleibt userId leer: Das ist der kostenlose Teaser, der nach
  // 14 Tagen gelöscht wird. Meldet sich derselbe Mensch später mit dieser
  // Adresse an, wird die Analyse seinem Konto zugeordnet (siehe
  // loeseMagicLinkEin).
  await prisma.analysis.create({
    data: {
      id,
      userId: userId ?? null,
      email: normalisiereEmail(parsed.data.email),
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

  // Die Auswertung läuft in einer eigenen Hintergrundroute, nicht in diesem
  // Aufruf – siehe anstossen.ts. Fehler hält die Pipeline selbst als
  // Analysis.status = ERROR fest.
  await stosseAnalyseAn(id);

  return { ok: true, id };
}
