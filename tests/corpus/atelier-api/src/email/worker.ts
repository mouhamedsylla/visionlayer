import { UnrecoverableError, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, emailJobs, slots, users, workshops } from "../db/schema";
import { getSender } from "./index";
import { shouldRetry } from "./retry";
import type { EmailJob, EmailMessage } from "./types";

/** Relit en base ce que le job ne transporte pas : l'adresse, le nom, l'atelier. */
async function toMessage(job: EmailJob, jobId: string): Promise<EmailMessage> {
  if (job.bookingId) {
    const [row] = await db
      .select({ email: users.email, name: users.name, title: workshops.title, startsAt: slots.startsAt, notes: bookings.notes })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(workshops, eq(workshops.id, slots.workshopId))
      .where(eq(bookings.id, job.bookingId));
    if (!row) throw new UnrecoverableError("booking_not_found");
    const data: Record<string, string> = { name: row.name, workshop: row.title, startsAt: row.startsAt.toISOString() };
    if (job.template === "reminder" && row.notes) data.notes = row.notes;
    return { to: row.email, template: job.template, locale: "fr", data, idempotencyKey: jobId, tags: [job.template] };
  }
  const [user] = await db.select().from(users).where(eq(users.id, job.userId ?? ""));
  if (!user) throw new UnrecoverableError("user_not_found");
  return { to: user.email, template: job.template, locale: "fr", data: { name: user.name, token: job.token ?? "" }, idempotencyKey: jobId, tags: [job.template] };
}

export async function sendEmail(job: Job<EmailJob>) {
  const result = await getSender().send(await toMessage(job.data, job.id ?? job.name));
  if (result.status !== "rejected") {
    await db.insert(emailJobs).values({ template: job.data.template, bookingId: job.data.bookingId, providerId: result.id, status: result.status });
    return result;
  }
  // 429 et 5xx : on réessaie, avec un délai qui double.
  // Une adresse refusée ne se réessaie jamais.
  if (!shouldRetry(result)) throw new UnrecoverableError(result.error ?? "rejected");
  throw new Error(result.error);
}
