import { eq } from "drizzle-orm";
import type { Tx } from "../db";
import { bookings, payments } from "../db/schema";
import { logger } from "../logger";
import { emailQueue } from "../queue";

/**
 * Stripe a confirmé le paiement d'une réservation.
 *
 * Appelée par le webhook, dans sa transaction. La réservation peut avoir changé
 * depuis le paiement : expireHolds a pu l'annuler, ou le client.
 */
export async function confirmBooking(tx: Tx, intentId: string, bookingId: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) {
    logger.warn({ bookingId }, "confirmation for unknown booking");
    return;
  }

  await tx.update(payments).set({ status: "succeeded" }).where(eq(payments.intentId, intentId));

  if (booking.status === "cancelled") {
    // annulée entre-temps : on ne la réactive pas
    logger.warn({ bookingId }, "payment succeeded on a cancelled booking");
    return;
  }

  await tx.update(bookings).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(bookings.id, bookingId));

  // jobId = gabarit + réservation : un webhook reçu deux fois ne crée qu'un job
  await emailQueue.add("payment-accepted", { template: "payment-accepted", bookingId }, { jobId: `payment-accepted-${bookingId}` });
}
