// Anmeldung ohne Passwort.
//
// Warum Magic Link: Wir brauchen die E-Mail-Adresse ohnehin, um die
// Fertigmeldung zu verschicken. Damit entfällt der gesamte Passwort-Apparat –
// kein Hashing-Verfahren, das veraltet, kein Zurücksetzen-Formular, kein
// Brute-Force-Schutz auf einem Login-Endpunkt und vor allem kein Datensatz,
// dessen Diebstahl Nutzer auch auf anderen Seiten gefährdet.
//
// Von Token wird durchgehend nur der SHA-256-Hash gespeichert. Wer die
// Datenbank liest, kann sich damit nicht anmelden – dasselbe Prinzip wie bei
// Passwörtern, nur dass der Klartext hier ohnehin nur Minuten gültig ist.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/** Gültigkeit des Anmeldelinks. Kurz, weil er per Mail unterwegs ist. */
export const MAGIC_LINK_GUELTIG_MINUTEN = 20;
/** Gültigkeit der Sitzung. Lang, damit der Mailwechsel selten nötig ist. */
export const SESSION_GUELTIG_TAGE = 90;

export const SESSION_COOKIE = "hkc_session";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function neuesToken(): string {
  // 32 Byte aus dem Kryptografie-Zufallsgenerator; base64url, damit der Wert
  // ohne Kodierung in eine URL passt.
  return randomBytes(32).toString("base64url");
}

/** Vergleich in konstanter Zeit, damit die Laufzeit nichts über den Wert verrät. */
function gleich(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function normalisiereEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Legt bei Bedarf ein Konto an und erzeugt einen Anmeldelink.
 * Gibt das Klartext-Token zurück – es wird nur hier und in der E-Mail
 * verwendet und nirgends gespeichert.
 */
export async function erstelleMagicLink(emailRoh: string): Promise<{ token: string; userId: string }> {
  const email = normalisiereEmail(emailRoh);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Ein gelöschtes Konto darf sich nicht durch eine neue Anmeldung
  // wiederbeleben – die Löschung ist eine Zusage an den Nutzer.
  if (user.deletedAt) {
    throw new Error("Konto wurde gelöscht");
  }

  const token = neuesToken();
  await prisma.magicLink.create({
    data: {
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + MAGIC_LINK_GUELTIG_MINUTEN * 60_000),
    },
  });
  return { token, userId: user.id };
}

/**
 * Löst einen Anmeldelink ein und erzeugt eine Sitzung. Der Link ist danach
 * verbraucht, auch wenn er noch nicht abgelaufen wäre.
 */
export async function loeseMagicLinkEin(token: string): Promise<{ sessionToken: string } | null> {
  const eintrag = await prisma.magicLink.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!eintrag) return null;
  if (eintrag.usedAt) return null;
  if (eintrag.expiresAt.getTime() < Date.now()) return null;
  if (eintrag.user.deletedAt) return null;

  const sessionToken = neuesToken();
  await prisma.$transaction([
    prisma.magicLink.update({ where: { id: eintrag.id }, data: { usedAt: new Date() } }),
    prisma.session.create({
      data: {
        userId: eintrag.userId,
        tokenHash: hash(sessionToken),
        expiresAt: new Date(Date.now() + SESSION_GUELTIG_TAGE * 24 * 60 * 60_000),
      },
    }),
    // Analysen, die der Nutzer vor der Anmeldung über dieselbe Adresse
    // gestartet hat, gehören ihm – sonst wären sie nach dem Anmelden weg.
    prisma.analysis.updateMany({
      where: { email: eintrag.user.email, userId: null },
      data: { userId: eintrag.userId },
    }),
  ]);
  return { sessionToken };
}

export async function setzeSessionCookie(sessionToken: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_GUELTIG_TAGE * 24 * 60 * 60,
  });
}

export async function loescheSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface AngemeldeterNutzer {
  id: string;
  email: string;
}

/**
 * Liest die aktuelle Sitzung. Gibt null zurück, wenn keine gültige besteht –
 * Aufrufer entscheiden selbst, ob das ein Fehler ist oder nur bedeutet, dass
 * niemand angemeldet ist.
 */
export async function aktuellerNutzer(): Promise<AngemeldeterNutzer | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.deletedAt) return null;
  if (!gleich(session.tokenHash, hash(token))) return null;

  // Letzten Zugriff nur grob mitschreiben – ein Schreibvorgang bei jedem
  // Seitenaufruf wäre unnötige Last.
  const eineStunde = 60 * 60_000;
  if (Date.now() - session.lastSeenAt.getTime() > eineStunde) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return { id: session.user.id, email: session.user.email };
}

export async function meldeAb(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hash(token) } });
  }
  await loescheSessionCookie();
}
