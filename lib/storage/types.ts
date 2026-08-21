export interface StoredFileInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  /** Logisches Verzeichnis, z.B. eine Analyse-ID, zur Gruppierung von Dateien. */
  namespace: string;
}

export interface StorageAdapter {
  /** Speichert eine Datei und gibt den storageKey zurück, unter dem sie später abrufbar ist. */
  save(input: StoredFileInput): Promise<string>;
  /** Liest eine zuvor gespeicherte Datei anhand ihres storageKey. */
  readBuffer(storageKey: string): Promise<Buffer>;
  /**
   * Entfernt eine Datei endgültig. Eine bereits fehlende Datei ist kein
   * Fehler – das Löschkonzept muss auch dann durchlaufen, wenn eine Datei
   * schon anderweitig verschwunden ist.
   */
  delete(storageKey: string): Promise<void>;
}
