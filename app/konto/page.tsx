import Link from "next/link";
import { redirect } from "next/navigation";
import { aktuellerNutzer } from "@/lib/auth/session";
import { berechtigungsUebersicht, formatPreis, PRODUKT } from "@/lib/auth/berechtigung";
import { prisma } from "@/lib/db/prisma";
import { KontoAktionen } from "@/app/components/KontoAktionen";
import type { AnalysisReport } from "@/lib/analysis/schema";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meine Häuser",
  description: "Ihre bisherigen Analysen im Überblick.",
};

const AMPEL_TEXT: Record<string, { label: string; klasse: string }> = {
  GRUEN: { label: "Niedriger Klärungsbedarf", klasse: "bg-emerald-600" },
  GELB: { label: "Mittlerer Klärungsbedarf", klasse: "bg-amber-500" },
  ROT: { label: "Hoher Klärungsbedarf", klasse: "bg-red-700" },
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "In der Warteschlange",
  PROCESSING: "Wird ausgewertet …",
  DONE: "Fertig",
  ERROR: "Fehlgeschlagen",
};

function formatEur(cent: number): string {
  return cent.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default async function Konto() {
  const nutzer = await aktuellerNutzer();
  if (!nutzer) redirect("/anmelden");

  const [analysen, uebersicht] = await Promise.all([
    prisma.analysis.findMany({
      where: { userId: nutzer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        freigeschaltet: true,
        createdAt: true,
        results: { orderBy: { version: "desc" }, take: 1, select: { payload: true } },
      },
    }),
    berechtigungsUebersicht(nutzer.id),
  ]);

  const zeilen = analysen.map((a) => {
    // Der Report liegt als JSON in der Datenbank; für die Übersicht brauchen
    // wir nur drei Felder daraus, deshalb bewusst ohne vollständiges Parsen.
    const report = a.results[0]?.payload as unknown as AnalysisReport | undefined;
    return {
      id: a.id,
      status: a.status,
      freigeschaltet: a.freigeschaltet,
      createdAt: a.createdAt,
      adresse: report?.objektdaten.adresseOderLage ?? null,
      preis: report?.objektdaten.angebotspreisEur ?? null,
      ampel: report?.ampel ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Meine Häuser</h1>
          <p className="mt-1 text-sm opacity-70">{nutzer.email}</p>
        </div>
        {/* Zielt auf das Formular, nicht auf die Abrufseite: Wer hier klickt,
            will ein neues Haus prüfen, nicht ein altes wiederfinden. */}
        <Link
          href="/#start"
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Neues Haus prüfen
        </Link>
      </header>

      {/* Guthaben zuerst: Wer etwas gekauft hat, will sehen, dass es da ist.

          Die Produktnamen beginnen mit "Der". Im Fliesstext aneinandergereiht
          ergibt das mitten im Satz ein grossgeschriebenes "Der", deshalb steht
          der leere Fall unten als Aufzaehlung mit Doppelpunkt. */}
      <section className="mt-8 rounded border border-current/15 p-4 text-sm">
        {uebersicht.paketLaeuftBis ? (
          <p>
            <strong>{PRODUKT.PAKET_3M.bezeichnung}</strong> aktiv — beliebig viele Häuser bis{" "}
            {uebersicht.paketLaeuftBis.toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
        ) : uebersicht.offeneEinzelkaeufe > 0 ? (
          <p>
            <strong>
              {uebersicht.offeneEinzelkaeufe}{" "}
              {uebersicht.offeneEinzelkaeufe === 1 ? "Einzelanalyse" : "Einzelanalysen"}
            </strong>{" "}
            noch nicht eingelöst.
          </p>
        ) : (
          <p className="opacity-80">
            Kein Guthaben. {PRODUKT.SINGLE.bezeichnung}:{" "}
            {formatPreis(PRODUKT.SINGLE.betragCent)} · {PRODUKT.PAKET_3M.bezeichnung}:{" "}
            {formatPreis(PRODUKT.PAKET_3M.betragCent)}.{" "}
            <Link href="/preise" className="underline">
              Preise ansehen
            </Link>
          </p>
        )}
      </section>

      {zeilen.length === 0 ? (
        <p className="mt-10 text-sm leading-relaxed opacity-80">
          Hier erscheinen Ihre Analysen, sobald Sie ein Haus geprüft haben. Der erste Blick auf ein
          Exposé ist kostenlos.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-current/10 border-y border-current/10">
          {zeilen.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
              <div className="min-w-0 flex-1">
                <Link href={`/analyse/${z.id}`} className="font-medium hover:underline">
                  {z.adresse ?? z.id}
                </Link>
                <p className="mt-0.5 text-xs opacity-65">
                  {z.createdAt.toLocaleDateString("de-DE")} · {z.id}
                  {z.preis !== null && <> · {formatEur(z.preis)}</>}
                  {!z.freigeschaltet && z.status === "DONE" && <> · Kurzfassung</>}
                </p>
              </div>
              {z.status !== "DONE" ? (
                <span className="text-xs opacity-70">{STATUS_TEXT[z.status]}</span>
              ) : z.ampel ? (
                <span className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${AMPEL_TEXT[z.ampel]?.klasse ?? ""}`}
                  />
                  {AMPEL_TEXT[z.ampel]?.label ?? z.ampel}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <KontoAktionen />
    </main>
  );
}
