"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function ProcessingScreen({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const response = await fetch(`/api/analyses/${analysisId}/status`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.status === "DONE" || data.status === "ERROR") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.refresh();
      }
    }, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [analysisId, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 flex flex-col items-center text-center">
      <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
      <h1 className="text-lg font-medium mb-2">Deine Analyse läuft…</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Das Multi-Agenten-System wertet dein Exposé aus – Marktwert, Substanz,
        Cashflow und Risiken. Das dauert in der Regel ein bis zwei Minuten.
      </p>
      <p className="text-xs text-black/40 dark:text-white/40 mt-6">
        Analyse-ID: {analysisId}
      </p>
    </div>
  );
}
