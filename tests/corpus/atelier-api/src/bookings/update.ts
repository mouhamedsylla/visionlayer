import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { bookings, payments, refunds } from "../db/schema";
import { HttpError } from "../http";
import { stripe } from "../stripe";

const UpdateBooking = z.object({ status: z.literal("cancelled"), reason: z.string().max(200).optional() });

/** Le client annule : une réservation payée est remboursée. */
export async function cancelBooking(req: Request, res: Response) {
  const user = await requireUser(req);
  const input = UpdateBooking.parse(req.body);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id!));
  if (!booking || booking.userId !== user.id) throw new HttpError(404, "not_found");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw new HttpError(409, "not_cancellable");

  const wasPaid = booking.status === "confirmed";
  await db.update(bookings).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason ?? "customer" }).where(eq(bookings.id, booking.id));

  if (wasPaid) {
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    if (payment?.intentId) {
      const refund = await stripe.refunds.create({ payment_intent: payment.intentId }, { idempotencyKey: `refund-${booking.id}` });
      await db.insert(refunds).values({ paymentId: payment.id, stripeRefundId: refund.id, status: "pending" });
    }
  }
  res.json({ id: booking.id, status: "cancelled" });
}
