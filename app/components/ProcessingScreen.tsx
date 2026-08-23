"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DAUER_TYPISCH_MINUTEN, PIPELINE_SCHRITTE } from "@/lib/dauer";

/**
 * Die Wartezeit wird ausgespielt statt überbrückt.
 *
 * Vier bis fünf Minuten Spinner fühlen sich an wie ein Defekt. Dieselben
 * Minuten mit sichtbaren Arbeitsschritten fühlen sich an wie Arbeit, die
 * für einen erledigt wird – und sie erklären nebenbei, wofür der Report
 * später Geld wert ist. Die Schritte kommen dabei aus den echten
 * Zwischenergebnissen der Pipeline, nicht aus einem Timer.
 */
export function ProcessingScreen({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fertig, setFertig] = useState(0);

  useEffect(() => {
    async function abfragen() {
      const response = await fetch(`/api/analyses/${analysisId}/status`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.fertigeSchritte === "number") {
        // Nur vorwärts: Ein Wiederholungslauf setzt den Checkpoint teilweise
        // zurück, und ein rückwärts springender Fortschritt sieht nach
        // Fehler aus, obwohl gerade repariert wird.
        setFertig((bisher) => Math.max(bisher, data.fertigeSchritte));
      }
      if (data.status === "DONE" || data.status === "ERROR") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.refresh();
      }
    }
    void abfragen();
    intervalRef.current = setInterval(abfragen, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [analysisId, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="text-lg font-medium">Wir lesen gerade Ihr Exposé</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Das dauert in der Regel etwa {DAUER_TYPISCH_MINUTEN} Minuten. Sie können die Seite
        schließen — sobald Ihr Ergebnis da ist, schicken wir Ihnen den Link per E-Mail.
      </p>

      <ol className="mt-8 space-y-3">
        {PIPELINE_SCHRITTE.map((schritt, i) => {
          const erledigt = i < fertig;
          const laeuft = i === fertig;
          return (
            <li key={schritt.key} className="flex items-start gap-3 text-sm">
              <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center">
                {erledigt ? (
                  "✓"
                ) : laeuft ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
                ) : (
                  "·"
                )}
              </span>
              <span
                className={
                  erledigt
                    ? "text-black/50 dark:text-white/50"
                    : laeuft
                      ? "font-medium"
                      : "text-black/35 dark:text-white/35"
                }
              >
                {schritt.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        className="mt-8 text-xs text-black/40 dark:text-white/40"
        aria-live="polite"
      >
        Schritt {Math.min(fertig + 1, PIPELINE_SCHRITTE.length)} von {PIPELINE_SCHRITTE.length} ·
        Analyse-ID: {analysisId}
      </p>
    </div>
  );
}
