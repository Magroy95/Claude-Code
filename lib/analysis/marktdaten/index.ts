import { holeHaeuserpreisindex } from "./destatis";
import { holeBodenrichtwertNiedersachsen } from "./bodenrichtwerteNiedersachsen";
import { findeBodenrichtwertReferenz } from "./bodenrichtwerteReferenz";
import type { MarktdatenErgebnis } from "./types";

export type { MarktdatenErgebnis, BodenrichtwertErgebnis, PreisindexErgebnis } from "./types";

// Fasst alle verfügbaren externen Marktdaten-Quellen zusammen. Läuft
// niemals in einen Fehler – jede Teilquelle degradiert für sich auf `null`,
// wenn sie nicht erreichbar, nicht konfiguriert oder (noch) nicht für das
// jeweilige Bundesland implementiert ist. Das Ergebnis ist reine
// Zusatzinformation für den marktwertAgent-Prompt, niemals eine
// Voraussetzung dafür, dass die Analyse überhaupt läuft.
//
// Liefert der Live-WFS keinen Treffer (siehe bodenrichtwerteNiedersachsen.ts
// – aktuell der Regelfall, da der amtliche Dienst automatisierte Anfragen
// offenbar ablehnt), greift als zweite Stufe die von Hand kuratierte
// Referenztabelle (bodenrichtwerteReferenz.ts).
export async function holeMarktdaten(lageOrOrt: string): Promise<MarktdatenErgebnis> {
  const [liveBodenrichtwert, preisindex] = await Promise.all([
    holeBodenrichtwertNiedersachsen(lageOrOrt).catch(() => null),
    holeHaeuserpreisindex("Deutschland").catch(() => null),
  ]);
  const bodenrichtwert = liveBodenrichtwert ?? findeBodenrichtwertReferenz(lageOrOrt);
  return { bodenrichtwert, preisindex };
}
