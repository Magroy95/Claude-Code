"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DAUER_TYPISCH_MINUTEN } from "@/lib/dauer";

export function StartAnalysisForm() {
  const router = useRouter();
  const [verkaufsart, setVerkaufsart] = useState<"MAKLER" | "PRIVAT">("MAKLER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.set("verkaufsart", verkaufsart);

    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Etwas ist schiefgelaufen.");
        setSubmitting(false);
        return;
      }
      router.push(`/analyse/${data.id}`);
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lp-formular">
      <div className="lp-feld">
        <label htmlFor="expose">Ihr Exposé (PDF oder Foto)</label>
        <p className="warum">Ein Screenshot vom Portal reicht auch.</p>
        <input
          id="expose"
          name="expose"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          required
        />
      </div>

      <div className="lp-feld">
        <label htmlFor="email">Ihre E-Mail-Adresse</label>
        <p className="warum">
          Damit wir Ihnen den Link schicken können, sobald das Ergebnis da ist. Die Auswertung
          selbst verschicken wir nie per E-Mail.
        </p>
        <input id="email" name="email" type="email" required placeholder="name@beispiel.de" />
      </div>

      <div className="lp-feld">
        <label htmlFor="eigenkapital">Verfügbares Eigenkapital (EUR)</label>
        {/* Die Frage nach dem Eigenkapital ist die heikelste im Formular.
            Ein Satz, der den Zweck nennt, senkt die Abbruchquote an genau
            dieser Stelle – der Wortlaut ist vom Betreiber vorgegeben. */}
        <p className="warum">Damit wir Ihre Monatsrate rechnen können</p>
        <input
          id="eigenkapital"
          name="eigenkapital"
          type="number"
          min={0}
          step={1000}
          required
          placeholder="z.B. 60000"
        />
      </div>

      <div className="lp-feld">
        <span
          style={{
            fontFamily: "var(--rpt-display)",
            fontSize: "14.5px",
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          Verkaufsart
        </span>
        <div className="lp-wahl">
          {(["MAKLER", "PRIVAT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={verkaufsart === option}
              onClick={() => setVerkaufsart(option)}
            >
              {option === "MAKLER" ? "Makler" : "Privat"}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-feld">
        <label htmlFor="freitext">Wissen Sie schon etwas, das nicht im Exposé steht?</label>
        <p className="warum">Freiwillig — hilft der Auswertung aber sehr.</p>
        <textarea
          id="freitext"
          name="freitext"
          rows={4}
          placeholder="z.B. Dach wurde 2015 erneuert, Keller riecht leicht muffig, ..."
        />
      </div>

      <label className="lp-einwilligung">
        <input type="checkbox" name="consent" required />
        <span>
          Ich habe die{" "}
          <a href="/datenschutz" target="_blank">
            Datenschutzhinweise
          </a>{" "}
          gelesen und bin mit der Verarbeitung meiner Angaben zur Erstellung der Analyse
          einverstanden.
        </span>
      </label>

      {error && <p className="lp-fehler">{error}</p>}

      {/* Der Knopf nennt das Ergebnis und die Wartezeit, nicht den Vorgang.
          „Analyse starten" beschreibt, was die Maschine tut; wichtig ist,
          was der Nutzer davon hat und wie lange es dauert. */}
      <button type="submit" className="lp-knopf" disabled={submitting}>
        {submitting
          ? "Wird gestartet…"
          : `Meine Fragen für den Termin — in ${DAUER_TYPISCH_MINUTEN} Minuten`}
      </button>
      <p className="lp-klein" style={{ marginTop: "-8px" }}>
        Kostenlos und ohne Konto. Sie entscheiden erst nach dem Ergebnis, ob Sie die vollständige
        Besichtigungsmappe wollen.
      </p>
    </form>
  );
}
