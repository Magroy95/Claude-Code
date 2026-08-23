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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="expose" className="block text-sm font-medium mb-1">
          Ihr Exposé (PDF oder Foto)
        </label>
        <p className="mb-2 text-xs text-black/55 dark:text-white/55">
          Ein Screenshot vom Portal reicht auch.
        </p>
        <input
          id="expose"
          name="expose"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          required
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Ihre E-Mail-Adresse
        </label>
        <p className="mb-2 text-xs text-black/55 dark:text-white/55">
          Damit wir Ihnen den Link schicken können, sobald das Ergebnis da ist. Die Auswertung
          selbst verschicken wir nie per E-Mail.
        </p>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="name@beispiel.de"
          className="block w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="eigenkapital" className="block text-sm font-medium mb-1">
          Verfügbares Eigenkapital (EUR)
        </label>
        {/* Die Frage nach dem Eigenkapital ist die heikelste im Formular.
            Ein Satz, der den Zweck nennt, senkt die Abbruchquote an genau
            dieser Stelle – der Wortlaut ist vom Betreiber vorgegeben. */}
        <p className="mb-2 text-xs text-black/55 dark:text-white/55">
          Damit wir Ihre Monatsrate rechnen können
        </p>
        <input
          id="eigenkapital"
          name="eigenkapital"
          type="number"
          min={0}
          step={1000}
          required
          placeholder="z.B. 60000"
          className="block w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div>
        <span className="block text-sm font-medium mb-1">Verkaufsart</span>
        <div className="inline-flex rounded-md border border-black/15 dark:border-white/15 p-1">
          {(["MAKLER", "PRIVAT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setVerkaufsart(option)}
              className={`rounded px-4 py-1.5 text-sm transition-colors ${
                verkaufsart === option
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-black/60 dark:text-white/60"
              }`}
            >
              {option === "MAKLER" ? "Makler-Verkauf" : "Privat-Verkauf"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="freitext" className="block text-sm font-medium mb-1">
          Wissen Sie schon etwas, das nicht im Exposé steht? (optional)
        </label>
        <textarea
          id="freitext"
          name="freitext"
          rows={4}
          placeholder="z.B. Dach wurde 2015 erneuert, Keller riecht leicht muffig, ..."
          className="block w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-black/70 dark:text-white/70">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5"
        />
        <span>
          Ich habe die{" "}
          <a href="/datenschutz" className="underline" target="_blank">
            Datenschutzhinweise
          </a>{" "}
          gelesen und bin mit der Verarbeitung meiner Angaben zur Erstellung
          der Analyse einverstanden.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Der Knopf nennt das Ergebnis und die Wartezeit, nicht den Vorgang.
          „Analyse starten" beschreibt, was die Maschine tut; wichtig ist,
          was der Nutzer davon hat und wie lange es dauert. */}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {submitting
          ? "Wird gestartet…"
          : `Meine Fragen für den Termin — in ${DAUER_TYPISCH_MINUTEN} Minuten`}
      </button>
      <p className="-mt-3 text-xs text-black/55 dark:text-white/55">
        Kostenlos und ohne Konto. Sie entscheiden erst nach dem Ergebnis, ob Sie die vollständige
        Besichtigungsmappe wollen.
      </p>
    </form>
  );
}
