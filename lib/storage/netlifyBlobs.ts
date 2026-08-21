// Dateiablage in Netlify Blobs.
//
// Warum das nötig ist: Der lokale Adapter schreibt nach ./uploads. Auf
// Netlify läuft jede Anfrage in einer eigenen, kurzlebigen Funktionsinstanz
// mit flüchtigem Dateisystem – das Exposé wäre zwischen dem Upload und dem
// Start der Auswertung verschwunden, und der Löschlauf hätte nichts mehr zu
// löschen. Blobs ist der von Netlify mitgelieferte Objektspeicher; er
// braucht keinen zusätzlichen Anbieter und damit auch keinen weiteren
// Auftragsverarbeitungsvertrag.

import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { StorageAdapter, StoredFileInput } from "./types";

const STORE = "exposes";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export class NetlifyBlobsAdapter implements StorageAdapter {
  private store() {
    // In der Netlify-Laufzeit findet getStore die Zugangsdaten selbst. Für
    // Aufrufe von außerhalb (z.B. ein lokaler Skriptlauf gegen die
    // Produktivablage) werden sie ausdrücklich übergeben.
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN;
    if (siteID && token) return getStore({ name: STORE, siteID, token });
    return getStore(STORE);
  }

  async save({ buffer, fileName, namespace }: StoredFileInput): Promise<string> {
    // Derselbe Schlüsselaufbau wie beim lokalen Adapter, damit beide
    // austauschbar bleiben und bestehende Datensätze weiter passen.
    const storageKey = `${namespace}/${randomUUID()}-${sanitizeFileName(fileName)}`;
    // Blobs erwartet einen ArrayBuffer; Buffer ist ein Node-eigener View
    // darauf und wird nicht direkt angenommen.
    const rohdaten = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    await this.store().set(storageKey, rohdaten);
    return storageKey;
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    const daten = await this.store().get(storageKey, { type: "arrayBuffer" });
    if (!daten) throw new Error(`Datei nicht gefunden: ${storageKey}`);
    return Buffer.from(daten);
  }

  async delete(storageKey: string): Promise<void> {
    // Eine bereits fehlende Datei ist kein Fehler – für das Löschkonzept
    // zählt das Ergebnis, nicht der Weg dorthin.
    await this.store().delete(storageKey);
  }
}
