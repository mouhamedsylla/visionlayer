import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { HOLD_MINUTES } from "../config";
import { db } from "../db";
import { bookings, slots } from "../db/schema";
import { HttpError } from "../http";
import { emailQueue } from "../queue";
import { addMinutes } from "../time";

const CreateBooking = z.object({ slotId: z.string().uuid(), notes: z.string().max(500).optional() });

export async function createBooking(req: Request, res: Response) {
  const user = await requireUser(req);
  const input = CreateBooking.parse(req.body);

  const booking = await db.transaction(async (tx) => {
    // verrouille le créneau : deux clients ne prennent pas la dernière place en même temps
    const { rows } = await tx.execute<{ id: string; seats: number; seats_taken: number; price_cents: number }>(
      sql`SELECT id, seats, seats_taken, price_cents FROM slots WHERE id = ${input.slotId} FOR UPDATE`,
    );
    const slot = rows[0];
    if (!slot) throw new HttpError(404, "slot_not_found");
    if (slot.seats_taken >= slot.seats) throw new HttpError(409, "slot_full");

    await tx.update(slots).set({ seatsTaken: slot.seats_taken + 1 }).where(sql`id = ${slot.id}`);
    const [booking] = await tx.insert(bookings).values({
      userId: user.id,
      slotId: slot.id,
      status: "pending",
      priceCents: slot.price_cents,
      notes: input.notes,
      holdUntil: addMinutes(new Date(), HOLD_MINUTES),
    }).onConflictDoNothing().returning();
    if (!booking) throw new HttpError(409, "already_booked");
    return booking;
  }); // fin de la transaction
  await emailQueue.add("booking-received", { template: "booking-received", bookingId: booking.id });
  res.status(201).json(booking);
}
