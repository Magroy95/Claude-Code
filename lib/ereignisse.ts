// Ablaufmessung.
//
// Ohne zu wissen, wo Leute abspringen, ist ein Livegang nur ein Deploy. Die
// Fragen, die der Test beantworten muss, sind überschaubar:
//
//   Wie viele laden ein Exposé hoch?
//   Wie viele bekommen einen fertigen Report?
//   Wie viele sehen die Bezahlschranke?
//   Wie viele melden sich daraufhin an?
//   Wie viele kaufen?
//   Fanden sie den Report hilfreich?
//
// Dafür genügt ein Zähler in der eigenen Datenbank. Ein externes Werkzeug
// wäre bequemer, brächte aber einen weiteren Auftragsverarbeitungsvertrag,
// einen Empfänger mehr in der Datenschutzerklärung und – sobald es
// Wiedererkennung nutzt – ein Cookie-Banner.
//
// Gespeichert wird deshalb nur der Ereignisname und, wo vorhanden, die
// Analyse-ID. Keine IP-Adresse, keine Browserkennung, keine Verweisquelle,
// keine Sitzungsverknüpfung. Damit lässt sich zählen, aber niemand
// wiedererkennen.

import { prisma } from "@/lib/db/prisma";

export const EREIGNIS = {
  ANALYSE_GESTARTET: "analyse_gestartet",
  ANALYSE_FERTIG: "analyse_fertig",
  ANALYSE_FEHLGESCHLAGEN: "analyse_fehlgeschlagen",
  SCHRANKE_GESEHEN: "schranke_gesehen",
  KAUF_GESTARTET: "kauf_gestartet",
  KAUF_ABGESCHLOSSEN: "kauf_abgeschlossen",
  ANMELDUNG_ANGEFORDERT: "anmeldung_angefordert",
  ANMELDUNG_ABGESCHLOSSEN: "anmeldung_abgeschlossen",
  REPORT_HILFREICH: "report_hilfreich",
  REPORT_NICHT_HILFREICH: "report_nicht_hilfreich",
} as const;

export type EreignisName = (typeof EREIGNIS)[keyof typeof EREIGNIS];

const ERLAUBTE_NAMEN = new Set<string>(Object.values(EREIGNIS));

export function istErlaubtesEreignis(name: string): name is EreignisName {
  return ERLAUBTE_NAMEN.has(name);
}

/**
 * Hält ein Ereignis fest. Schlägt das fehl, wird es protokolliert und sonst
 * nichts – eine Messung darf niemals den Vorgang stören, den sie misst.
 */
export async function halteFest(name: EreignisName, analysisId?: string): Promise<void> {
  try {
    await prisma.ereignis.create({ data: { name, analysisId: analysisId ?? null } });
  } catch (fehler) {
    console.error(`[HauskaufChecker] Ereignis "${name}" nicht festgehalten:`, fehler);
  }
}

export interface Trichterstufe {
  name: string;
  anzahl: number;
  /** Anteil an der Stufe davor, in Prozent. null bei der ersten Stufe. */
  anteilVorstufe: number | null;
}

/**
 * Der Trichter über einen Zeitraum. Die Reihenfolge bildet den Weg ab, den
 * ein Nutzer nimmt – so ist auf einen Blick sichtbar, wo er abbricht.
 */
export async function holeTrichter(seitTagen = 30): Promise<Trichterstufe[]> {
  const seit = new Date(Date.now() - seitTagen * 24 * 60 * 60_000);
  const roh = await prisma.ereignis.groupBy({
    by: ["name"],
    where: { createdAt: { gte: seit } },
    _count: { name: true },
  });
  const zahl = (n: string) => roh.find((r) => r.name === n)?._count.name ?? 0;

  const stufen: { name: string; anzahl: number }[] = [
    { name: "Analyse gestartet", anzahl: zahl(EREIGNIS.ANALYSE_GESTARTET) },
    { name: "Report fertig", anzahl: zahl(EREIGNIS.ANALYSE_FERTIG) },
    { name: "Bezahlschranke gesehen", anzahl: zahl(EREIGNIS.SCHRANKE_GESEHEN) },
    { name: "Anmeldung angefordert", anzahl: zahl(EREIGNIS.ANMELDUNG_ANGEFORDERT) },
    { name: "Kauf gestartet", anzahl: zahl(EREIGNIS.KAUF_GESTARTET) },
    { name: "Kauf abgeschlossen", anzahl: zahl(EREIGNIS.KAUF_ABGESCHLOSSEN) },
  ];

  return stufen.map((s, i) => {
    const vor = i > 0 ? stufen[i - 1]!.anzahl : 0;
    return {
      ...s,
      anteilVorstufe: i === 0 || vor === 0 ? null : Math.round((s.anzahl / vor) * 100),
    };
  });
}

export async function holeRueckmeldungen(seitTagen = 30): Promise<{ hilfreich: number; nicht: number }> {
  const seit = new Date(Date.now() - seitTagen * 24 * 60 * 60_000);
  const [hilfreich, nicht] = await Promise.all([
    prisma.ereignis.count({ where: { name: EREIGNIS.REPORT_HILFREICH, createdAt: { gte: seit } } }),
    prisma.ereignis.count({
      where: { name: EREIGNIS.REPORT_NICHT_HILFREICH, createdAt: { gte: seit } },
    }),
  ]);
  return { hilfreich, nicht };
}
