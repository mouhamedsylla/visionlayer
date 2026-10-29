// Stripe peut envoyer un événement plusieurs fois, et dans le désordre.
// On note chaque id traité ; l'ordre n'est jamais supposé.
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { confirmBooking } from "../bookings/confirm";
import { db, type Tx } from "../db";
import { bookings, payments, processedEvents } from "../db/schema";
import { env } from "../env";
import { markRefunded } from "../payments/refund";
import { emailQueue } from "../queue";
import { stripe } from "../stripe";

export async function stripeWebhook(req: Request, res: Response) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, req.headers["stripe-signature"] as string, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send("bad_signature");
  }
  // Stripe renvoie le même événement tant qu'il n'a pas reçu 2xx :
  // on note son id avant de le traiter, dans la même transaction.
  await db.transaction(async (tx) => {
    const fresh = await tx.insert(processedEvents).values({ id: event.id }).onConflictDoNothing().returning();
    if (fresh.length === 0) return;
    await handle(tx, event);
  });
  res.sendStatus(200);
}

async function handle(tx: Tx, event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      return confirmBooking(tx, intent.id, intent.metadata.bookingId!);
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      return markPaymentFailed(tx, intent.id, intent.metadata.bookingId!);
    }
    case "charge.refunded": {
      const charge = event.data.object;
      return markRefunded(tx, charge.payment_intent as string);
    }
    default:
      return; // autres événements : ignorés, réponse 200
  }
}

async function markPaymentFailed(tx: Tx, intentId: string, bookingId: string) {
  await tx.update(payments).set({ status: "failed" }).where(eq(payments.intentId, intentId));
  await tx.update(bookings).set({ status: "pending" }).where(eq(bookings.id, bookingId));
  await emailQueue.add("payment-failed", { template: "payment-failed", bookingId }, { jobId: `payment-failed-${intentId}` });
}
