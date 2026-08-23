"use client";

import { useState } from "react";

/**
 * Die Schranke zwischen kostenloser Kurzfassung und vollständigem Report.
 *
 * Bewusst kein verschwommener Text im Hintergrund: Wer eine unscharfe
 * Vorschau sieht, ahnt, dass da etwas ist, weiß aber nicht was. Ehrlicher
 * und für die Kaufentscheidung nützlicher ist eine klare Liste dessen, was
 * folgt – der Nutzer soll wissen, wofür er zahlt, bevor er zahlt.
 */
export function Bezahlschranke({
  analysisId,
  angemeldet,
  preisEinzel,
  preisPaket,
  weitereHypothesen,
}: {
  analysisId: string;
  angemeldet: boolean;
  preisEinzel: string;
  preisPaket: string;
  /** Wie viele Hypothesen über die frei gezeigten hinaus noch folgen. */
  weitereHypothesen: number;
}) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function kaufen(produkt: "SINGLE" | "PAKET_3M") {
    setFehler(null);
    setLaeuft(produkt);
    const daten = new FormData();
    daten.set("produkt", produkt);
    daten.set("analysisId", analysisId);
    const antwort = await fetch("/api/kauf", { method: "POST", body: daten });
    const inhalt = await antwort.json().catch(() => ({}));
    if (antwort.ok && inhalt.url) {
      window.location.href = inhalt.url;
      return;
    }
    setFehler(inhalt.error ?? "Der Bezahlvorgang konnte nicht gestartet werden.");
    setLaeuft(null);
  }

  return (
    <section className="rpt-schranke no-print">
      <p className="rpt-schranke-label">Kostenlose Kurzfassung endet hier</p>
      <h2>
        {weitereHypothesen > 0
          ? `${weitereHypothesen} weitere Hypothesen, die Sie klären sollten`
          : "Ihre vollständige Besichtigungsmappe"}
      </h2>
      <ul className="rpt-schranke-liste">
        {weitereHypothesen > 0 && (
          <li>
            <strong>Alle {weitereHypothesen + 2} Hypothesen</strong> — jede so ausführlich wie die
            beiden oben, mit Beleg aus dem Exposé und den Fragen für den Termin
          </li>
        )}
        <li>
          <strong>Marktwert-Orientierung</strong> — Preiskorridor mit Einordnung des Angebotspreises
          und Verhandlungsargumenten
        </li>
        <li>
          <strong>Gewerke-Checkliste</strong> — alle acht Gewerke einzeln beurteilt, Kostenrahmen aus
          einer belegten Referenztabelle gerechnet statt geschätzt
        </li>
        <li>
          <strong>Sanierungsstau</strong> — beziffert, mit Rechenweg und Quellenangabe
        </li>
        <li>
          <strong>Finanzierung und Stress-Test</strong> — monatliche Belastung, Kaufnebenkosten,
          Zinsänderungsrisiko
        </li>
        <li>
          <strong>Sanierungsfahrplan</strong> — Vorschlag zur Reihenfolge der Maßnahmen
        </li>
        <li>
          <strong>PDF zum Mitnehmen</strong> — für den Besichtigungstermin
        </li>
      </ul>

      {/* Das Risiko liegt hier tatsächlich bei uns, und das darf man sagen:
          Gekauft wird ein fertiger Report, den der Nutzer in seiner
          Kurzfassung schon gesehen hat. Es ist kein Versprechen, das wir
          später einlösen müssten. */}
      <p className="rpt-schranke-zusage">
        Sie sehen das Ergebnis, bevor Sie zahlen. Wäre die Auswertung fehlgeschlagen, stünde hier
        nichts zum Kaufen — und es wäre Ihnen nichts berechnet worden.
      </p>

      {angemeldet ? (
        <>
          <div className="rpt-schranke-knoepfe">
            <button type="button" onClick={() => kaufen("SINGLE")} disabled={laeuft !== null}>
              {laeuft === "SINGLE"
                ? "Einen Moment …"
                : `Diese Mappe freischalten — ${preisEinzel}`}
            </button>
            <button
              type="button"
              className="sekundaer"
              onClick={() => kaufen("PAKET_3M")}
              disabled={laeuft !== null}
            >
              {laeuft === "PAKET_3M" ? "Einen Moment …" : `Alle Häuser, 3 Monate — ${preisPaket}`}
            </button>
          </div>
          {fehler && <p className="rpt-schranke-fehler">{fehler}</p>}
          <p className="rpt-schranke-klein">
            Kein Ausweis von Umsatzsteuer gemäß § 19 UStG. Kein Abonnement — das Paket endet
            automatisch. Mit dem Kauf stimmen Sie dem sofortigen Beginn der Leistung zu und nehmen
            zur Kenntnis, dass Ihr Widerrufsrecht mit vollständiger Erbringung erlischt.
          </p>
        </>
      ) : (
        <>
          <div className="rpt-schranke-knoepfe">
            <a href={`/anmelden?weiter=${encodeURIComponent(`/analyse/${analysisId}`)}`}>
              Anmelden und freischalten
            </a>
          </div>
          <p className="rpt-schranke-klein">
            Für den Kauf brauchen wir ein Konto — dort finden Sie Ihre Häuser später wieder. Die
            Anmeldung läuft ohne Passwort über einen Link per E-Mail.
          </p>
        </>
      )}
    </section>
  );
}
