import type { Constraint, Entity } from "../../api/types";
import { joinWords } from "../text/plural";

type Trigger = NonNullable<Entity["triggers"]>[number];

/**
 * Les contrôles d'une entité : ce que la base refuse au-delà de l'identité de
 * la ligne (une unicité, une vérification). Une clé primaire est toujours là ;
 * une clé étrangère relie deux tables : elles sont dites à part.
 */
export function controlsOf(entity: Entity): Constraint[] {
  return (entity.constraints ?? []).filter((c) => c.kind === "unique" || c.kind === "check");
}

/** Ce que la base refuse, en une phrase : `deux lignes avec le même intent_id`. */
export function constraintSentence(c: Constraint): string {
  const cols = c.fields.length > 1 ? `(${c.fields.join(", ")})` : c.fields[0] ?? "";
  switch (c.kind) {
    case "unique": return `deux lignes avec le même ${cols}${c.where ? `, quand ${c.where}` : ""}`;
    case "check": return `une ligne où ${c.where ?? c.name ?? "la règle"} est faux`;
    case "foreign": return `un ${cols} qui ne renvoie à aucune ligne de ${c.references ?? "la table visée"}`;
    case "primary": return `deux lignes avec la même clé ${cols}`;
    case "index": return `rien : un index accélère la lecture de ${cols}${c.where ? `, quand ${c.where}` : ""}`;
  }
}

const OPS: Record<Trigger["on"][number], string> = { insert: "ajout", update: "mise à jour", delete: "suppression", write: "écriture" };

/** `à chaque mise à jour, écrit audit_log`. */
export function triggerSentence(t: Trigger): string {
  const on = `à chaque ${joinWords(t.on.map((o) => OPS[o])).replace(/ et /g, " ou ")}`;
  return t.writes?.length ? `${on}, écrit ${joinWords(t.writes)}` : on;
}

/** Les déclencheurs d'autres entités qui écrivent celle-ci : `audit_bookings` pour `audit_log`. */
export function writtenByTriggers(entity: Entity, all: Entity[]): { trigger: Trigger; on: string }[] {
  return all.flatMap((other) => (other.triggers ?? []).filter((t) => t.writes?.includes(entity.name)).map((trigger) => ({ trigger, on: other.name })));
}
