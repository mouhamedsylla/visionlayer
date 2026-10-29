import { describe, expect, it } from "vitest";
import { blockUse, reachedBy, storeAccess, writersOf } from "../src/domain/data/actors";
import { constraintSentence, controlsOf, triggerSentence, writtenByTriggers } from "../src/domain/data/controls";
import { declarationSpan, withLeadingComment } from "../src/domain/data/excerpt";
import { entityFindings, storeFindings } from "../src/domain/data/findings";
import { entityGroups } from "../src/domain/data/groups";
import { lifecycle, stateFields } from "../src/domain/data/lifecycle";
import { storeNotes } from "../src/domain/data/notes";
import { columnGroups, writtenBy } from "../src/domain/data/shape";
import { dataStores, storeEntities } from "../src/domain/data/stores";
import { atelierMap } from "./atelier";

describe("données, sur atelier-api", async () => {
  const { model } = await atelierMap();
  const [store] = dataStores(model);
  const entities = storeEntities(store!);
  const access = storeAccess(store!, model);
  const entity = (name: string) => entities.find((e) => e.name === name)!;

  it("un seul stockage porte des tables ; elles sont dans l'ordre du schéma", () => {
    expect(dataStores(model).map((s) => s.id)).toEqual(["postgres"]);
    expect(entities.slice(0, 4).map((e) => e.name)).toEqual(["users", "sessions", "password_resets", "bookings"]);
  });

  it("met chaque tâche planifiée dans sa propre colonne, après son bloc", () => {
    expect(access.actors.map((a) => `${a.label}${a.detail ? ` (${a.detail})` : ""}`)).toEqual([
      "api", "expireHolds (chaque minute)", "purgeSessions (chaque jour à 3 h)", "sendReminders (chaque jour à 8 h)", "worker",
    ]);
    expect(writersOf(access, "bookings")).toEqual(["api", "api:schedule:* * * * *"]);
    expect(writersOf(access, "payments")).toEqual(["api"]);
    expect(writersOf(access, "email_jobs")).toEqual(["worker"]);
    expect(blockUse(access, "worker")).toEqual({ read: 4, write: 1 });
  });

  it("dit qui atteint une ligne, en comptant au-delà de trois", () => {
    const session = access.byEntity.get("sessions")!.get("api")!.read[0]!;
    expect(reachedBy(session, model).label).toBe("8 points d'entrée");
    const create = access.byEntity.get("payments")!.get("api")!.write.find((o) => o.path === "src/payments/create.ts")!;
    expect(reachedBy(create, model).label).toBe("POST /payments");
  });

  it("appelle contrôle une unicité ou une vérification, et la dit en une phrase", () => {
    expect(controlsOf(entity("sessions"))).toEqual([]);
    const [one] = controlsOf(entity("bookings"));
    expect(constraintSentence(one!)).toBe("deux lignes avec le même (user_id, slot_id), quand status in ('pending', 'confirmed')");
    expect(constraintSentence(controlsOf(entity("payments"))[0]!)).toBe("deux lignes avec le même intent_id");
  });

  it("relie le déclencheur de bookings à la table qu'il écrit", () => {
    expect(triggerSentence(entity("bookings").triggers![0]!)).toBe("à chaque mise à jour, écrit audit_log");
    expect(writtenByTriggers(entity("audit_log"), entities).map((w) => `${w.trigger.name} sur ${w.on}`)).toEqual(["audit_bookings sur bookings"]);
  });

  it("résume le stockage par des comptes, sans phrase vide", () => {
    expect(storeNotes(store!, entities, access, model).map((n) => `${n.tone} ${n.text}`)).toEqual([
      "attention 7 constats à vérifier", "attention 3 tables écrites de plusieurs côtés", "attention 10 tables sans contrôle",
      "plain 1 table écrite par un déclencheur", "plain 2 tables que le code ne lit ni n'écrit",
    ]);
  });

  it("range chaque constat sur sa table, ou sur le stockage", () => {
    expect(entityFindings(entity("bookings"), store!, model).map((f) => f.code).sort()).toEqual(["race_read_then_write", "unused_value", "write_then_enqueue"]);
    expect(entityFindings(entity("payments"), store!, model)).toEqual([]);
    expect(storeFindings(store!, model).map((f) => f.code)).toEqual(["missing_timeout"]);
  });

  it("montre la déclaration avec le commentaire qui la touche, et seulement lui", () => {
    const span = declarationSpan(entity("payments"))!;
    expect(span).toMatchObject({ path: "src/db/schema.ts", line: 72, from: 69, to: 78, marks: [75] });
    const ex = withLeadingComment({ path: span.path, from: 69, lines: ["", "export const PAYMENT_STATUS = [];", "", "// Seule l'API écrit ici.", "export const payments = pgTable("] }, 73);
    expect(ex.from).toBe(72);
    expect(ex.lines[0]).toBe("// Seule l'API écrit ici.");
  });

  it("range les tables par section du schéma", () => {
    expect(entityGroups(entities).map((g) => `${g.title} · ${g.entities.length}`)).toEqual([
      "Comptes · 3", "Réservations et paiements · 6", "Catalogue et le reste · 5",
    ]);
  });

  it("le cycle de vie de bookings.status : valeurs du schéma, écritures rangées par valeur, couloirs", () => {
    const bookings = entity("bookings");
    expect(stateFields(bookings).map((f) => f.name)).toEqual(["status"]);
    const life = lifecycle(bookings, stateFields(bookings)[0]!, model);
    expect(life.states.map((s) => `${s.value}${s.isDefault ? " (défaut)" : ""} : ${s.writers.join(", ") || "jamais écrit"}`)).toEqual([
      "pending (défaut) : createBooking, markPaymentFailed", "confirmed : confirmBooking", "cancelled : cancelBooking, expireHolds",
      "refunded : markRefunded", "on_hold : jamais écrit",
    ]);
    expect(life.steps.map((s) => `${s.from?.label ?? "·"} → ${s.actor.label} : ${s.value} (${s.via})`)).toEqual([
      "web → api : pending (POST /bookings)", "Stripe → api : pending (POST /webhooks/stripe)", "Stripe → api : confirmed (POST /webhooks/stripe)",
      "web → api : cancelled (PATCH /bookings/:id)", "· → expireHolds : cancelled (chaque minute)", "Stripe → api : refunded (POST /webhooks/stripe)",
    ]);
    expect(life.lanes.map((l) => l.label)).toEqual(["web", "Stripe", "api", "expireHolds", "bookings"]);
  });

  it("les colonnes regroupées par qui les écrit", () => {
    expect(columnGroups(entity("bookings")).map((g) => `${g.names.join(" · ")} : ${writtenBy(g)}`)).toContain(
      "cancelled_at · cancel_reason : écrit par cancelBooking · expireHolds",
    );
  });
});
