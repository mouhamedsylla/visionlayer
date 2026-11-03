import type { ArchNode, MapPayload, Proof } from "../api/types";
import { plural } from "./words";

type Contract = NonNullable<ArchNode["facets"]["contract"]>[number];

/** Une ligne de X3 : une implémentation, où le conteneur la branche, ce qui la choisit, et ce qu'elle appelle. */
export interface ImplRow { name: string; proof: Proof; bound: Proof[]; when?: string; calls: string[]; packages: string[] }

/** Un contrat lu : l'interface ou la classe abstraite, ses implémentations, ceux qui le reçoivent. */
export interface ContractView { id: string; node: ArchNode; c: Contract; impls: ImplRow[]; consumers: { name: string; proof: Proof }[]; sentence: string }

export function contracts(map: MapPayload): ContractView[] {
  const out: ContractView[] = [];
  for (const node of map.model.nodes) for (const c of node.facets.contract ?? []) {
    const impls: ImplRow[] = c.implementations.map((i) => {
      const choice = c.selector?.choices?.find((x) => x.implementation === i.name);
      return {
        name: i.name,
        proof: { path: i.path, line: i.line, source: "syntax" },
        bound: (c.bindings ?? []).filter((b) => b.implementation === i.name).map((b) => b.proof),
        ...(choice ? { when: choice.when ?? "sinon" } : {}),
        calls: [...new Set((i.calls ?? []).map((x) => x.name))],
        packages: i.packages ?? [],
      };
    });
    const consumers = c.consumers ?? [];
    out.push({ id: `${node.id}/${c.name}`, node, c, impls, consumers, sentence: sentenceOf(c.name, impls, consumers, c.selector?.config) });
  }
  return out.sort((a, b) => b.consumers.length - a.consumers.length || a.c.name.localeCompare(b.c.name));
}

function sentenceOf(name: string, impls: ImplRow[], consumers: { name: string }[], config?: string[]): string {
  const who = consumers.length ? `${consumers.map((k) => k.name).slice(0, 2).join(" et ")}${consumers.length > 2 ? ` et ${consumers.length - 2} autres` : ""} ${consumers.length > 1 ? "le reçoivent" : "le reçoit"} du conteneur` : "aucune classe ne le reçoit d'un conteneur, d'après ce qui est lu";
  const bound = impls.filter((i) => i.bound.length).length;
  const how = config?.length ? `, choisie selon ${config.join(", ")}` : bound ? `, ${bound === impls.length ? "chacune branchée" : `${bound} branchées`} par le conteneur` : "";
  return `${name} a ${plural(impls.length, "implémentation", "implémentations")}${how} ; ${who}.`;
}

type Entry = NonNullable<ArchNode["facets"]["entrypoints"]>[number];
const findEntry = (map: MapPayload, id: string) => {
  for (const n of map.model.nodes) for (const e of n.facets.entrypoints ?? []) if (e.id === id) return { node: n, entry: e };
  return undefined;
};

/** F2 : une file, qui y dépose (et depuis quel point d'entrée), qui la consomme, et ce que fait le consommateur. */
export interface QueueView {
  id: string; node: ArchNode; topic: string; proof: Proof;
  producers: { proof: Proof; entries: string[]; risk?: string }[];
  consumers: { node: ArchNode; entry: Entry; effects: { verb: string; what: string }[]; refuses: string[] }[];
}

const VERB: Record<string, string> = { read: "lit", write: "écrit", request: "appelle", call: "appelle", message: "met en file" };

export function queues(map: MapPayload): QueueView[] {
  const out: QueueView[] = [];
  const name = (id: string) => map.model.nodes.find((n) => n.id === id)?.name ?? id;
  for (const node of map.model.nodes) for (const t of node.facets.channel?.topics ?? []) {
    const producers = map.model.edges.filter((e) => e.to === node.id && e.kind === "message" && (e.target?.topic ?? t.name) === t.name)
      .flatMap((e) => e.occurrences.map((o) => {
        const f = map.model.findings.find((x) => x.code === "write_then_enqueue" && x.proof[0]?.path === o.path && x.proof[0]?.line === o.line);
        return { proof: o as Proof, entries: (o.entrypoints ?? []).map((id) => findEntry(map, id)?.entry.key ?? id), ...(f ? { risk: f.message } : {}) };
      }));
    const consumers = map.model.edges.filter((e) => e.from === node.id && e.kind === "trigger" && e.target?.entrypoint)
      .map((e) => findEntry(map, e.target!.entrypoint!)).filter((x): x is NonNullable<typeof x> => !!x)
      .map(({ node: n, entry }) => {
        const own = map.model.edges.filter((e) => e.from === n.id && VERB[e.kind]);
        const effects = own.map((e) => ({ verb: VERB[e.kind]!, what: e.target?.entity ?? e.target?.topic ?? name(e.to) }));
        const refuses = [...new Set((entry.flow ?? []).filter((s) => s.kind === "refuse").map((s) => s.name ?? s.code ?? "refus"))];
        return { node: n, entry, effects, refuses };
      });
    out.push({ id: `${node.id}/${t.name}`, node, topic: t.name, proof: t.proof, producers, consumers });
  }
  return out;
}

/** X4 : une dépendance sans délai ni limite, qui en dépend, par où, et ce qui reste écrit si elle tombe. */
export interface OutageView {
  id: string; dep: ArchNode; message: string; proof: Proof;
  dependents: { node: ArchNode; how: string; entries: string[] }[];
  leftover: { message: string; proof: Proof }[];
}

export function outages(map: MapPayload): OutageView[] {
  const byId = new Map(map.model.nodes.map((n) => [n.id, n]));
  return map.model.findings.filter((f) => f.code === "missing_timeout").map((f, i) => {
    const dep = (f.nodes ?? []).map((id) => byId.get(id)).find((n) => n && ["store", "channel", "external"].includes(n.role))!;
    // Ceux qui l'appellent, et ceux qu'elle réveille (le worker d'une file) : les deux attendent quand elle tombe.
    const edges = map.model.edges.filter((e) => e.to === dep?.id || (e.from === dep?.id && e.kind === "trigger"));
    const other = (e: (typeof edges)[number]) => (e.to === dep?.id ? e.from : e.to);
    const froms = [...new Set(edges.map(other))];
    const dependents = froms.map((id) => {
      const mine = edges.filter((e) => other(e) === id);
      const kinds = [...new Set(mine.map((e) => (e.kind === "trigger" ? "la consomme" : VERB[e.kind] ?? e.kind)))].join(", ");
      const entries = [...new Set(mine.flatMap((e) => (e.kind === "trigger" && e.target?.entrypoint ? [e.target.entrypoint] : e.occurrences.flatMap((o) => o.entrypoints ?? []))))].map((x) => findEntry(map, x)?.entry.key ?? x);
      return { node: byId.get(id)!, how: kinds, entries };
    }).filter((d) => d.node);
    const leftover = dep?.role === "channel" ? map.model.findings.filter((x) => x.code === "write_then_enqueue").map((x) => ({ message: x.message, proof: x.proof[0]! })) : [];
    return { id: `${dep?.id ?? i}`, dep: dep!, message: f.message, proof: f.proof[0]!, dependents, leftover };
  }).filter((o) => o.dep);
}
