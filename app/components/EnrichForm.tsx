"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Hypothese } from "@/lib/analysis/schema";

const KATEGORIE_LABEL: Record<Hypothese["kategorie"], string> = {
  KAUFENTSCHEIDEND: "Kaufentscheidend",
  KOSTENRELEVANT: "Kostenrelevant",
  STRATEGISCH: "Strategisch",
};

export function EnrichForm({
  analysisId,
  hypothesen,
}: {
  analysisId: string;
  hypothesen: Hypothese[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/analyses/${analysisId}/enrich`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Etwas ist schiefgelaufen.");
        setSubmitting(false);
        return;
      }
      router.push(`/analyse/${analysisId}`);
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lp-formular">
      {hypothesen.map((h) => (
        <div key={h.key} className="lp-hypokarte">
          <p className="kategorie">{KATEGORIE_LABEL[h.kategorie]}</p>
          <p className="titel">
            {h.key} · {h.titel}
          </p>
          <ul className="fragen">
            {h.pruefragen.map((frage, i) => (
              <li key={i}>{frage}</li>
            ))}
          </ul>
          <textarea
            name={`answer_${h.key}`}
            rows={3}
            placeholder="Was haben Sie bei der Besichtigung herausgefunden?"
            aria-label={`Antwort zu ${h.key}`}
          />
          <input
            type="file"
            name={`files_${h.key}`}
            multiple
            accept="image/*,application/pdf"
            aria-label={`Belege zu ${h.key}`}
          />
        </div>
      ))}

      {error && <p className="lp-fehler">{error}</p>}

      <button type="submit" className="lp-knopf" disabled={submitting}>
        {submitting ? "Wird aktualisiert…" : "Antworten speichern und Report aktualisieren"}
      </button>
    </form>
  );
}
