import { and, between, eq } from "drizzle-orm";
import { REMINDER_HOURS_BEFORE } from "../config";
import { db } from "../db";
import { bookings, slots } from "../db/schema";
import { emailQueue } from "../queue";
import { addHours } from "../time";

/** Chaque matin : un rappel pour les ateliers du lendemain. */
export async function sendReminders() {
  const now = new Date();
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(eq(bookings.status, "confirmed"), between(slots.startsAt, now, addHours(now, REMINDER_HOURS_BEFORE))));
  for (const b of due) {
    await emailQueue.add("reminder", { template: "reminder", bookingId: b.id }, { jobId: `reminder-${b.id}` });
  }
}
