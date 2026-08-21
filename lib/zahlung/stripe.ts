// Zahlungsabwicklung über Stripe Checkout.
//
// Warum Checkout und nicht ein eigenes Formular: So fassen wir Kartendaten
// nie an. Das erspart uns PCI-DSS, die Zwei-Faktor-Pflicht nach PSD2 und
// einen erheblichen Teil der Datenschutzerklärung – bei einem Produkt für
// 3,99 EUR wäre alles andere unverhältnismäßig.
//
// Der Kaufabschluss wird NICHT auf der Rückkehrseite verbucht. Ob jemand
// nach der Zahlung im Browser zurückkommt, ist Zufall – der Webhook ist die
// verlässliche Quelle. Die Rückkehrseite zeigt nur an, was der Webhook
// bereits eingetragen hat.

import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { PAKET_LAUFZEIT_TAGE, PRODUKT } from "@/lib/auth/berechtigung";
import { sendeKaufbeleg } from "@/lib/mail";
import { siteConfig } from "@/lib/site-config";
import type { EntitlementKind } from "@/app/generated/prisma/enums";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt");
    client = new Stripe(key);
  }
  return client;
}

export function stripeKonfiguriert(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Legt eine Bestellung an und erzeugt die Checkout-Sitzung.
 *
 * analysisId ist optional: Kauft jemand direkt aus einem Report heraus,
 * wollen wir ihn danach genau dorthin zurückbringen.
 */
export async function starteKauf(params: {
  userId: string;
  email: string;
  kind: EntitlementKind;
  analysisId?: string;
}): Promise<{ url: string }> {
  const produkt = PRODUKT[params.kind];

  const bestellung = await prisma.order.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      betragCent: produkt.betragCent,
    },
  });

  const zielNachKauf = params.analysisId
    ? `${siteConfig.url}/analyse/${params.analysisId}?kauf=ok`
    : `${siteConfig.url}/konto?kauf=ok`;

  const sitzung = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: params.email,
    client_reference_id: bestellung.id,
    metadata: {
      bestellungId: bestellung.id,
      userId: params.userId,
      analysisId: params.analysisId ?? "",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: produkt.betragCent,
          product_data: {
            name: `${siteConfig.name} – ${produkt.bezeichnung}`,
            description: produkt.beschreibung,
          },
        },
      },
    ],
    locale: "de",
    // Kleinunternehmerregelung: Es wird keine Umsatzsteuer ausgewiesen.
    // Der Hinweis gehört sichtbar in den Bezahlvorgang, nicht nur auf die
    // Rechnung.
    custom_text: {
      submit: {
        message:
          "Kein Ausweis von Umsatzsteuer gemäß § 19 UStG. Mit dem Kauf stimmen Sie dem sofortigen " +
          "Beginn der Leistung zu und nehmen zur Kenntnis, dass Ihr Widerrufsrecht mit vollständiger " +
          "Erbringung erlischt.",
      },
    },
    success_url: zielNachKauf,
    cancel_url: params.analysisId
      ? `${siteConfig.url}/analyse/${params.analysisId}?kauf=abgebrochen`
      : `${siteConfig.url}/preise?kauf=abgebrochen`,
  });

  await prisma.order.update({
    where: { id: bestellung.id },
    data: { stripeCheckoutId: sitzung.id },
  });

  if (!sitzung.url) throw new Error("Stripe hat keine Checkout-URL geliefert");
  return { url: sitzung.url };
}

/**
 * Verbucht eine bezahlte Bestellung: Berechtigung anlegen und – wenn der
 * Kauf aus einem Report heraus erfolgte – diesen gleich freischalten.
 *
 * Bewusst idempotent: Stripe stellt Webhooks mehrfach zu, und eine doppelt
 * gebuchte Berechtigung wäre ein Geschenk, das wir nicht machen wollen.
 */
export async function verbucheBezahlung(sitzung: Stripe.Checkout.Session): Promise<void> {
  const bestellungId = sitzung.metadata?.bestellungId ?? sitzung.client_reference_id;
  if (!bestellungId) {
    console.error("[HauskaufChecker] Webhook ohne Bestellbezug:", sitzung.id);
    return;
  }

  const bestellung = await prisma.order.findUnique({
    where: { id: bestellungId },
    include: { user: true, entitlement: true },
  });
  if (!bestellung) {
    console.error("[HauskaufChecker] Webhook für unbekannte Bestellung:", bestellungId);
    return;
  }
  if (bestellung.status === "BEZAHLT") return;

  const validUntil =
    bestellung.kind === "PAKET_3M"
      ? new Date(Date.now() + PAKET_LAUFZEIT_TAGE * 24 * 60 * 60_000)
      : null;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: bestellung.id },
      data: {
        status: "BEZAHLT",
        bezahltAm: new Date(),
        stripePaymentIntentId:
          typeof sitzung.payment_intent === "string" ? sitzung.payment_intent : null,
      },
    }),
    prisma.entitlement.create({
      data: {
        userId: bestellung.userId,
        kind: bestellung.kind,
        orderId: bestellung.id,
        validUntil,
      },
    }),
  ]);

  const analysisId = sitzung.metadata?.analysisId;
  if (analysisId) {
    // Der Nutzer hat aus einem konkreten Report heraus gekauft – er erwartet,
    // dass dieser jetzt offen ist, nicht dass er ihn noch einlösen muss.
    const { schalteFrei } = await import("@/lib/auth/berechtigung");
    await schalteFrei(analysisId, bestellung.userId);
  }

  await sendeKaufbeleg(
    bestellung.user.email,
    PRODUKT[bestellung.kind].bezeichnung,
    bestellung.betragCent,
    bestellung.id,
  );
}
