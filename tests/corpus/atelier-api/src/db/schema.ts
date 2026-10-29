import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ── Comptes ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["customer", "instructor", "admin"] }).notNull().default("customer"),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  ip: text("ip"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ── Réservations et paiements ───────────────────────────────────────

export const BOOKING_STATUS = ["pending", "confirmed", "cancelled", "refunded", "on_hold"] as const;

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    slotId: uuid("slot_id").references(() => slots.id).notNull(),
    status: text("status", { enum: BOOKING_STATUS }).notNull().default("pending"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes"),
    holdUntil: timestamp("hold_until", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // une seule réservation active par client et par créneau
    uniqueIndex("bookings_one_active").on(t.userId, t.slotId).where(sql`status in ('pending', 'confirmed')`),
    index("bookings_hold").on(t.status, t.holdUntil),
  ],
);

export const slots = pgTable("slots", {
  id: id(),
  workshopId: uuid("workshop_id").references(() => workshops.id).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  seats: integer("seats").notNull(),
  seatsTaken: integer("seats_taken").notNull().default(0),
  priceCents: integer("price_cents").notNull(),
});

export const PAYMENT_STATUS = ["processing", "succeeded", "failed", "refunded"] as const;

// Seule l'API écrit ici : jamais l'app web, jamais le worker.
export const payments = pgTable("payments", {
  id: id(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  intentId: text("intent_id").unique(),
  status: text("status", { enum: PAYMENT_STATUS }).notNull(),
  createdAt: createdAt(),
});

export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  stripeRefundId: text("stripe_refund_id").unique(),
  status: text("status", { enum: ["pending", "succeeded", "failed"] }).notNull(),
  createdAt: createdAt(),
});

export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey(),
  receivedAt: createdAt(),
});

export const emailJobs = pgTable("email_jobs", {
  id: id(),
  template: text("template").notNull(),
  bookingId: uuid("booking_id"),
  providerId: text("provider_id"),
  status: text("status").notNull(),
  createdAt: createdAt(),
});

// ── Catalogue et le reste ───────────────────────────────────────────

export const workshops = pgTable("workshops", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructorId: uuid("instructor_id").references(() => instructors.id).notNull(),
  published: boolean("published").notNull().default(false),
});

export const instructors = pgTable("instructors", {
  id: id(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  bio: text("bio"),
});

export const reviews = pgTable("reviews", {
  id: id(),
  workshopId: uuid("workshop_id").references(() => workshops.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: createdAt(),
});

// écrite seulement par le déclencheur audit_bookings (drizzle/0001_audit.sql)
export const auditLog = pgTable("audit_log", {
  id: id(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  change: jsonb("change").notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
