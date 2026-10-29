import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { bookings } from "../db/schema";
import { HttpError } from "../http";

export async function getBooking(req: Request, res: Response) {
  const user = await requireUser(req);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id!));
  // ses propres réservations seulement, sauf pour un admin
  if (!booking || (booking.userId !== user.id && user.role !== "admin")) throw new HttpError(404, "not_found");
  res.json(booking);
}
