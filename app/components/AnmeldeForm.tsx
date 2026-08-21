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
      <div className="mt-8 rounded border border-current/20 p-5">
        <p className="font-medium">Schauen Sie in Ihr Postfach</p>
        <p className="mt-2 text-sm leading-relaxed opacity-80">
          Wenn zu dieser Adresse ein Konto besteht oder angelegt werden kann, ist der Anmeldelink
          unterwegs. Er gilt 20 Minuten.
        </p>
        <button
          type="button"
          onClick={() => setStatus("bereit")}
          className="mt-4 text-sm underline"
        >
          Andere Adresse verwenden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="mt-8 flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        E-Mail-Adresse
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="ihre@adresse.de"
        className="rounded border border-current/25 bg-transparent px-3 py-2 text-base"
      />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <button
        type="submit"
        disabled={status === "sendet"}
        className="mt-1 rounded bg-foreground px-4 py-2.5 font-medium text-background disabled:opacity-60"
      >
        {status === "sendet" ? "Wird gesendet …" : "Anmeldelink schicken"}
      </button>
    </form>
  );
}
