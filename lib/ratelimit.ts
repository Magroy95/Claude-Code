// Missbrauchsschutz für Endpunkte, die Geld kosten.
//
// Eine Analyse löst sieben Modellaufrufe aus und kostet uns knapp einen
// Euro. Ein offener POST-Endpunkt ohne Bremse ist damit keine theoretische
// Lücke, sondern eine Rechnung, die über Nacht entsteht – und der
// Anmeldeendpunkt verschickt Mails, taugt also zum Zumüllen fremder
// Postfächer.
//
// Umsetzung bewusst in der Datenbank statt im Arbeitsspeicher: Auf Vercel
// läuft jede Anfrage potenziell in einer eigenen Instanz, ein Zähler im
// Prozess wäre dort wirkungslos. Redis wäre schneller, aber ein weiterer
// Dienst mit eigenem Auftragsverarbeitungsvertrag; solange die Last klein
// ist, reicht Postgres.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export interface Limit {
  /** Erlaubte Anfragen im Zeitfenster. */
  anzahl: number;
  /** Länge des Zeitfensters in Sekunden. */
  fensterSekunden: number;
}

export const LIMITS = {
  /** Analysen sind teuer – hier zählt jeder Aufruf. */
  analyseStarten: { anzahl: 5, fensterSekunden: 60 * 60 },
  /** Anmeldelinks verschicken Mails an fremde Adressen. */
  anmeldelink: { anzahl: 5, fensterSekunden: 15 * 60 },
  /** Zahlungsvorgänge: großzügiger, aber nicht unbegrenzt. */
  kaufStarten: { anzahl: 20, fensterSekunden: 60 * 60 },
} satisfies Record<string, Limit>;

/**
 * IP-Adressen werden nur als Hash gespeichert. Für die Zählung reicht das,
 * und der Datensatz enthält damit kein personenbezogenes Klartextmerkmal.
 */
function schluessel(bereich: string, kennung: string): string {
  return createHash("sha256").update(`${bereich}:${kennung}`).digest("hex");
}

export function ermittleIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unbekannt";
}

export interface LimitErgebnis {
  erlaubt: boolean;
  /** Sekunden bis zum nächsten erlaubten Versuch. Nur wenn nicht erlaubt. */
  erneutInSekunden: number;
}

/**
 * Zählt eine Anfrage und meldet, ob sie noch im Rahmen liegt. Fällt die
 * Datenbank aus, wird die Anfrage durchgelassen – ein kaputter
 * Missbrauchsschutz darf den Dienst nicht lahmlegen. Das ist eine bewusste
 * Abwägung: Verfügbarkeit vor Sparsamkeit, weil der Fehlerfall selten ist
 * und die Kosten begrenzt bleiben.
 */
export async function pruefeLimit(
  bereich: keyof typeof LIMITS,
  kennung: string,
): Promise<LimitErgebnis> {
  const limit = LIMITS[bereich];
  const key = schluessel(bereich, kennung);
  const fensterBeginn = new Date(Date.now() - limit.fensterSekunden * 1000);

  try {
    await prisma.rateLimitEreignis.deleteMany({
      where: { key, createdAt: { lt: fensterBeginn } },
    });
    const bisher = await prisma.rateLimitEreignis.count({
      where: { key, createdAt: { gte: fensterBeginn } },
    });
    if (bisher >= limit.anzahl) {
      const aeltestes = await prisma.rateLimitEreignis.findFirst({
        where: { key, createdAt: { gte: fensterBeginn } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const frei = aeltestes
        ? Math.ceil(
            (aeltestes.createdAt.getTime() + limit.fensterSekunden * 1000 - Date.now()) / 1000,
          )
        : limit.fensterSekunden;
      return { erlaubt: false, erneutInSekunden: Math.max(frei, 1) };
    }
    await prisma.rateLimitEreignis.create({ data: { key } });
    return { erlaubt: true, erneutInSekunden: 0 };
  } catch (fehler) {
    console.error("[HauskaufChecker] Rate-Limit-Prüfung fehlgeschlagen:", fehler);
    return { erlaubt: true, erneutInSekunden: 0 };
  }
}

/** Menschenlesbare Wartezeit für die Fehlermeldung. */
export function warteText(sekunden: number): string {
  if (sekunden < 90) return "einer Minute";
  const minuten = Math.ceil(sekunden / 60);
  if (minuten < 60) return `${minuten} Minuten`;
  const stunden = Math.ceil(minuten / 60);
  return stunden === 1 ? "einer Stunde" : `${stunden} Stunden`;
}
