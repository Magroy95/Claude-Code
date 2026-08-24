"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LookupAnalysisForm() {
  const router = useRouter();
  const [id, setId] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/analyse/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="lp-zeile">
      <label htmlFor="analyse-id" className="sr-only">
        Analyse-ID
      </label>
      <input
        id="analyse-id"
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="z.B. HKC-4821-QX7K"
      />
      <button type="submit" className="lp-knopf klein">
        Öffnen
      </button>
    </form>
  );
}
