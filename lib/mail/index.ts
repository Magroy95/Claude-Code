// Transaktionsmails.
//
// Grundsatz: Es geht NIE ein Report-Inhalt per Mail hinaus. Die Mail sagt
// nur, dass etwas fertig ist, und verlinkt ins Konto. Das ist eine
// Produktentscheidung und zugleich Datensparsamkeit – Objektadressen und
// Kaufpreise fremder Häuser haben in einem unverschlüsselten Postfach nichts
// verloren, und wer die Mail weiterleitet, gibt sonst versehentlich den
// gesamten Report weiter.
//
// Versandweg: Brevo (Sitz und Verarbeitung in der EU), angesprochen über die
// HTTP-API statt SMTP – weniger bewegliche Teile, klarere Fehler. Ohne
// gesetzten API-Schlüssel wird die Mail nur protokolliert; damit läuft die
// Entwicklungsumgebung ohne Zugangsdaten und ohne versehentlichen Versand an
// echte Adressen.

import { siteConfig } from "@/lib/site-config";

const BREVO_ENDPUNKT = "https://api.brevo.com/v3/smtp/email";

export interface MailInhalt {
  an: string;
  betreff: string;
  /** Reiner Text. Bewusst kein HTML: weniger Angriffsfläche, bessere Zustellrate. */
  text: string;
}

export type MailErgebnis = { versendet: boolean; grund?: string };

function absender(): { name: string; email: string } {
  return {
    name: siteConfig.name,
    email: process.env.MAIL_ABSENDER ?? "noreply@hauskaufchecker.de",
  };
}

export async function sendeMail(inhalt: MailInhalt): Promise<MailErgebnis> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    // Kein Schlüssel: In der Entwicklung ist das der Normalfall. Der Inhalt
    // wird protokolliert, damit Anmeldelinks lokal nutzbar bleiben.
    console.info(
      `[HauskaufChecker] Mail nicht versendet (kein BREVO_API_KEY). An: ${inhalt.an}\n` +
        `Betreff: ${inhalt.betreff}\n${inhalt.text}`,
    );
    return { versendet: false, grund: "kein API-Schlüssel konfiguriert" };
  }

  try {
    const antwort = await fetch(BREVO_ENDPUNKT, {
      method: "POST",
      headers: {
        "api-key": key,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: absender(),
        to: [{ email: inhalt.an }],
        subject: inhalt.betreff,
        textContent: inhalt.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!antwort.ok) {
      const body = await antwort.text().catch(() => "");
      console.error(`[HauskaufChecker] Mailversand fehlgeschlagen (${antwort.status}): ${body}`);
      return { versendet: false, grund: `HTTP ${antwort.status}` };
    }
    return { versendet: true };
  } catch (fehler) {
    console.error("[HauskaufChecker] Mailversand fehlgeschlagen:", fehler);
    return { versendet: false, grund: String(fehler) };
  }
}

// --- Die vier Mails, die es gibt -------------------------------------------

export async function sendeAnmeldelink(an: string, link: string): Promise<MailErgebnis> {
  return sendeMail({
    an,
    betreff: `Ihr Anmeldelink für ${siteConfig.name}`,
    text:
      `Guten Tag,\n\n` +
      `mit diesem Link melden Sie sich an:\n\n${link}\n\n` +
      `Der Link gilt 20 Minuten und kann einmal verwendet werden.\n\n` +
      `Haben Sie die Anmeldung nicht angefordert, können Sie diese Nachricht ignorieren – ` +
      `ohne den Link passiert nichts.\n\n` +
      `${siteConfig.name}\n${siteConfig.url}`,
  });
}

export async function sendeAnalyseFertig(
  an: string,
  analysisId: string,
  adresse: string | null,
): Promise<MailErgebnis> {
  const link = `${siteConfig.url}/analyse/${analysisId}`;
  return sendeMail({
    an,
    betreff: "Ihre Analyse ist fertig",
    text:
      `Guten Tag,\n\n` +
      `Ihre Analyse ist abgeschlossen${adresse ? ` (${adresse})` : ""}.\n\n` +
      `Hier ansehen:\n${link}\n\n` +
      `Aus Datenschutzgründen versenden wir den Report nicht per E-Mail – ` +
      `er liegt ausschließlich in Ihrem Konto.\n\n` +
      `${siteConfig.name}\n${siteConfig.url}`,
  });
}

export async function sendeAnalyseFehlgeschlagen(
  an: string,
  analysisId: string,
): Promise<MailErgebnis> {
  const link = `${siteConfig.url}/analyse/${analysisId}`;
  return sendeMail({
    an,
    betreff: "Ihre Analyse konnte nicht abgeschlossen werden",
    text:
      `Guten Tag,\n\n` +
      `bei der Auswertung Ihres Exposés ist ein Fehler aufgetreten. ` +
      `Es wurde Ihnen nichts berechnet.\n\n` +
      `Sie können die Analyse hier erneut anstoßen:\n${link}\n\n` +
      `Klappt es weiterhin nicht, antworten Sie einfach auf diese Nachricht.\n\n` +
      `${siteConfig.name}\n${siteConfig.url}`,
  });
}

export async function sendeKaufbeleg(
  an: string,
  bezeichnung: string,
  betragCent: number,
  bestellnummer: string,
): Promise<MailErgebnis> {
  const betrag = (betragCent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
  return sendeMail({
    an,
    betreff: `Ihre Bestellung bei ${siteConfig.name}`,
    text:
      `Guten Tag,\n\n` +
      `vielen Dank für Ihren Kauf.\n\n` +
      `Bestellnummer: ${bestellnummer}\n` +
      `Leistung: ${bezeichnung}\n` +
      `Betrag: ${betrag}\n\n` +
      `Kein Ausweis von Umsatzsteuer gemäß § 19 UStG (Kleinunternehmerregelung).\n\n` +
      `Sie haben dem sofortigen Beginn der Leistung zugestimmt und zur Kenntnis genommen, ` +
      `dass Ihr Widerrufsrecht mit vollständiger Erbringung erlischt.\n\n` +
      `Ihre Käufe finden Sie im Konto:\n${siteConfig.url}/konto\n\n` +
      `${siteConfig.name}\n${siteConfig.url}`,
  });
}

export async function sendeLoeschbestaetigung(an: string): Promise<MailErgebnis> {
  return sendeMail({
    an,
    betreff: "Ihr Konto wurde gelöscht",
    text:
      `Guten Tag,\n\n` +
      `Ihr Konto und alle zugehörigen Analysen wurden gelöscht.\n\n` +
      `Aus steuerrechtlichen Gründen müssen wir Rechnungsbelege zu getätigten Käufen ` +
      `aufbewahren (§ 147 AO). Diese enthalten Betrag, Datum und Ihre E-Mail-Adresse, ` +
      `jedoch keine Inhalte Ihrer Analysen.\n\n` +
      `${siteConfig.name}\n${siteConfig.url}`,
  });
}
