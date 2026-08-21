"use client";

import { useEffect, useState } from "react";

/** Meldet ein Ereignis, ohne dass der Nutzer davon etwas merkt. */
export async function meldeEreignis(name: string, analysisId?: string): Promise<void> {
  try {
    await fetch("/api/ereignis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, analysisId }),
      keepalive: true,
    });
  } catch {
    // Eine Messung darf den Vorgang, den sie misst, niemals stören.
  }
}

/**
 * Meldet, dass die Bezahlschranke tatsächlich zu sehen war.
 *
 * Nicht beim Laden der Seite, sondern erst wenn die Schranke im Sichtfeld
 * ist: Wer den Report gar nicht so weit gescrollt hat, hat sie nicht
 * gesehen, und die Zahl wäre wertlos.
 */
export function SchrankeGesehen({ analysisId }: { analysisId: string }) {
  useEffect(() => {
    const ziel = document.querySelector(".rpt-schranke");
    if (!ziel) return;
    let gemeldet = false;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (gemeldet || !eintraege.some((e) => e.isIntersecting)) return;
        gemeldet = true;
        void meldeEreignis("schranke_gesehen", analysisId);
        beobachter.disconnect();
      },
      { threshold: 0.3 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [analysisId]);
  return null;
}

/**
 * Die einzige Frage, die wir dem Nutzer stellen.
 *
 * Ein Klick, keine Pflichtfelder, kein Dialogfenster. Wer mehr sagen will,
 * schreibt uns ohnehin – wer nur durchklickt, soll nicht aufgehalten
 * werden.
 */
export function Rueckmeldung({ analysisId }: { analysisId: string }) {
  const [beantwortet, setBeantwortet] = useState(false);

  async function antworte(hilfreich: boolean) {
    setBeantwortet(true);
    await meldeEreignis(hilfreich ? "report_hilfreich" : "report_nicht_hilfreich", analysisId);
  }

  if (beantwortet) {
    return (
      <div className="rpt-rueckmeldung no-print">
        <p>Danke — das hilft uns weiter.</p>
      </div>
    );
  }

  return (
    <div className="rpt-rueckmeldung no-print">
      <p>Hat Ihnen dieser Report für die Besichtigung geholfen?</p>
      <div className="rpt-rueckmeldung-knoepfe">
        <button type="button" onClick={() => antworte(true)}>
          Ja
        </button>
        <button type="button" onClick={() => antworte(false)}>
          Nein
        </button>
      </div>
    </div>
  );
}
