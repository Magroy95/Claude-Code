// Wer darf welchen Report vollständig sehen.
//
// Zwei Produkte: Ein Einzelkauf schaltet genau eine Analyse frei, ein Paket
// für drei Monate alle Analysen in diesem Zeitraum. Der kostenlose Teaser ist
// davon unberührt und immer sichtbar – er ist das, was Vertrauen aufbaut,
// bevor jemand zahlt.
//
// Die Freischaltung wird auf der Analyse selbst vermerkt (Analysis.
// freigeschaltet) und nicht bei jedem Aufruf neu aus den Berechtigungen
// hergeleitet. Grund: Ein einmal bezahlter Report muss bezahlt bleiben, auch
// wenn das Paket später ausläuft. Alles andere wäre gegenüber dem Käufer
// nicht vertretbar.

import { prisma } from "@/lib/db/prisma";

export const PREIS_EINZEL_CENT = 399;
export const PREIS_PAKET_CENT = 5900;
export const PAKET_LAUFZEIT_TAGE = 90;

export const PRODUKT = {
  SINGLE: {
    kind: "SINGLE" as const,
    bezeichnung: "Einzelanalyse",
    beschreibung: "Ein vollständiger Report für ein Haus",
    betragCent: PREIS_EINZEL_CENT,
  },
  PAKET_3M: {
    kind: "PAKET_3M" as const,
    bezeichnung: "Paket für 3 Monate",
    beschreibung: "Beliebig viele Häuser, 3 Monate lang",
    betragCent: PREIS_PAKET_CENT,
  },
};

/** Formatiert Cent als Preisangabe. */
export function formatPreis(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/**
 * Ein laufendes Paket deckt jede Analyse ab, ohne verbraucht zu werden.
 */
export async function hatLaufendesPaket(userId: string): Promise<boolean> {
  const paket = await prisma.entitlement.findFirst({
    where: { userId, kind: "PAKET_3M", validUntil: { gt: new Date() } },
  });
  return paket !== null;
}

/**
 * Ein noch nicht eingelöster Einzelkauf. null, wenn keiner offen ist.
 */
export async function offenerEinzelkauf(userId: string): Promise<{ id: string } | null> {
  return prisma.entitlement.findFirst({
    where: { userId, kind: "SINGLE", verbrauchtFuerAnalysisId: null },
    select: { id: true },
  });
}

/**
 * Schaltet eine Analyse frei, wenn der Nutzer dazu berechtigt ist. Ein
 * laufendes Paket hat Vorrang vor einem Einzelkauf – sonst würde ein
 * Einzelkauf unnötig verbraucht, obwohl das Paket ohnehin deckt.
 */
export async function schalteFrei(
  analysisId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; grund: "NICHT_BERECHTIGT" | "FREMDE_ANALYSE" }> {
  const analyse = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { userId: true, freigeschaltet: true },
  });
  if (!analyse) return { ok: false, grund: "FREMDE_ANALYSE" };
  if (analyse.userId !== null && analyse.userId !== userId) {
    return { ok: false, grund: "FREMDE_ANALYSE" };
  }
  if (analyse.freigeschaltet) return { ok: true };

  if (await hatLaufendesPaket(userId)) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { freigeschaltet: true, userId },
    });
    return { ok: true };
  }

  const einzel = await offenerEinzelkauf(userId);
  if (!einzel) return { ok: false, grund: "NICHT_BERECHTIGT" };

  await prisma.$transaction([
    prisma.entitlement.update({
      where: { id: einzel.id },
      data: { verbrauchtFuerAnalysisId: analysisId },
    }),
    prisma.analysis.update({
      where: { id: analysisId },
      data: { freigeschaltet: true, userId },
    }),
  ]);
  return { ok: true };
}

/** Was der Nutzer aktuell an Guthaben hat – für die Anzeige im Konto. */
export async function berechtigungsUebersicht(userId: string): Promise<{
  paketLaeuftBis: Date | null;
  offeneEinzelkaeufe: number;
}> {
  const [paket, einzel] = await Promise.all([
    prisma.entitlement.findFirst({
      where: { userId, kind: "PAKET_3M", validUntil: { gt: new Date() } },
      orderBy: { validUntil: "desc" },
      select: { validUntil: true },
    }),
    prisma.entitlement.count({
      where: { userId, kind: "SINGLE", verbrauchtFuerAnalysisId: null },
    }),
  ]);
  return { paketLaeuftBis: paket?.validUntil ?? null, offeneEinzelkaeufe: einzel };
}
