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
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="z.B. HKC-4821-QX7K"
        className="flex-1 rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium"
      >
        Öffnen
      </button>
    </form>
  );
}
