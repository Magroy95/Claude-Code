import { NextResponse } from "next/server";
import { stripe, verbucheBezahlung } from "@/lib/zahlung/stripe";

/**
 * Stripe-Webhook. Einzige verlässliche Quelle dafür, dass wirklich gezahlt
 * wurde – die Rückkehr des Nutzers in den Browser ist es nicht.
 *
 * Die Signaturprüfung braucht den unveränderten Rohtext des Requests,
 * deshalb request.text() statt request.json().
 */
export async function POST(request: Request) {
  const signatur = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signatur || !secret) {
    return NextResponse.json({ error: "Signatur fehlt" }, { status: 400 });
  }

  const rohtext = await request.text();
  let ereignis;
  try {
    ereignis = stripe().webhooks.constructEvent(rohtext, signatur, secret);
  } catch (fehler) {
    // Ungültige Signatur heißt: Der Aufruf kam nicht von Stripe. Nichts tun.
    console.error("[HauskaufChecker] Webhook-Signatur ungültig:", fehler);
    return NextResponse.json({ error: "Signatur ungültig" }, { status: 400 });
  }

  if (ereignis.type === "checkout.session.completed") {
    try {
      await verbucheBezahlung(ereignis.data.object);
    } catch (fehler) {
      // 500 zurückgeben, damit Stripe erneut zustellt – die Buchung ist
      // idempotent, ein zweiter Versuch schadet nicht.
      console.error("[HauskaufChecker] Buchung fehlgeschlagen:", fehler);
      return NextResponse.json({ error: "Buchung fehlgeschlagen" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
