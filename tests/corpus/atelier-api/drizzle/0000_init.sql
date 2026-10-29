-- Schéma initial : voir src/db/schema.ts (source de vérité pour l'application).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL, phone text,
  password_hash text NOT NULL, role text NOT NULL DEFAULT 'customer', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), ip text, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE password_resets (token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL);
CREATE TABLE instructors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), bio text);
CREATE TABLE workshops (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL,
  instructor_id uuid NOT NULL REFERENCES instructors(id), published boolean NOT NULL DEFAULT false);
CREATE TABLE slots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workshop_id uuid NOT NULL REFERENCES workshops(id),
  starts_at timestamptz NOT NULL, seats int NOT NULL, seats_taken int NOT NULL DEFAULT 0, price_cents int NOT NULL);
CREATE TABLE bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  slot_id uuid NOT NULL REFERENCES slots(id), status text NOT NULL DEFAULT 'pending', price_cents int NOT NULL, notes text,
  hold_until timestamptz NOT NULL, confirmed_at timestamptz, cancelled_at timestamptz, cancel_reason text, refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX bookings_one_active ON bookings (user_id, slot_id) WHERE status IN ('pending', 'confirmed');
CREATE INDEX bookings_hold ON bookings (status, hold_until);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings(id),
  intent_id text UNIQUE, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE refunds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id),
  stripe_refund_id text UNIQUE, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE processed_events (id text PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE email_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template text NOT NULL, booking_id uuid, provider_id text,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workshop_id uuid NOT NULL REFERENCES workshops(id),
  user_id uuid NOT NULL REFERENCES users(id), rating int NOT NULL, comment text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity text NOT NULL, entity_id uuid NOT NULL,
  change jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);
