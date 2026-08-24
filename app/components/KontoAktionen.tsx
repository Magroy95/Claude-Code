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
    <section>
      <div className="lp-aktionen">
        <button type="button" onClick={abmelden} disabled={laeuft !== null} className="lp-textlink">
          Abmelden
        </button>
        <a href="/api/konto/export" className="lp-textlink">
          Meine Daten herunterladen
        </a>
        <button
          type="button"
          onClick={() => setLoeschenOffen((o) => !o)}
          className="lp-textlink"
          aria-expanded={loeschenOffen}
        >
          Konto löschen
        </button>
      </div>

      {loeschenOffen && (
        <div className="lp-gefahr">
          <h3>Konto und alle Analysen löschen?</h3>
          <p>
            Ihr Zugang wird sofort gesperrt. Nach 30 Tagen werden Konto, Analysen und hochgeladene
            Exposés endgültig gelöscht — bis dahin können Sie sich melden, falls es ein Versehen
            war. Rechnungsbelege zu getätigten Käufen müssen wir steuerrechtlich aufbewahren (§ 147
            AO); sie enthalten keine Inhalte Ihrer Analysen.
          </p>
          <div className="knoepfe">
            <button
              type="button"
              onClick={loeschen}
              disabled={laeuft !== null}
              className="lp-knopf klein"
            >
              {laeuft === "loeschen" ? "Wird gelöscht …" : "Endgültig löschen"}
            </button>
            <button
              type="button"
              onClick={() => setLoeschenOffen(false)}
              className="lp-textlink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
