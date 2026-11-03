import type { ArchNode, Entity, Finding, KnowledgePayload, MapPayload, Proof } from "../api/types";
import { lifecycle, writers, type Writer } from "./data";
import { plural } from "./words";

/**
 * La planche 05b (Données, une table) : ce qu'une table veut dire. Comment elle circule (F1, le déroulé de
 * chaque point d'entrée qui l'écrit), par quels états elle passe (T1), ce qui en est dit (C4 : les
 * commentaires de l'auteur, les affirmations des agents), sa forme et ce que la base garantit. Tout vient du
 * code et de ce que les agents ont déclaré ; aucune phrase n'est rédigée par un modèle.
 */

export interface Said { who: "author" | "agent"; text: string; about?: string; proof?: Pick<Proof, "path" | "line">; state?: string; type?: string }
export interface Guarantee { text: string; proof: Proof; said?: string }

export interface TableView {
  store: ArchNode; entity: Entity;
  sentence: string;
  writers: Writer[]; readers: number;
  life: ReturnType<typeof lifecycle>;
  said: Said[];
  base: Guarantee[];
  watch: Finding[];
}

export function findTable(p: MapPayload, item: string): { store: ArchNode; entity: Entity } | undefined {
  const [storeId, name] = item.includes("/") ? [item.slice(0, item.indexOf("/")), item.slice(item.indexOf("/") + 1)] : [undefined, item];
  for (const n of p.model.nodes) {
    if (storeId && n.id !== storeId) continue;
    const entity = n.facets.data?.entities.find((e) => e.name === name);
    if (entity) return { store: n, entity };
  }
  return undefined;
}

export function tableView(p: MapPayload, store: ArchNode, entity: Entity, knowledge?: KnowledgePayload): TableView {
  const name = entity.name;
  const life = lifecycle(entity);
  // Celui qui la fait naître d'abord (il pose l'état de départ), puis les autres.
  const w = writers(p, store, entity).sort((a, b) => Number(b.verb === `pose ${life?.start}`) - Number(a.verb === `pose ${life?.start}`));
  const readers = new Set(p.model.edges.filter((x) => x.to === store.id && x.kind === "read" && x.target?.entity === name)
    .flatMap((x) => x.occurrences.flatMap((o) => o.entrypoints ?? []))).size;
  const watch = p.model.findings.filter((f) => new RegExp(`(^|[^\\w])${name}([^\\w]|$)`).test(f.message) && ["read_outside_tx", "race_read_then_write", "unused_value", "write_then_enqueue"].includes(f.code));
  const sentence = life?.sentence
    ?? `\`${name}\` est écrite par ${plural(w.length, "point d'entrée", "points d'entrée")} et lue par ${plural(readers, "autre", "autres")}.`;
  return { store, entity, sentence, writers: w, readers, life, said: said(entity, knowledge), base: guarantees(store, entity), watch };
}

/** Ce qui est dit de la table : par l'auteur, en commentaire là où il la déclare ; par les agents, ancré dans le code. */
function said(entity: Entity, knowledge?: KnowledgePayload): Said[] {
  const out: Said[] = [];
  if (entity.comment) out.push({ who: "author", text: entity.comment, ...(entity.proof ? { proof: entity.proof } : {}) });
  for (const f of entity.fields ?? []) if (f.comment) out.push({ who: "author", text: f.comment, about: f.name, ...(f.proof ? { proof: f.proof } : {}) });
  for (const c of entity.constraints ?? []) if (c.comment) out.push({ who: "author", text: c.comment, about: c.name ?? c.fields.join(", "), proof: c.proof });
  const names = new Set([entity.name.toLowerCase()]);
  for (const c of knowledge?.report.concepts ?? []) {
    const mine = c.kind === "entity" && names.has(c.name.toLowerCase());
    for (const claim of c.claims) {
      const anchored = claim.anchors.some((a) => (a.ref.symbol ?? "").toLowerCase() === entity.name.toLowerCase() || (entity.proof && a.at?.path === entity.proof.path && a.ref.symbol?.toLowerCase().startsWith(entity.name.toLowerCase())));
      if (!mine && !anchored) continue;
      const at = claim.anchors.find((a) => a.at)?.at;
      out.push({ who: "agent", text: claim.text, type: claim.type, state: claim.state, ...(at ? { proof: { path: at.path, line: at.line } } : {}) });
    }
  }
  return out;
}

/** Ce que la base garantit, en phrases : unicité, condition, et ce que fait une suppression, dans les deux sens. */
function guarantees(store: ArchNode, entity: Entity): Guarantee[] {
  const out: Guarantee[] = [];
  const code = (s: string) => `\`${s}\``;
  for (const c of entity.constraints ?? []) {
    const at = out.length;
    if (c.kind === "unique" && !c.where) out.push({ text: c.fields.length > 1 ? `Une seule ligne par ${c.fields.map(code).join(" et ")}.` : `Deux lignes n'ont jamais le même ${code(c.fields[0]!)}.`, proof: c.proof });
    if ((c.kind === "unique" || c.kind === "index") && c.where) out.push({ text: `Une seule ligne par ${c.fields.map(code).join(" et ")}, si ${code(c.where)}.`, proof: c.proof });
    if (c.kind === "check" && c.where) out.push({ text: `Toujours vrai : ${code(c.where)}.`, proof: c.proof });
    if (c.kind === "foreign" && c.references) {
      const r = code(c.references);
      const t = c.onDelete === "Cascade" ? `Supprimée avec sa ligne de ${r}.`
        : c.onDelete === "SetNull" ? `Gardée sans ${r} quand sa ligne de ${r} est supprimée.`
        : c.onDelete === "Restrict" || c.onDelete === "NoAction" ? `Sa ligne de ${r} ne peut pas être supprimée tant qu'elle existe.`
        : `Renvoie toujours à une ligne de ${r}.`;
      out.push({ text: t, proof: c.proof });
    }
    if (c.comment && out[at]) out[at]!.said = c.comment;
  }
  // Les tables qui la visent : ce que sa suppression leur fait.
  for (const other of store.facets.data?.entities ?? []) {
    if (other.name === entity.name) continue;
    for (const c of other.constraints ?? []) {
      if (c.kind !== "foreign" || c.references !== entity.name || !c.onDelete) continue;
      const o = code(other.name);
      const t = c.onDelete === "Cascade" ? `La supprimer supprime ses lignes de ${o}.`
        : c.onDelete === "SetNull" ? `La supprimer laisse ses lignes de ${o} sans elle.`
        : c.onDelete === "Restrict" || c.onDelete === "NoAction" ? `Elle ne peut pas être supprimée tant qu'une ligne de ${o} la vise.`
        : "";
      if (t) out.push({ text: t, proof: c.proof });
    }
  }
  return out;
}
