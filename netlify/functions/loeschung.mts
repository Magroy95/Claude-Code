import type { Config } from "@netlify/functions";

/**
 * Geplanter Löschlauf.
 *
 * Ruft den Anwendungsendpunkt auf, statt die Löschlogik zu wiederholen: Die
 * Fristen stehen an einer Stelle (lib/loeschung.ts) und werden von der
 * Datenschutzerklärung ebenfalls von dort gelesen. Zwei Umsetzungen
 * derselben Regel würden früher oder später auseinanderlaufen.
 */
export default async function loeschlauf() {
  const basis = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const geheimnis = process.env.CRON_SECRET;
  if (!basis || !geheimnis) {
    console.error("[HauskaufChecker] Löschlauf: URL oder CRON_SECRET fehlt.");
    return;
  }

  const antwort = await fetch(`${basis}/api/cron/loeschung`, {
    headers: { authorization: `Bearer ${geheimnis}` },
  });
  const bericht = await antwort.text();
  console.info(`[HauskaufChecker] Löschlauf (${antwort.status}): ${bericht}`);
}

export const config: Config = { schedule: "0 3 * * *" };
