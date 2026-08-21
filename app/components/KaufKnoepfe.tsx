"use client";

import { useState } from "react";

/** Kaufknöpfe auf der Preisseite – ohne Bezug zu einer bestimmten Analyse. */
export function KaufKnoepfe({
  preisEinzel,
  preisPaket,
}: {
  preisEinzel: string;
  preisPaket: string;
}) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function kaufen(produkt: "SINGLE" | "PAKET_3M") {
    setFehler(null);
    setLaeuft(produkt);
    const daten = new FormData();
    daten.set("produkt", produkt);
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
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => kaufen("SINGLE")}
          disabled={laeuft !== null}
          className="rounded bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {laeuft === "SINGLE" ? "Einen Moment …" : `Einzelanalyse kaufen — ${preisEinzel}`}
        </button>
        <button
          type="button"
          onClick={() => kaufen("PAKET_3M")}
          disabled={laeuft !== null}
          className="rounded border border-current/30 px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {laeuft === "PAKET_3M" ? "Einen Moment …" : `Paket kaufen — ${preisPaket}`}
        </button>
      </div>
      {fehler && <p className="mt-3 text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
