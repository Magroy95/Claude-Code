import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageAdapter, StoredFileInput } from "./types";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? "./uploads");

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export class LocalStorageAdapter implements StorageAdapter {
  async save({ buffer, fileName, namespace }: StoredFileInput): Promise<string> {
    const dir = path.join(UPLOADS_DIR, namespace);
    await mkdir(dir, { recursive: true });
    const storageKey = path.posix.join(
      namespace,
      `${randomUUID()}-${sanitizeFileName(fileName)}`,
    );
    await writeFile(path.join(UPLOADS_DIR, ...storageKey.split("/")), buffer);
    return storageKey;
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    const resolved = path.join(UPLOADS_DIR, ...storageKey.split("/"));
    if (!resolved.startsWith(UPLOADS_DIR)) {
      throw new Error("Ungültiger storageKey");
    }
    return readFile(resolved);
  }

  async delete(storageKey: string): Promise<void> {
    const resolved = path.join(UPLOADS_DIR, ...storageKey.split("/"));
    if (!resolved.startsWith(UPLOADS_DIR)) {
      throw new Error("Ungültiger storageKey");
    }
    // force: true lässt eine bereits fehlende Datei durchgehen – für das
    // Löschkonzept zählt das Ergebnis, nicht der Weg dorthin.
    await rm(resolved, { force: true });
  }
}
