import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { requireAdmin } from "../auth/session";
import { db, type Tx } from "../db";
import { bookings, payments, refunds } from "../db/schema";
import { HttpError } from "../http";
import { emailQueue } from "../queue";
import { stripe } from "../stripe";

/** Un admin rembourse un paiement (geste commercial, atelier annulé). */
export async function refundPayment(req: Request, res: Response) {
  await requireAdmin(req);
  const [payment] = await db.select().from(payments).where(eq(payments.id, req.params.id!));
  if (!payment?.intentId) throw new HttpError(404, "not_found");
  if (payment.status !== "succeeded") throw new HttpError(409, "not_refundable");
  const refund = await stripe.refunds.create({ payment_intent: payment.intentId }, { idempotencyKey: `refund-${payment.bookingId}` });
  await db.insert(refunds).values({ paymentId: payment.id, stripeRefundId: refund.id, status: "pending" }).onConflictDoNothing();
  res.status(202).json({ refundId: refund.id });
}

/** Stripe confirme le remboursement (charge.refunded). */
export async function markRefunded(tx: Tx, intentId: string) {
  const [payment] = await tx.select().from(payments).where(eq(payments.intentId, intentId));
  if (!payment) return;
  await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
  await tx.update(refunds).set({ status: "succeeded" }).where(eq(refunds.paymentId, payment.id));
  await tx.update(bookings).set({ status: "refunded", refundedAt: new Date() }).where(eq(bookings.id, payment.bookingId));
  await emailQueue.add("refund-done", { template: "refund-done", bookingId: payment.bookingId }, { jobId: `refund-done-${payment.bookingId}` });
}
