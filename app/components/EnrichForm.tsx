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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {hypothesen.map((h) => (
        <div
          key={h.key}
          className="rounded-lg border border-black/10 dark:border-white/15 p-4"
        >
          <div className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50 mb-1">
            {KATEGORIE_LABEL[h.kategorie]}
          </div>
          <div className="font-medium mb-2">
            {h.key} · {h.titel}
          </div>
          <ul className="text-sm list-disc pl-5 mb-3 text-black/70 dark:text-white/70">
            {h.pruefragen.map((frage, i) => (
              <li key={i}>{frage}</li>
            ))}
          </ul>
          <textarea
            name={`answer_${h.key}`}
            rows={3}
            placeholder="Was hast du bei der Besichtigung herausgefunden?"
            className="block w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm mb-2"
          />
          <input
            type="file"
            name={`files_${h.key}`}
            multiple
            accept="image/*,application/pdf"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-black/5 dark:file:bg-white/10 file:px-3 file:py-1.5"
          />
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "Wird aktualisiert…" : "Antworten speichern und Report aktualisieren"}
      </button>
    </form>
  );
}
