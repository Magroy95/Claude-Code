import { LocalStorageAdapter } from "./local";
import type { StorageAdapter } from "./types";

// Für den Prototyp genügt lokales Dateisystem. Für einen echten Live-Betrieb
// (z.B. Serverless-Hosting) hier einen S3/R2-Adapter einsetzen, der dasselbe
// StorageAdapter-Interface implementiert – der restliche Code bleibt gleich.
export const storage: StorageAdapter = new LocalStorageAdapter();

export type { StorageAdapter, StoredFileInput } from "./types";
