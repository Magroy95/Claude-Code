import { holeHaeuserpreisindex } from "./destatis";
import { holeBodenrichtwertNiedersachsen } from "./bodenrichtwerteNiedersachsen";
import type { MarktdatenErgebnis } from "./types";

export type { MarktdatenErgebnis, BodenrichtwertErgebnis, PreisindexErgebnis } from "./types";

// Fasst alle verfügbaren externen Marktdaten-Quellen zusammen. Läuft
// niemals in einen Fehler – jede Teilquelle degradiert für sich auf `null`,
// wenn sie nicht erreichbar, nicht konfiguriert oder (noch) nicht für das
// jeweilige Bundesland implementiert ist. Das Ergebnis ist reine
// Zusatzinformation für den marktwertAgent-Prompt, niemals eine
// Voraussetzung dafür, dass die Analyse überhaupt läuft.
export async function holeMarktdaten(lageOrOrt: string): Promise<MarktdatenErgebnis> {
  const [bodenrichtwert, preisindex] = await Promise.all([
    holeBodenrichtwertNiedersachsen(lageOrOrt).catch(() => null),
    holeHaeuserpreisindex("Deutschland").catch(() => null),
  ]);
  return { bodenrichtwert, preisindex };
}
