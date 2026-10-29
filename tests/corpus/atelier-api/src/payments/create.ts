import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { bookings, payments } from "../db/schema";
import { HttpError } from "../http";
import { stripe } from "../stripe";
import { paymentKey } from "./keys";

const CreatePayment = z.object({ bookingId: z.string().uuid() });

export async function createPayment(req: Request, res: Response) {
  const user = await requireUser(req);
  const { bookingId } = CreatePayment.parse(req.body);

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking || booking.userId !== user.id) throw new HttpError(404, "not_found");
  if (booking.status !== "pending") throw new HttpError(409, "not_pending");

  // une place gardée trop longtemps bloque les autres clients
  if (booking.holdUntil < new Date()) throw new HttpError(410, "hold_expired");

  // si le client reclique, on renvoie le même paiement au lieu d'en créer un
  const [existing] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
  if (existing?.status === "processing" && existing.intentId) {
    const intent = await stripe.paymentIntents.retrieve(existing.intentId);
    return res.json({ clientSecret: intent.client_secret });
  }

  // Un double clic ne doit jamais débiter deux fois (EX-4) :
  // la clé Stripe est la réservation, pas la requête.
  const intent = await stripe.paymentIntents.create(
    { amount: booking.priceCents, currency: "eur",
      metadata: { bookingId: booking.id } },
    { idempotencyKey: paymentKey(booking.id) },
  ).catch(() => {
    // Stripe injoignable : le paiement reste « processing »,
    // un nouveau clic reprend avec la même clé.
    throw new HttpError(502, "payment_unavailable");
  });
  await db.insert(payments).values({ bookingId: booking.id, intentId: intent.id,
    status: "processing" }).onConflictDoNothing();

  res.json({ clientSecret: intent.client_secret });
}
