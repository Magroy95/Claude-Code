// Löschkonzept – als ausführbare Regel statt als Absichtserklärung.
//
// Wir verarbeiten fremde Exposés: Adressen, Kaufpreise, Grundrisse, teils
// Angaben zu den Verkäufern. Das sind Daten Dritter, die uns der Nutzer
// anvertraut, und für die es keinen Grund gibt, sie länger zu halten als
// nötig. Die Fristen unten sind deshalb bewusst knapp bemessen und werden
// von einem Job durchgesetzt, nicht von gutem Willen.
//
// Aufbewahrungsfristen und ihre Begründung:
//
// | Daten                        | Frist        | Grund                                  |
// |------------------------------|--------------|----------------------------------------|
// | Exposé-Datei                 | 90 Tage      | Wiederholungslauf, Rückfragen          |
// | Report und Objektdaten       | Kontodauer   | Das ist das gekaufte Produkt           |
// | Analyse ohne Konto (Teaser)  | 14 Tage      | Kein Vertrag, kein Grund zu behalten   |
// | Abgelaufene Sitzungen        | sofort       | Wertlos                                |
// | Verbrauchte Anmeldelinks     | 7 Tage       | Nur zur Fehlersuche                    |
// | Konto nach Löschanforderung  | 30 Tage      | Widerrufsfenster bei Irrtum            |
// | Messereignisse               | 365 Tage     | Zeitraumvergleich, danach wertlos      |
// | Bestellungen und Belege      | 8 Jahre      | § 147 AO                               |
//
// Bestellungen bleiben bewusst erhalten, auch wenn das Konto verschwindet:
// Steuerrechtliche Aufbewahrung geht der Löschung vor (Art. 17 Abs. 3 lit. b
// DSGVO). Sie enthalten Betrag, Datum und E-Mail – aber keinen Reportinhalt.

import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { BEISPIEL_ANALYSE_ID } from "@/lib/beispiel";

export const FRIST_EXPOSE_TAGE = 90;
export const FRIST_TEASER_TAGE = 14;
export const FRIST_MAGICLINK_TAGE = 7;
export const FRIST_KONTO_LOESCHUNG_TAGE = 30;
/**
 * Messereignisse. Ein Jahr, damit sich Zeiträume vergleichen lassen –
 * darüber hinaus haben sie keinen Wert und würden nur noch Bestand sein.
 */
export const FRIST_EREIGNISSE_TAGE = 365;

function vorTagen(tage: number): Date {
  return new Date(Date.now() - tage * 24 * 60 * 60_000);
}

export interface LoeschBericht {
  exposeDateien: number;
  teaserAnalysen: number;
  sitzungen: number;
  anmeldelinks: number;
  konten: number;
  ereignisse: number;
  fehler: string[];
}

/**
 * Entfernt die Exposé-Dateien älterer Analysen. Der Report bleibt bestehen –
 * er ist das Produkt. Weg muss nur das Ausgangsdokument, das die meisten
 * personenbezogenen Daten Dritter enthält.
 */
async function loescheAlteExposes(bericht: LoeschBericht): Promise<void> {
  const alt = await prisma.attachment.findMany({
    where: { kind: "EXPOSE", createdAt: { lt: vorTagen(FRIST_EXPOSE_TAGE) } },
    select: { id: true, storageKey: true },
  });
  for (const datei of alt) {
    try {
      await storage.delete(datei.storageKey);
      await prisma.attachment.delete({ where: { id: datei.id } });
      bericht.exposeDateien += 1;
    } catch (fehler) {
      // Eine fehlende Datei ist kein Grund, den ganzen Lauf abzubrechen –
      // der Datenbankeintrag muss trotzdem weg.
      bericht.fehler.push(`Exposé ${datei.id}: ${String(fehler)}`);
      await prisma.attachment.delete({ where: { id: datei.id } }).catch(() => {});
    }
  }
}

/**
 * Analysen ohne Konto sind der kostenlose Teaser. Ohne Vertragsverhältnis
 * gibt es keinen Grund, sie zu behalten.
 */
async function loescheTeaser(bericht: LoeschBericht): Promise<void> {
  // Der öffentliche Beispielreport ist technisch ein Teaser: keine
  // Zuordnung zu einem Konto, nur freigeschaltet. Ohne diese Ausnahme
  // würde der Job ihn nach der Frist wegräumen und das Versprechen auf der
  // Startseite ins Leere laufen lassen.
  const alt = await prisma.analysis.findMany({
    where: {
      userId: null,
      createdAt: { lt: vorTagen(FRIST_TEASER_TAGE) },
      ...(BEISPIEL_ANALYSE_ID ? { id: { not: BEISPIEL_ANALYSE_ID } } : {}),
    },
    select: { id: true, attachments: { select: { storageKey: true } } },
  });
  for (const analyse of alt) {
    for (const datei of analyse.attachments) {
      await storage.delete(datei.storageKey).catch((f) => {
        bericht.fehler.push(`Teaser-Datei ${datei.storageKey}: ${String(f)}`);
      });
    }
    // Anhänge, Ergebnisse und Antworten hängen per Cascade an der Analyse.
    await prisma.analysis.delete({ where: { id: analyse.id } });
    bericht.teaserAnalysen += 1;
  }
}

/**
 * Konten, deren Löschung angefordert wurde und deren Nachfrist abgelaufen
 * ist. Die Bestellungen werden vorher vom Konto gelöst, damit sie die
 * steuerliche Aufbewahrung überdauern.
 */
async function loescheKonten(bericht: LoeschBericht): Promise<void> {
  const faellig = await prisma.user.findMany({
    where: { deletedAt: { lt: vorTagen(FRIST_KONTO_LOESCHUNG_TAGE) } },
    select: {
      id: true,
      analyses: { select: { attachments: { select: { storageKey: true } } } },
    },
  });
  for (const nutzer of faellig) {
    for (const analyse of nutzer.analyses) {
      for (const datei of analyse.attachments) {
        await storage.delete(datei.storageKey).catch((f) => {
          bericht.fehler.push(`Konto-Datei ${datei.storageKey}: ${String(f)}`);
        });
      }
    }
    await prisma.user.delete({ where: { id: nutzer.id } });
    bericht.konten += 1;
  }
}

/**
 * Ein Durchlauf über alle Fristen. Idempotent – mehrfaches Ausführen
 * schadet nicht.
 */
export async function fuehreLoeschungenDurch(): Promise<LoeschBericht> {
  const bericht: LoeschBericht = {
    exposeDateien: 0,
    teaserAnalysen: 0,
    sitzungen: 0,
    anmeldelinks: 0,
    konten: 0,
    ereignisse: 0,
    fehler: [],
  };

  const sitzungen = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  bericht.sitzungen = sitzungen.count;

  const links = await prisma.magicLink.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: vorTagen(FRIST_MAGICLINK_TAGE) } },
        { usedAt: { lt: vorTagen(FRIST_MAGICLINK_TAGE) } },
      ],
    },
  });
  bericht.anmeldelinks = links.count;

  const ereignisse = await prisma.ereignis.deleteMany({
    where: { createdAt: { lt: vorTagen(FRIST_EREIGNISSE_TAGE) } },
  });
  bericht.ereignisse = ereignisse.count;

  await loescheAlteExposes(bericht);
  await loescheTeaser(bericht);
  await loescheKonten(bericht);

  return bericht;
}

/**
 * Löschung durch den Nutzer selbst. Setzt nur die Markierung – die
 * eigentliche Löschung übernimmt der Job nach der Nachfrist. So bleibt ein
 * versehentlicher Klick eine Woche lang korrigierbar, ohne dass wir die
 * Zusage brechen.
 */
export async function fordereKontoLoeschungAn(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    // Sofort abmelden: Ab jetzt kommt niemand mehr an die Daten.
    prisma.session.deleteMany({ where: { userId } }),
    prisma.magicLink.deleteMany({ where: { userId } }),
  ]);
}

/** Einzelne Analyse löschen – jederzeit, ohne Frist. */
export async function loescheAnalyse(analysisId: string, userId: string): Promise<boolean> {
  const analyse = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { userId: true, attachments: { select: { storageKey: true } } },
  });
  if (!analyse || analyse.userId !== userId) return false;
  for (const datei of analyse.attachments) {
    await storage.delete(datei.storageKey).catch(() => {});
  }
  await prisma.analysis.delete({ where: { id: analysisId } });
  return true;
}

/**
 * Datenauskunft nach Art. 15 DSGVO als maschinenlesbarer Export. Bewusst
 * vollständig: Konto, Käufe, Analysen samt Reports.
 */
export async function exportiereNutzerdaten(userId: string): Promise<unknown> {
  const nutzer = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: true,
      entitlements: true,
      analyses: {
        include: {
          results: true,
          answers: true,
          attachments: { select: { fileName: true, mimeType: true, createdAt: true } },
        },
      },
    },
  });
  if (!nutzer) return null;
  return {
    hinweis:
      "Export Ihrer bei HauskaufChecker gespeicherten Daten nach Art. 15 DSGVO. " +
      "Die hochgeladenen Exposé-Dateien selbst sind nicht enthalten, nur ihre Metadaten.",
    erstelltAm: new Date().toISOString(),
    konto: { id: nutzer.id, email: nutzer.email, angelegtAm: nutzer.createdAt },
    bestellungen: nutzer.orders,
    berechtigungen: nutzer.entitlements,
    analysen: nutzer.analyses,
  };
}
