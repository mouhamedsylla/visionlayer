import type { ArchNode, Entity, Entrypoint, Field, FlowStep, MapPayload, Proof } from "../api/types";
import { chainOf, type Link } from "./features";
import { findEntry } from "./flow";
import { queues, type QueueView } from "./mechanisms";
import { triggers } from "./tasks";
import { plural } from "./words";

/**
 * Les parcours d'un projet : un processus suivi à travers plusieurs points d'entrée. Soit une donnée à états
 * (ce qui fait passer une ligne de `bookings` à `confirmed`, qui le déclenche : un client, un webhook, l'horloge),
 * soit une file (qui dépose, qui consomme). Tout vient des écritures et des déroulés lus dans le code.
 */

export type TriggerKind = "client" | "external" | "clock" | "queue" | "none";
export interface ProcStep {
  id: string; entry?: Entrypoint; fns: string[]; proof: Proof;
  trigger: { kind: TriggerKind; label: string };
  chain: Link[];
  /** Les conditions de refus qui parlent de cet état : le code tel qu'il est écrit. */
  guards: { when: string; status: string; proof: Proof }[];
  /** Ce qui reprend ensuite de façon asynchrone : le consommateur de la file où ce pas dépose. */
  then: { topic: string; steps: ProcStep[] }[];
}
export interface ProcStage { id: string; label: string; tone: "start" | "state" | "any" | "queue"; note?: string; steps: ProcStep[] }
export interface Process { id: string; kind: "state" | "queue"; name: string; sub: string; triggers: TriggerKind[]; stages: ProcStage[]; never: string[]; sentence: string; table?: string }

const STATEFUL = /(^|_)(status|state|stage|phase|step)$/i;
const CREATE = /\.(create|createMany|upsert|insert|insertMany|save)\b|\binsert\s*\(|\bINSERT\s+INTO\b/i;
const WORD = (v: string) => new RegExp(`(^|[^\\w])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w])`);

/** Les étapes de la fonction `fns` dans un déroulé : ce qui suit son appel, plus profond que lui. Sans appel lu, tout le déroulé. */
function sliceOf(flow: FlowStep[], fns: string[]): FlowStep[] {
  const at = flow.findIndex((s) => s.kind === "invoke" && s.name && fns.includes(s.name));
  if (at < 0) return flow;
  const depth = flow[at]!.depth ?? 0;
  const out: FlowStep[] = [];
  for (const s of flow.slice(at + 1)) { if ((s.depth ?? 0) <= depth) break; out.push(s); }
  return out.length ? out : flow;
}

/** Le consommateur d'une file : celui qui porte son nom quand il y en a un, sinon tous ceux que la file déclenche. */
function consumersOf(q: QueueView | undefined) {
  const list = q?.consumers ?? [];
  const named = list.filter((c) => c.entry.key === q!.topic);
  return named.length ? named : list;
}

function buildStep(p: MapPayload, entry: Entrypoint | undefined, fns: string[], proof: Proof, field: Field | undefined, depth: number): ProcStep {
  const nodeName = (id: string) => p.model.nodes.find((n) => n.id === id)?.name ?? id;
  const t = entry ? triggers(p).find((x) => x.entry.id === entry.id) : undefined;
  const app = entry?.calledBy?.map((id) => p.model.nodes.find((n) => n.id === id)).find((n) => n && n.role !== "external");
  const hook = entry && entry.kind === "http" && /webhook|\/hooks?\//i.test(entry.key);
  const trigger = !entry ? { kind: "none" as const, label: "point d'entrée non lu" }
    : t?.kind === "schedule" ? { kind: "clock" as const, label: t.when }
    : t?.kind === "queue" ? { kind: "queue" as const, label: `file ${entry.key}` }
    : t?.kind === "webhook" ? { kind: "external" as const, label: t.name }
    : hook ? { kind: "external" as const, label: "webhook" }
    : { kind: "client" as const, label: app?.name ?? "appel HTTP" };
  // Un point d'entrée qui aiguille (un webhook à plusieurs cas) : seule la branche de la fonction qui écrit compte.
  const steps = sliceOf(entry?.flow ?? [], fns);
  const mentions = (w: string) => !!field && (WORD(field.name).test(w) || (field.values ?? []).some((v) => WORD(v).test(w)));
  const guards = steps.filter((s) => s.kind === "refuse" && s.when && mentions(s.when)).slice(0, 3)
    .map((s) => ({ when: s.when!, status: [s.status, s.code].filter(Boolean)[0] ?? "refus", proof: s.proof }));
  const chain = chainOf(steps, nodeName).flatMap((l) => {
    if (l.kind !== "refuse") return [l];
    const values = l.values.filter((v) => v !== "erreur");
    return values.length ? [{ ...l, values }] : [];
  });
  const topics = depth > 0 ? [] : [...new Set(chain.filter((l) => l.kind === "message").flatMap((l) => l.values))];
  const then = topics.flatMap((topic) => {
    const q = queues(p).find((x) => x.topic === topic);
    const list = consumersOf(q).filter((c) => c.entry.id !== entry?.id).map((c) => buildStep(p, c.entry, [], c.entry.proof, field, depth + 1));
    return list.length ? [{ topic, steps: list }] : [];
  });
  return { id: entry?.id ?? `${proof.path}:${proof.line}`, ...(entry ? { entry } : {}), fns, proof, trigger, chain, guards, then };
}

/** Les pas d'une liste d'écritures : un par point d'entrée, même écrit à plusieurs endroits. */
function stepsOf(p: MapPayload, writes: NonNullable<Field["writes"]>, field: Field, table: string): ProcStep[] {
  const out = new Map<string, { entry?: Entrypoint; fns: string[]; proof: Proof }>();
  for (const w of writes) {
    // Les points d'entrée dont le déroulé passe par cette ligne ; à défaut, ceux qui écrivent cette table.
    const all = (w.entrypoints ?? []).map((id) => findEntry(p, id)?.entry).filter((e): e is Entrypoint => !!e);
    const atLine = all.filter((e) => e.flow?.some((s) => s.proof.path === w.proof.path && s.proof.line === w.proof.line));
    const onTable = all.filter((e) => e.flow?.some((s) => s.kind === "write" && s.target?.entity === table));
    const viaFn = onTable.filter((e) => w.fn && (e.handler?.name === w.fn || e.flow?.some((s) => s.kind === "invoke" && s.name === w.fn)));
    const direct = [...new Set([...atLine, ...viaFn])];
    const kept = direct.length ? direct : onTable;
    const ids = kept.length ? kept.map((e) => e.id) : [`?${w.fn ?? w.proof.path}`];
    for (const id of ids) {
      const entry = id.startsWith("?") ? undefined : findEntry(p, id)?.entry;
      const at = out.get(id) ?? out.set(id, { ...(entry ? { entry } : {}), fns: [], proof: w.proof }).get(id)!;
      if (w.fn && !at.fns.includes(w.fn)) at.fns.push(w.fn);
    }
  }
  return [...out.values()].map((x) => buildStep(p, x.entry, x.fns, x.proof, field, 0));
}

/** Les points d'entrée qui créent une ligne, quand le champ d'état est posé par la base et que personne ne l'écrit à la création. */
function creators(p: MapPayload, entity: Entity, field: Field): ProcStep[] {
  const out: ProcStep[] = [];
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) {
    const s = (e.flow ?? []).find((x) => x.kind === "write" && x.target?.entity === entity.name && CREATE.test(x.proof.text ?? ""));
    if (s) out.push(buildStep(p, e, s.name ? [s.name] : [], s.proof, field, 0));
  }
  return out;
}

function stateProcess(p: MapPayload, store: ArchNode, entity: Entity, field: Field): Process | undefined {
  const writes = (field.writes ?? []).filter((w) => w.node);
  const values = field.values ?? [];
  const byValue = (v: string) => writes.filter((w) => w.value === v);
  const start = field.default && values.includes(field.default) ? field.default : undefined;
  const stages: ProcStage[] = [];
  if (start) {
    const own = stepsOf(p, byValue(start), field, entity.name);
    const made = own.length ? own : creators(p, entity, field);
    stages.push({ id: start, label: start, tone: "start", note: own.length ? "état de départ" : "état posé par la base à la création", steps: made });
  }
  for (const v of values) if (v !== start && byValue(v).length) stages.push({ id: v, label: v, tone: "state", steps: stepsOf(p, byValue(v), field, entity.name) });
  const computed = writes.filter((w) => !w.value);
  const rest = values.filter((v) => v !== start && !byValue(v).length);
  if (computed.length) stages.push({ id: "*", label: "valeur calculée", tone: "any", ...(rest.length ? { note: `peut poser ${rest.join(", ")}` } : {}), steps: stepsOf(p, computed, field, entity.name) });
  if (stages.length < 2 && !computed.length) return undefined;
  const kinds = [...new Set(stages.flatMap((s) => s.steps.map((x) => x.trigger.kind)))].filter((k) => k !== "none");
  const never = computed.length ? [] : rest;
  const who = [...new Set(stages.flatMap((s) => s.steps.map((x) => x.trigger.label)))].filter((l) => l !== "point d'entrée non lu");
  const sentence = `\`${entity.name}.${field.name}\` : ${plural(stages.filter((s) => s.tone !== "any").length, "état écrit", "états écrits")}, déclenchés par ${who.slice(0, 4).join(", ")}${who.length > 4 ? ` et ${who.length - 4} autres` : ""}.${never.length ? ` ${never.join(", ")} : jamais écrit par le code.` : ""}`;
  return { id: `etat:${store.id}/${entity.name}.${field.name}`, kind: "state", name: entity.name, sub: field.name, triggers: kinds, stages, never, sentence, table: `${store.id}/${entity.name}` };
}

export function processes(p: MapPayload): Process[] {
  const states: Process[] = [];
  for (const n of p.model.nodes) for (const e of n.facets.data?.entities ?? []) for (const f of e.fields ?? []) {
    if (!f.values?.length) continue;
    const x = stateProcess(p, n, e, f);
    if (x) states.push(x);
  }
  const weight = (x: Process) => (STATEFUL.test(x.sub) ? 100 : 0) + x.triggers.length * 10 + x.stages.length;
  states.sort((a, b) => weight(b) - weight(a));
  const files: Process[] = queues(p).flatMap((q) => {
    const ids = [...new Set(p.model.edges.filter((e) => e.to === q.node.id && e.kind === "message" && (e.target?.topic ?? q.topic) === q.topic).flatMap((e) => e.occurrences.flatMap((o) => o.entrypoints ?? [])))];
    const producers = ids.map((id) => findEntry(p, id)?.entry).filter((e): e is Entrypoint => !!e).filter((e) => e.flow?.some((s) => s.kind === "message" && (s.target?.topic ?? q.topic) === q.topic)).map((e) => buildStep(p, e, [], e.proof, undefined, 1));
    const consumers = consumersOf(q).map((c) => buildStep(p, c.entry, [], c.entry.proof, undefined, 1));
    if (!producers.length && !consumers.length) return [];
    const stages: ProcStage[] = [
      ...(producers.length ? [{ id: "dépose", label: `dépose dans ${q.topic}`, tone: "queue" as const, steps: producers }] : []),
      ...(consumers.length ? [{ id: "consomme", label: `consomme ${q.topic}`, tone: "queue" as const, steps: consumers }] : []),
    ];
    const kinds = [...new Set(stages.flatMap((s) => s.steps.map((x) => x.trigger.kind)))];
    const sentence = `File \`${q.topic}\` : ${producers.length ? `${plural(producers.length, "point d'entrée y dépose", "points d'entrée y déposent")}` : "aucun dépôt lu dans le code"}${consumers.length ? `, ${plural(consumers.length, "consommateur", "consommateurs")}` : ", aucun consommateur lu"}.`;
    return [{ id: `file:${q.id}`, kind: "queue" as const, name: q.topic, sub: "file", triggers: kinds, stages, never: [], sentence }];
  });
  return [...states, ...files];
}
