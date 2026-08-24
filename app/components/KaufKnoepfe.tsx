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
    <div style={{ marginTop: "30px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <button
          type="button"
          onClick={() => kaufen("SINGLE")}
          disabled={laeuft !== null}
          className="lp-knopf"
        >
          {laeuft === "SINGLE" ? "Einen Moment …" : `Einzelanalyse kaufen — ${preisEinzel}`}
        </button>
        <button
          type="button"
          onClick={() => kaufen("PAKET_3M")}
          disabled={laeuft !== null}
          className="lp-knopf stumm"
        >
          {laeuft === "PAKET_3M" ? "Einen Moment …" : `Paket kaufen — ${preisPaket}`}
        </button>
      </div>
      {fehler && (
        <p className="lp-fehler" style={{ marginTop: "16px" }}>
          {fehler}
        </p>
      )}
    </div>
  );
}
