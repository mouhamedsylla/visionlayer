import type { ArchModelV2, Entrypoint, Finding, Proof } from "../../api/types";
import { entryNature } from "../block/entries";
import { reachOf, type EntryRef } from "../features/list";
import { cronLabel } from "../text/cron";
import { joinWords } from "../text/plural";

/**
 * Ce qui tourne sans que personne clique : une tâche planifiée, une file
 * écoutée, un événement reçu, ou une route qu'un service externe appelle et
 * dont la signature est vérifiée (un webhook).
 */
export function isBackground(e: Entrypoint): boolean {
  return e.kind === "schedule" || e.kind === "message" || e.kind === "event" || entryNature(e) === "webhook";
}

const ORDER = ["planifiée", "file", "événement", "webhook"];

/** Les déclencheurs sans clic de toute la carte : planifiés d'abord, puis files, événements et webhooks. */
export function backgroundEntries(model: ArchModelV2): EntryRef[] {
  const out: EntryRef[] = [];
  for (const node of model.nodes) for (const entry of node.facets.entrypoints ?? []) if (isBackground(entry)) out.push({ entry, node });
  return out.sort((a, b) => ORDER.indexOf(entryNature(a.entry)) - ORDER.indexOf(entryNature(b.entry)));
}

/** Qui envoie : les blocs qui appellent ce point d'entrée ou lui envoient un message. */
export function sendersOf(entry: Entrypoint, model: ArchModelV2, names: Map<string, string>): string[] {
  const ids = [...(entry.calledBy ?? []), ...model.edges.filter((x) => x.target?.entrypoint === entry.id).map((x) => x.from)];
  return [...new Set(ids)].map((id) => names.get(id) ?? id);
}

/** Quand il se lance, en mots : `chaque jour à 3 h`, `un job dans la file emails`, `quand Stripe envoie`. */
export function whenLabel(entry: Entrypoint, model: ArchModelV2, names: Map<string, string>): string {
  if (entry.kind === "schedule") return cronLabel(entry.key);
  if (entry.kind === "message") return `un job dans la file ${entry.key}`;
  const senders = sendersOf(entry, model, names).filter((s) => !model.nodes.some((n) => n.name === s && n.role === "channel"));
  return senders.length ? `quand ${joinWords(senders)} envoie` : "quand un événement arrive";
}

/** Ce qu'il fait, d'après son déroulé : `lit bookings · écrit bookings, slots · met en file emails`. */
export function doesLabel(entry: Entrypoint, names: Map<string, string>): string {
  const steps = entry.flow ?? [];
  const of = (kind: string) => [...new Set(steps.filter((s) => s.kind === kind).map((s) => s.target?.entity ?? s.target?.topic).filter(Boolean))];
  const reach = reachOf(entry, names);
  const parts = [
    of("read").length ? `lit ${of("read").join(", ")}` : "",
    of("write").length ? `écrit ${of("write").join(", ")}` : "",
    reach.topics.length ? `met en file ${reach.topics.join(", ")}` : "",
    reach.services.length ? `appelle ${reach.services.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Une branche lue : une fonction du dépôt appelée sous une condition, telle qu'écrite. `event.type === "charge.refunded"` → markRefunded. */
export interface Branch {
  when: string;
  name: string;
  proof: Proof;
}

export function branchesOf(entry: Entrypoint): Branch[] {
  return (entry.flow ?? []).filter((s) => s.kind === "invoke" && s.when && s.name).map((s) => ({ when: s.when!, name: s.name!, proof: s.proof }));
}

/** Combien de fois une tâche planifiée part à chaque échéance : le nombre d'exemplaires de son bloc, d'après le constat. */
export function launchesOf({ entry, node }: EntryRef, model: ArchModelV2): { times: number; finding: Finding } | undefined {
  if (entry.kind !== "schedule") return undefined;
  const finding = model.findings.find((f) => f.code === "scheduled_on_every_instance" && (f.nodes ?? []).includes(node.id));
  return finding && node.instances && node.instances.min > 1 ? { times: node.instances.min, finding } : undefined;
}

/** Les variables d'environnement que son code lit : noms seulement, jamais les valeurs. */
export function envOf({ entry, node }: EntryRef): { name: string; required?: boolean; at: Proof[] }[] {
  const vars = node.facets.config?.env ?? [];
  const files = new Set([entry.handler?.path, ...(entry.files ?? [])]);
  // Un fichier qui lit presque toutes les variables les déclare : il ne dit pas qui s'en sert.
  const perFile = new Map<string, number>();
  for (const v of vars) for (const p of new Set(v.readAt.map((r) => r.path))) perFile.set(p, (perFile.get(p) ?? 0) + 1);
  const declares = (path: string) => vars.length > 3 && (perFile.get(path) ?? 0) > vars.length / 2;
  return vars
    .map((v) => ({ name: v.name, required: v.required, at: v.readAt.filter((p) => files.has(p.path) && !declares(p.path)) }))
    .filter((v) => v.at.length > 0);
}

/** Le titre du trajet : `Le trajet d'un événement Stripe`, `Le trajet d'un job de la file emails`, `Ce que fait chaque échéance`. */
export function journeyTitle(entry: Entrypoint, senders: string[]): string {
  if (entry.kind === "schedule") return "Ce que fait chaque échéance";
  if (entry.kind === "message") return `Le trajet d'un job de la file ${entry.key}`;
  return senders.length ? `Le trajet d'un événement ${joinWords(senders)}` : "Le trajet d'un événement reçu";
}

/** Qui met en file : chaque ligne qui publie sur la file de ce consommateur, avec le point d'entrée qui l'exécute. */
export function producersOf(entry: Entrypoint, model: ArchModelV2): { proof: Proof; entrypoints: string[] }[] {
  if (entry.kind !== "message") return [];
  return model.edges
    .filter((e) => e.kind === "message" && e.target?.topic === entry.key)
    .flatMap((e) => e.occurrences.map((o) => ({ proof: o, entrypoints: o.entrypoints ?? [] })));
}
