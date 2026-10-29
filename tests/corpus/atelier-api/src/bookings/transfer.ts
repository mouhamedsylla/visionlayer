import { eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { bookings, users } from "../db/schema";
import { HttpError } from "../http";

const TransferInput = z.object({ toEmail: z.string().email() });

/** Céder sa réservation à quelqu'un d'autre (prévu pour le support). */
export async function transferBooking(req: Request, res: Response) {
  const user = await requireUser(req);
  const { toEmail } = TransferInput.parse(req.body);
  const result = await db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; user_id: string; status: string }>(
      sql`SELECT id, user_id, status FROM bookings WHERE id = ${req.params.id!} FOR UPDATE`,
    );
    const booking = rows[0];
    if (!booking || booking.user_id !== user.id) throw new HttpError(404, "not_found");
    if (booking.status !== "confirmed") throw new HttpError(409, "not_transferable");
    const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.email, toEmail.toLowerCase()));
    if (!target) throw new HttpError(404, "recipient_not_found");
    await tx.update(bookings).set({ userId: target.id }).where(eq(bookings.id, booking.id));
    return { id: booking.id, userId: target.id };
  });
  res.json(result);
}
