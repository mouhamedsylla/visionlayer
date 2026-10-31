import type { CodeFunction, Finding } from "../arch/types.js";
import { at, MapIndex, type IndexedEntity, type IndexedEntry } from "./index.js";

export type Start =
  | { kind: "entry"; entry: IndexedEntry }
  | { kind: "function"; fn: CodeFunction }
  | { kind: "entity"; entity: IndexedEntity }
  | { kind: "topic"; node: string; name: string }
  | { kind: "finding"; finding: Finding };

const ADDRESS = /^(.+):(\d+)$/;

/**
 * Ce qu'un agent a choisi dans le sommaire, retrouvé sur la carte. Il peut
 * écrire ce que le sommaire affiche : une route (`GET /admin/export`), une
 * fonction (`expireHolds`), une table (`bookings` ou `postgres/bookings`),
 * une file (`emails`), un constat (`race_read_then_write`, ou
 * `race_read_then_write@src/jobs/expire.ts:13`) ou une adresse
 * (`src/jobs/expire.ts:18`). Un nom qui désigne plusieurs choses les rend
 * toutes ; un nom inconnu ne rend rien.
 */
export function resolve(index: MapIndex, handle: string): Start[] {
  const h = handle.trim();
  const out: Start[] = [];

  const [code, where] = h.split("@");
  const findings = index.findingsOf(code!).filter((f) => !where || f.proof.some((p) => at(p) === where));
  out.push(...findings.map((finding) => ({ kind: "finding" as const, finding })));

  const entries = index.entries.filter((e) => e.id === h || e.key === h || index.entryName(e) === h);
  out.push(...entries.map((entry) => ({ kind: "entry" as const, entry })));

  const slash = h.indexOf("/");
  const scoped = slash > 0 && !/[\s.:]/.test(h);
  const entities = index.entities.filter((t) => (scoped ? `${t.node}/${t.name}` === h : t.name === h));
  out.push(...entities.map((entity) => ({ kind: "entity" as const, entity })));

  out.push(...index.topics.filter((t) => t.name === h).map((t) => ({ kind: "topic" as const, node: t.node, name: t.name })));

  // Une fonction déjà couverte par un point d'entrée trouvé sous le même nom n'est pas un second départ.
  const handled = new Set(entries.flatMap((e) => (e.handler ? [at(e.handler)] : [])));
  const address = h.match(ADDRESS);
  const fns = address
    ? [index.functionAt({ path: address[1]!, line: Number(address[2]) })].filter((f): f is CodeFunction => !!f)
    : index.functions.filter((f) => f.name === h);
  out.push(...fns.filter((f) => !handled.has(at(f.proof))).map((fn) => ({ kind: "function" as const, fn })));

  return out;
}
