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
  GRUEN: { label: "Niedriger Klärungsbedarf", klasse: "gruen" },
  GELB: { label: "Mittlerer Klärungsbedarf", klasse: "gelb" },
  ROT: { label: "Hoher Klärungsbedarf", klasse: "rot" },
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
    <div className="lp-bahn mittel lp-seite">
      <header className="lp-seitenkopf">
        <div>
          <p className="lp-augenbraue">Ihr Konto</p>
          <h1 className="lp-h2" style={{ marginBottom: 0 }}>
            Meine Häuser
          </h1>
          <p className="lp-kennzeile">{nutzer.email}</p>
        </div>
        {/* Zielt auf das Formular, nicht auf die Abrufseite: Wer hier klickt,
            will ein neues Haus prüfen, nicht ein altes wiederfinden. */}
        <Link href="/#start" className="lp-knopf klein">
          Neues Haus prüfen
        </Link>
      </header>

      {/* Guthaben zuerst: Wer etwas gekauft hat, will sehen, dass es da ist.

          Die Produktnamen beginnen mit "Der". Im Fliesstext aneinandergereiht
          ergibt das mitten im Satz ein grossgeschriebenes "Der", deshalb steht
          der leere Fall unten als Aufzaehlung mit Doppelpunkt. */}
      <section className="lp-hinweis" style={{ marginTop: 0 }}>
        {uebersicht.paketLaeuftBis ? (
          <>
            <strong>{PRODUKT.PAKET_3M.bezeichnung}</strong> aktiv — beliebig viele Häuser bis{" "}
            {uebersicht.paketLaeuftBis.toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            .
          </>
        ) : uebersicht.offeneEinzelkaeufe > 0 ? (
          <>
            <strong>
              {uebersicht.offeneEinzelkaeufe}{" "}
              {uebersicht.offeneEinzelkaeufe === 1 ? "Einzelanalyse" : "Einzelanalysen"}
            </strong>{" "}
            noch nicht eingelöst.
          </>
        ) : (
          <>
            Kein Guthaben. {PRODUKT.SINGLE.bezeichnung}:{" "}
            {formatPreis(PRODUKT.SINGLE.betragCent)} · {PRODUKT.PAKET_3M.bezeichnung}:{" "}
            {formatPreis(PRODUKT.PAKET_3M.betragCent)}.{" "}
            <Link href="/preise" className="lp-textlink" style={{ fontSize: "inherit" }}>
              Preise ansehen
            </Link>
          </>
        )}
      </section>

      {zeilen.length === 0 ? (
        <p className="lp-text" style={{ marginTop: "38px" }}>
          Hier erscheinen Ihre Analysen, sobald Sie ein Haus geprüft haben. Der erste Blick auf ein
          Exposé ist kostenlos.
        </p>
      ) : (
        <ul className="lp-liste" style={{ marginTop: "34px" }}>
          {zeilen.map((z) => (
            <li key={z.id}>
              <div className="haupt">
                <Link href={`/analyse/${z.id}`}>{z.adresse ?? z.id}</Link>
                <p className="zusatz">
                  {z.createdAt.toLocaleDateString("de-DE")} · {z.id}
                  {z.preis !== null && <> · {formatEur(z.preis)}</>}
                  {!z.freigeschaltet && z.status === "DONE" && <> · Kurzfassung</>}
                </p>
              </div>
              {z.status !== "DONE" ? (
                <span className="lp-ampelmarke ohne">{STATUS_TEXT[z.status]}</span>
              ) : z.ampel ? (
                <span className={`lp-ampelmarke ${AMPEL_TEXT[z.ampel]?.klasse ?? ""}`}>
                  {AMPEL_TEXT[z.ampel]?.label ?? z.ampel}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <KontoAktionen />
    </div>
  );
}
