// Kurzlebiges Token für den PDF-Export.
//
// Das PDF entsteht, indem ein Browser die Reportseite aufruft und druckt
// (lib/pdf/render.ts). Dieser Browser hat keine Sitzung – für den
// Zugriffsschutz der Seite wäre er ein Fremder und bekäme eine 404 statt des
// Reports. Statt den Schutz für den Renderer aufzuweichen, bekommt er ein
// signiertes Token: Die PDF-Route prüft die Berechtigung des Anfragenden
// einmal richtig und stellt dann eine Bescheinigung aus, die zwei Minuten
// gilt und nur für genau diese Analyse.
//
// HMAC statt Zufallstoken in der Datenbank, weil hier nichts zu speichern
// ist: Das Token trägt seine Gültigkeit selbst und muss nicht widerrufbar
// sein.

import { createHmac, timingSafeEqual } from "node:crypto";

const GUELTIG_SEKUNDEN = 120;

function geheimnis(): string | null {
  return process.env.PDF_TOKEN_SECRET ?? null;
}

export function erzeugePdfToken(analysisId: string): string | null {
  const secret = geheimnis();
  if (!secret) return null;
  const ablauf = Date.now() + GUELTIG_SEKUNDEN * 1000;
  const signatur = createHmac("sha256", secret).update(`${analysisId}:${ablauf}`).digest("base64url");
  return `${ablauf}.${signatur}`;
}

export function pruefePdfToken(analysisId: string, token: string | null): boolean {
  const secret = geheimnis();
  if (!secret || !token) return false;
  const [ablaufText, signatur] = token.split(".");
  if (!ablaufText || !signatur) return false;
  const ablauf = Number(ablaufText);
  if (!Number.isFinite(ablauf) || ablauf < Date.now()) return false;

  const erwartet = createHmac("sha256", secret).update(`${analysisId}:${ablauf}`).digest("base64url");
  const a = Buffer.from(signatur);
  const b = Buffer.from(erwartet);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
