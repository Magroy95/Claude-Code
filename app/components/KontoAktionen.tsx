"use client";

import { useState } from "react";

/**
 * Abmelden, Datenexport und Kontolöschung.
 *
 * Alle drei bewusst direkt im Konto und nicht hinter einer Support-Adresse:
 * Auskunft und Löschung sind Rechte nach Art. 15 und 17 DSGVO, und ein
 * Formular, das man erst finden muss, ist die schlechtere Antwort darauf als
 * ein Knopf.
 */
export function KontoAktionen() {
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  async function abmelden() {
    setLaeuft("abmelden");
    await fetch("/api/auth/abmelden", { method: "POST" });
    window.location.href = "/";
  }

  async function loeschen() {
    setLaeuft("loeschen");
    const antwort = await fetch("/api/konto/loeschen", { method: "POST" });
    if (antwort.ok) window.location.href = "/";
    else setLaeuft(null);
  }

  return (
    <section className="mt-14 border-t border-current/10 pt-6 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <button type="button" onClick={abmelden} disabled={laeuft !== null} className="underline">
          Abmelden
        </button>
        <a href="/api/konto/export" className="underline">
          Meine Daten herunterladen
        </a>
        <button
          type="button"
          onClick={() => setLoeschenOffen((o) => !o)}
          className="underline opacity-70"
        >
          Konto löschen
        </button>
      </div>

      {loeschenOffen && (
        <div className="mt-4 rounded border border-red-700/40 p-4">
          <p className="font-medium">Konto und alle Analysen löschen?</p>
          <p className="mt-2 leading-relaxed opacity-80">
            Ihr Zugang wird sofort gesperrt. Nach 30 Tagen werden Konto, Analysen und hochgeladene
            Exposés endgültig gelöscht — bis dahin können Sie sich melden, falls es ein Versehen
            war. Rechnungsbelege zu getätigten Käufen müssen wir steuerrechtlich aufbewahren (§ 147
            AO); sie enthalten keine Inhalte Ihrer Analysen.
          </p>
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={loeschen}
              disabled={laeuft !== null}
              className="rounded bg-red-700 px-3 py-1.5 text-background disabled:opacity-60"
            >
              {laeuft === "loeschen" ? "Wird gelöscht …" : "Endgültig löschen"}
            </button>
            <button type="button" onClick={() => setLoeschenOffen(false)} className="underline">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
