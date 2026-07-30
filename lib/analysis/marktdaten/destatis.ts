// Häuserpreisindex des Statistischen Bundesamts (Destatis) über die
// GENESIS-Online-API – amtliche, von der Fachöffentlichkeit als valide
// anerkannte Statistik zur Preisentwicklung bei Wohnimmobilien.
//
// Zugang: GENESIS-Online ist kostenlos, erfordert für Datenabrufe (nicht für
// die reine Katalogsuche) aber ein kostenloses Konto unter
// https://www-genesis.destatis.de/genesis/online → "Anmelden" → Registrierung.
// Zugangsdaten werden über DESTATIS_GENESIS_USERNAME / DESTATIS_GENESIS_PASSWORD
// konfiguriert. Ohne gesetzte Zugangsdaten liefert dieser Adapter bewusst
// `null` statt einen Fehler zu werfen – die Pipeline funktioniert dann exakt
// wie zuvor, nur ohne diese zusätzliche Einordnung.
//
// WICHTIG (siehe README, Abschnitt "Marktdaten-Quellen verifizieren"): Die
// Tabellen-Kennung unten (DESTATIS_TABELLE_HAEUSERPREISINDEX) ist ein
// Platzhalter für die GENESIS-Tabelle "Häuserpreisindex" und muss vor dem
// Live-Betrieb einmal gegen den echten GENESIS-Online-Katalog geprüft und
// bei Bedarf über die Umgebungsvariable überschrieben werden – dieses
// Environment hatte beim Bau dieser Anbindung keinen Internetzugriff, um
// den exakten Tabellencode und die Feldnamen live zu verifizieren.

import { fetchWithTimeout } from "./fetchWithTimeout";
import type { PreisindexErgebnis } from "./types";

const GENESIS_BASE_URL = "https://www-genesis.destatis.de/genesisWS/rest/2020";
const DEFAULT_TABELLE = "61262-0001"; // Platzhalter, siehe Hinweis oben – vor Live-Betrieb verifizieren.

interface GenesisTableRow {
  // GENESIS liefert je nach Format unterschiedliche Strukturen; wir gehen
  // defensiv vor und parsen nur, was wir zweifelsfrei erkennen.
  [key: string]: unknown;
}

function parseHaeuserpreisindex(
  rows: GenesisTableRow[],
  region: string,
): PreisindexErgebnis | null {
  if (rows.length === 0) return null;

  const jahre = rows
    .map((row) => Number(row["Zeit"] ?? row["Jahr"]))
    .filter((jahr): jahr is number => Number.isFinite(jahr));
  if (jahre.length === 0) return null;

  const neuestesJahr = Math.max(...jahre);
  const aktuelleZeile = rows.find(
    (row) => Number(row["Zeit"] ?? row["Jahr"]) === neuestesJahr,
  );
  const vorjahrZeile = rows.find(
    (row) => Number(row["Zeit"] ?? row["Jahr"]) === neuestesJahr - 1,
  );
  if (!aktuelleZeile) return null;

  const aktuellerWert = Number(aktuelleZeile["Wert"] ?? aktuelleZeile["value"]);
  if (!Number.isFinite(aktuellerWert)) return null;

  const vorjahrWert = vorjahrZeile
    ? Number(vorjahrZeile["Wert"] ?? vorjahrZeile["value"])
    : null;
  const veraenderungVorjahrProzent =
    vorjahrWert !== null && Number.isFinite(vorjahrWert) && vorjahrWert !== 0
      ? Math.round(((aktuellerWert - vorjahrWert) / vorjahrWert) * 1000) / 10
      : null;

  return {
    regionOderBund: region,
    jahr: neuestesJahr,
    veraenderungVorjahrProzent,
    quelle: "Statistisches Bundesamt (Destatis), Häuserpreisindex",
    quellUrl: "https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Baupreise-Immobilienpreisindex/",
  };
}

export async function holeHaeuserpreisindex(
  region: string,
): Promise<PreisindexErgebnis | null> {
  const username = process.env.DESTATIS_GENESIS_USERNAME;
  const password = process.env.DESTATIS_GENESIS_PASSWORD;
  if (!username || !password) {
    // Bewusst kein Fehler: fehlende Zugangsdaten sind ein Konfigurations-,
    // kein Pipeline-Zustand. Siehe README für die Einrichtung.
    return null;
  }

  const tabelle = process.env.DESTATIS_TABELLE_HAEUSERPREISINDEX ?? DEFAULT_TABELLE;
  const url =
    `${GENESIS_BASE_URL}/data/tablefile?` +
    new URLSearchParams({
      username,
      password,
      name: tabelle,
      area: "all",
      format: "ffjson",
      language: "de",
    }).toString();

  try {
    const response = await fetchWithTimeout(url, { timeoutMs: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    const rows: GenesisTableRow[] = Array.isArray(data?.["Object"]?.["Content"])
      ? data["Object"]["Content"]
      : Array.isArray(data)
        ? data
        : [];
    return parseHaeuserpreisindex(rows, region);
  } catch {
    // Netzwerkfehler, Timeout oder unerwartetes Antwortformat: Die
    // Marktwert-Einordnung läuft ohne diese zusätzliche Einordnung weiter,
    // statt die Analyse fehlschlagen zu lassen.
    return null;
  }
}
