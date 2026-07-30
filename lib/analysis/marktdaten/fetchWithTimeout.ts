// Externe Marktdaten-Quellen dürfen die Analyse-Pipeline niemals blockieren
// oder zu Fall bringen, nur weil ein Drittanbieter-Dienst langsam oder nicht
// erreichbar ist. Deshalb: harte Zeitbegrenzung, und Aufrufer fangen jeden
// Fehler ab und werten ihn als "keine Referenzdaten verfügbar" statt als
// Pipeline-Fehler.
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 5000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
