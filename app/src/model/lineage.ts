import type { ArchNode, Entity, Entrypoint, Field, Finding, MapPayload, Proof } from "../api/types";
import { findEntry } from "./flow";

/**
 * F3, la lignée d'un champ : qui l'écrit, et où il va. Tout vient du code lu :
 * - à gauche, les points d'entrée dont le code écrit le champ, avec la valeur quand elle est littérale ;
 * - à droite, ceux qui le lisent en le nommant ; les services que leur déroulé appelle, en suivant une file jusqu'à
 *   son consommateur ; le journal qui écrit la requête d'où vient la valeur (constat personal_data_logged) ;
 * - en bas, les lignes du code qui suppriment des lignes de la table, ou leur absence.
 * Que la valeur parte vraiment vers un service n'est pas suivi : le champ est lu dans un déroulé qui l'appelle.
 */

export interface LineageEnd { key: string; label: string; sub: string; tone: "plain" | "danger" | "outside" | "log"; verb: string; proof?: Proof; entry?: string }
export interface Lineage { field: Field; personal: boolean; from: LineageEnd[]; to: LineageEnd[]; whole: number; deletes: NonNullable<Entity["deletes"]>; sentence: string }

/** Les mots qui désignent une donnée personnelle, comme le pack des journaux (vision/packs/logs.ts). */
const PERSONAL = new Set(["email", "mail", "password", "passwd", "phone", "telephone", "address", "birthdate", "birthday", "ssn", "iban"]);
const personal = (name: string) => name.split(/[_\W]|(?=[A-Z])/).map((w) => w.toLowerCase()).some((w) => PERSONAL.has(w));

const entryLabel = (e: Entrypoint) => e.key;

/** Les services qu'un déroulé appelle ; une mise en file mène au consommateur de la file, et à ce qu'il appelle. */
function services(p: MapPayload, entry: Entrypoint, seen = new Set<string>()): { node: ArchNode; via?: string; proof: Proof }[] {
  if (seen.has(entry.id)) return [];
  seen.add(entry.id);
  const nodes = new Map(p.model.nodes.map((n) => [n.id, n]));
  const out: { node: ArchNode; via?: string; proof: Proof }[] = [];
  for (const s of entry.flow ?? []) {
    const target = s.target ? nodes.get(s.target.node) : undefined;
    if (s.kind === "request" && target?.level === "system" && !target.id.startsWith("actor:")) out.push({ node: target, proof: s.proof });
    if (s.kind === "message" && s.target?.topic) {
      for (const n of p.model.nodes) for (const c of n.facets.entrypoints ?? []) {
        if (c.kind !== "message" || c.key !== s.target.topic) continue;
        for (const x of services(p, c, seen)) out.push({ ...x, via: x.via ?? `file ${s.target.topic}` });
      }
    }
  }
  // Un appel écrit dans le code que le point d'entrée exécute, hors de son déroulé (derrière un contrat choisi au chargement).
  const files = new Set(entry.files ?? []);
  for (const e of p.model.edges) {
    const target = nodes.get(e.to);
    if (e.kind !== "request" || target?.level !== "system" || out.some((x) => x.node.id === target.id)) continue;
    const o = e.occurrences.find((x) => files.has(x.path) && (!x.entrypoints || x.entrypoints.includes(entry.id)));
    if (o) out.push({ node: target, proof: o });
  }
  return out;
}

export function lineage(p: MapPayload, entity: Entity, field: Field): Lineage {
  const from: LineageEnd[] = [];
  for (const w of field.writes ?? []) {
    if (!w.node) continue;
    for (const id of w.entrypoints ?? []) {
      const e = findEntry(p, id)?.entry;
      if (!e || from.some((x) => x.key === id)) continue;
      from.push({ key: id, entry: id, label: entryLabel(e), sub: w.value !== undefined ? `pose ${w.value}` : w.fn ?? "valeur calculée", tone: "plain", verb: "écrit", proof: w.proof });
    }
  }

  const to: LineageEnd[] = [];
  const named = (field.reads ?? []).filter((r) => !r.whole && r.node);
  const unguarded = p.model.findings.filter((f) => f.code === "unguarded_route");
  for (const r of named) for (const id of r.entrypoints ?? []) {
    const e = findEntry(p, id)?.entry;
    if (!e || to.some((x) => x.key === id)) continue;
    const bad = unguarded.find((f) => f.message.includes(`« ${e.key} »`));
    const why = bad && (/sans garde de rôle/.test(bad.message) ? "sans garde de rôle" : "sans garde");
    to.push({ key: id, entry: id, label: entryLabel(e), sub: why || `lu par ${r.fn ?? "?"}`, tone: bad ? "danger" : "plain", verb: bad ? "exposé" : "lu", proof: r.proof });
    for (const s of services(p, e)) {
      if (to.some((x) => x.key === `svc:${s.node.id}`)) continue;
      to.push({ key: `svc:${s.node.id}`, label: s.node.name, sub: s.via ? `après lecture, par la ${s.via}` : `appelé par ${e.key}`, tone: "outside", verb: "atteint", proof: s.proof });
    }
  }

  // Le journal qui écrit la requête d'où vient la valeur, ou le champ lui-même.
  const writePaths = new Set((field.writes ?? []).map((w) => w.proof.path));
  const logged = p.model.findings.filter((f: Finding) => f.code === "personal_data_logged" && (writePaths.has(f.proof[0]?.path ?? "") || f.message.includes(`\`${field.name}\``)));
  for (const f of logged) {
    const at = f.proof[0]!;
    to.push({ key: `log:${at.path}:${at.line}`, label: "journal", sub: f.message.includes("corps entier") ? "avec toute la requête" : "le champ", tone: "danger", verb: "journalisé", proof: at });
  }

  const whole = new Set((field.reads ?? []).filter((r) => r.whole).flatMap((r) => r.entrypoints ?? [])).size;
  const deletes = entity.deletes ?? [];
  const out = [...new Set(to.filter((x) => x.tone === "outside").map((x) => x.label))];
  const logs = to.some((x) => x.verb === "journalisé");
  const and = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}` : xs[0] ?? "";
  const sentence = `\`${entity.name}.${field.name}\` ${from.length ? `est écrit par ${from.length} point${from.length > 1 ? "s" : ""} d'entrée` : "n'est écrit par aucun point d'entrée lu"}`
    + (to.length ? `, lu en le nommant par ${to.filter((x) => x.entry).length}` : "")
    + (out.length ? ` ; il atteint ${and(out)}` : "")
    + (logs ? `${out.length ? "," : " ;"} et il est journalisé` : "")
    + (deletes.length ? `. Une ligne est supprimée en ${deletes.length} endroit${deletes.length > 1 ? "s" : ""}.` : ". Aucune ligne n'est supprimée dans le code lu.");
  return { field, personal: personal(field.name), from, to, whole, deletes, sentence };
}

/** Les champs dont la lignée dit quelque chose : lus en les nommant, ou journalisés ; ceux qui sortent du système d'abord. */
export function lineageFields(p: MapPayload, entity: Entity): Lineage[] {
  const all = (entity.fields ?? []).map((f) => lineage(p, entity, f)).filter((l) => l.to.length);
  const weight = (l: Lineage) => l.to.filter((x) => x.tone !== "plain").length * 2 + Number(l.personal);
  return all.sort((a, b) => weight(b) - weight(a));
}
