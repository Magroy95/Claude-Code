"use client";

import { useState } from "react";

export function AnmeldeForm({ weiter }: { weiter?: string }) {
  const [status, setStatus] = useState<"bereit" | "sendet" | "gesendet">("bereit");
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFehler(null);
    setStatus("sendet");
    const daten = new FormData(event.currentTarget);
    if (weiter) daten.set("weiter", weiter);
    const antwort = await fetch("/api/auth/anmelden", { method: "POST", body: daten });
    const antwortInhalt = await antwort.json().catch(() => ({}));
    if (!antwort.ok) {
      setFehler(antwortInhalt.error ?? "Das hat nicht geklappt. Bitte versuchen Sie es erneut.");
      setStatus("bereit");
      return;
    }
    setStatus("gesendet");
  }

  if (status === "gesendet") {
    return (
      <div className="lp-tafel" style={{ marginTop: "30px" }}>
        <h2 className="lp-h3">Schauen Sie in Ihr Postfach</h2>
        <p className="lp-text" style={{ fontSize: "15.5px" }}>
          Wenn zu dieser Adresse ein Konto besteht oder angelegt werden kann, ist der Anmeldelink
          unterwegs. Er gilt 20 Minuten.
        </p>
        <button
          type="button"
          onClick={() => setStatus("bereit")}
          className="lp-textlink"
          style={{ marginTop: "18px" }}
        >
          Andere Adresse verwenden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="lp-formular" style={{ marginTop: "30px" }}>
      <div className="lp-feld">
        <label htmlFor="email">E-Mail-Adresse</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="ihre@adresse.de"
        />
      </div>
      {fehler && <p className="lp-fehler">{fehler}</p>}
      <button type="submit" className="lp-knopf" disabled={status === "sendet"}>
        {status === "sendet" ? "Wird gesendet …" : "Anmeldelink schicken"}
      </button>
    </form>
  );
}
