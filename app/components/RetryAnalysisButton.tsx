"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryAnalysisButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Erneuter Versuch fehlgeschlagen.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Wird gestartet …" : "Erneut versuchen"}
      </button>
      <p className="text-xs text-black/50 dark:text-white/50 mt-2">
        Bereits erfolgreich abgeschlossene Analyse-Schritte werden dabei nicht wiederholt.
      </p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
