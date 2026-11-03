import type { ArchEdge, ArchModelV2, ArchNode, Entity, Proof } from "../arch/types.js";
import type { MapChange } from "./types.js";

const VERB: Record<ArchEdge["kind"], string> = {
  call: "appelle", request: "appelle", read: "lit", write: "écrit",
  message: "met en file", trigger: "déclenche", use: "utilise", deploy: "déploie",
};

const ENTITY_WORD: Partial<Record<string, string>> = { relational: "table", document: "collection" };

/** Les éléments d'une carte, chacun sous une clé stable, avec le texte qui le dit et sa preuve. */
function items(model: ArchModelV2): Map<string, { text: string; proof?: Proof }> {
  const out = new Map<string, { text: string; proof?: Proof }>();
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  for (const n of model.nodes) {
    if (n.level === "system" || n.level === "deployable") out.set(`node:${n.id}`, { text: `bloc ${n.name}`, proof: n.proof[0] });
    for (const e of n.facets.entrypoints ?? []) {
      if (e.kind !== "main") out.set(`entry:${e.id}`, { text: `${e.key} dans ${n.name}`, proof: e.proof });
    }
    for (const entity of n.facets.data?.entities ?? []) addEntity(out, n, entity);
    for (const m of n.facets.trust?.mechanisms ?? []) out.set(`trust:${n.id}:${m.name}`, { text: `${n.name} reconnaît ses appelants par ${m.name}`, proof: m.proof });
    for (const c of n.facets.contract ?? []) {
      for (const i of c.implementations) out.set(`impl:${c.name}:${i.name}`, { text: `${i.name} implémente ${c.name}`, proof: { path: i.path, line: i.line, source: "syntax" } });
      for (const b of c.bindings ?? []) out.set(`bind:${c.name}:${b.implementation}:${b.proof.path}`, { text: `${c.name} reçoit ${b.implementation}`, proof: b.proof });
      for (const k of c.consumers ?? []) out.set(`recv:${c.name}:${k.name}`, { text: `${k.name} reçoit ${c.name}`, proof: k.proof });
    }
  }
  for (const e of model.edges) {
    const target = e.target?.entity ?? e.target?.topic ?? e.target?.entrypoint;
    out.set(`edge:${e.id}`, {
      text: `${names.get(e.from) ?? e.from} ${VERB[e.kind]} ${names.get(e.to) ?? e.to}${target ? ` · ${target}` : ""}`,
      proof: e.occurrences[0],
    });
  }
  for (const f of model.findings) out.set(`finding:${f.code}:${f.message}`, { text: f.message, proof: f.proof[0] });
  return out;
}

function addEntity(out: Map<string, { text: string; proof?: Proof }>, node: ArchNode, entity: Entity): void {
  const word = ENTITY_WORD[node.facets.data!.shape] ?? "entité";
  out.set(`entity:${node.id}:${entity.name}`, { text: `${word} ${entity.name}`, proof: entity.proof });
  for (const f of entity.fields ?? []) {
    const field = `${entity.name}.${f.name}`;
    out.set(`field:${node.id}:${field}`, { text: `champ ${field}`, proof: f.proof });
    for (const v of f.values ?? []) out.set(`value:${node.id}:${field}:${v}`, { text: `${field} accepte « ${v} »`, proof: f.proof });
  }
}

const ORDER = ["node", "entry", "trust", "entity", "field", "value", "edge", "finding"];

/**
 * Ce qui a changé d'une analyse à la suivante : ce qui est apparu, ce qui a
 * disparu. Un élément enfant n'est pas répété quand son parent change avec lui
 * (une table ajoutée ne liste pas ses champs).
 */
export function mapChanges(before: ArchModelV2, after: ArchModelV2): MapChange[] {
  const [a, b] = [items(before), items(after)];
  const out: MapChange[] = [];
  const covered = (key: string, side: Map<string, unknown>, other: Map<string, unknown>) => {
    const [kind, node, path] = key.split(":");
    if (kind === "field" || kind === "value") {
      const entity = `entity:${node}:${path!.split(".")[0]}`;
      if (side.has(entity) && !other.has(entity)) return true;
    }
    if (kind === "value") {
      const field = `field:${node}:${path}`;
      if (side.has(field) && !other.has(field)) return true;
    }
    return false;
  };
  for (const [key, item] of b) if (!a.has(key) && !covered(key, b, a)) out.push({ sign: "added", kind: kindOf(key), ...item });
  for (const [key, item] of a) if (!b.has(key) && !covered(key, a, b)) out.push({ sign: "removed", kind: kindOf(key), ...item });
  return out.sort((x, y) => ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind) || Number(x.sign === "removed") - Number(y.sign === "removed"));
}

function kindOf(key: string): MapChange["kind"] {
  return key.slice(0, key.indexOf(":")) as MapChange["kind"];
}
