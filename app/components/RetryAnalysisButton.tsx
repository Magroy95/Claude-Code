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
    <div style={{ marginTop: "28px" }}>
      <button type="button" onClick={handleRetry} disabled={loading} className="lp-knopf">
        {loading ? "Wird gestartet …" : "Erneut versuchen"}
      </button>
      <p className="lp-klein" style={{ marginTop: "12px" }}>
        Bereits erfolgreich abgeschlossene Analyse-Schritte werden dabei nicht wiederholt.
      </p>
      {error && (
        <p className="lp-fehler" style={{ marginTop: "14px", textAlign: "left" }}>
          {error}
        </p>
      )}
    </div>
  );
}
