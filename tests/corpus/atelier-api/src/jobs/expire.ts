import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { bookings, slots } from "../db/schema";
import { logger } from "../logger";
import { sql } from "drizzle-orm";

/**
 * Toutes les minutes : une réservation non payée après la garde est annulée
 * et sa place rendue au créneau.
 */
export async function expireHolds() {
  const expired = await db
    .select({ id: bookings.id, slotId: bookings.slotId })
    .from(bookings)
    .where(and(eq(bookings.status, "pending"), lt(bookings.holdUntil, new Date())));

  for (const b of expired) {
    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "hold_expired" })
      .where(eq(bookings.id, b.id));
    await db.update(slots).set({ seatsTaken: sql`${slots.seatsTaken} - 1` }).where(eq(slots.id, b.slotId));
  }
  if (expired.length) logger.info({ count: expired.length }, "holds expired");
}
