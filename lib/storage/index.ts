import { LocalStorageAdapter } from "./local";
import { NetlifyBlobsAdapter } from "./netlifyBlobs";
import type { StorageAdapter } from "./types";

export type { StorageAdapter, StoredFileInput } from "./types";

/**
 * Auswahl der Dateiablage.
 *
 * Auf Netlify ist ein lokales Verzeichnis wertlos: Jede Anfrage läuft in
 * einer eigenen, kurzlebigen Instanz mit flüchtigem Dateisystem. Die
 * Umgebungsvariable NETLIFY wird von der Plattform selbst gesetzt, sodass
 * die richtige Ablage ohne Zutun greift – lokal bleibt es beim Verzeichnis,
 * damit die Entwicklung ohne Zugangsdaten läuft.
 *
 * STORAGE_ADAPTER überschreibt die Erkennung, falls sie einmal danebenliegt.
 */
function waehleAdapter(): StorageAdapter {
  const erzwungen = process.env.STORAGE_ADAPTER;
  if (erzwungen === "lokal") return new LocalStorageAdapter();
  if (erzwungen === "netlify") return new NetlifyBlobsAdapter();
  return process.env.NETLIFY ? new NetlifyBlobsAdapter() : new LocalStorageAdapter();
}

export const storage: StorageAdapter = waehleAdapter();
