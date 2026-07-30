// Generischer Retry-Helper mit exponentiellem Backoff für die
// Analyse-Pipeline. Deckt sowohl transiente API-Fehler (Netzwerk, 5xx,
// Rate-Limit) als auch strukturelle Aussetzer eines Agenten ab (siehe
// consistency.ts) – in beiden Fällen ist "den Agenten noch einmal fragen"
// die richtige erste Reaktion, bevor die ganze Analyse als fehlgeschlagen
// markiert wird.

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      onRetry?.(attempt, error);
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
