import type { ArchNode, Finding, FindingCode, KnowledgePayload, MapPayload } from "../api/types";
import type { Screen } from "../shell/route";
import { actors, routesOf } from "./access";
import { stores, touchedBy } from "./data";
import { findingPlace } from "./destinations";
import { mechanismsOf } from "./mechanisms";
import { isUnread } from "./overview";
import { rules, rulesOf } from "./rules";
import { triggers } from "./tasks";
import { FINDING_TONE, plural } from "./words";

/**
 * Le panneau d'un bloc de la Carte (planche 03b) : une ligne par écran responsable, avec son fait et ses constats. Rien n'est propre à un projet ni à une technologie : une ligne vient
 * de ce que le bloc porte dans le modèle, et n'existe que si son écran a quelque chose à montrer pour ce bloc.
 */
export interface Question {
  id: string; text: string; fact: string; go: string;
  screen: Screen; item?: string; scope?: string;
  mark?: { text: string; tone: "cr" | "sg" };
  /** Rien à montrer sur lui : la ligne dit pourquoi et mène à l'écran entier. */
  off?: boolean;
}

/** Le mot d'un constat dans une marque, au singulier et au pluriel. */
const WORD: Partial<Record<FindingCode, [string, string]>> = {
  uncalled_entry: ["no call read", "no call read"], dead_code: ["code mort", "codes morts"], unguarded_route: ["no role", "no role"],
  missing_timeout: ["no timeout", "no timeout"], race_read_then_write: ["race", "races"], write_then_enqueue: ["writes then enqueues", "write then enqueue"],
  personal_data_logged: ["personal data logged", "personal data logged"], unused_value: ["value never written", "values never written"],
};

function markOf(list: Finding[], node: ArchNode): Question["mark"] {
  if (!list.length) return undefined;
  const tone = list.some((f) => FINDING_TONE[f.code] === "critical") ? "cr" : "sg";
  const codes = new Set(list.map((f) => f.code));
  const code = codes.size === 1 ? list[0]!.code : undefined;
  if (code === "scheduled_on_every_instance") return { text: `on ${node.instances?.min ?? 2} machines`, tone };
  const word = code && WORD[code];
  return { text: word ? `${list.length} ${word[list.length > 1 ? 1 : 0]}` : plural(list.length, "finding", "findings"), tone };
}

/** Comment on appelle ce que contient un stockage : le mot suit sa forme, pas sa technologie. */
export function entityWords(node: ArchNode): [string, string] {
  const shape = node.facets.data?.shape;
  return shape === "relational" ? ["table", "tables"] : shape === "document" ? ["collection", "collections"] : shape === "key-value" ? ["key family", "key families"] : ["data", "data"];
}

/** “3 tables et 1 donnée” : chaque stockage touché, avec le mot de sa forme. */
function touchedText(map: MapPayload, node: ArchNode, kind: "read" | "write"): string {
  const by = new Map<string, Set<string>>();
  for (const e of map.model.edges.filter((x) => x.from === node.id && x.kind === kind && x.target?.entity)) {
    const store = map.model.nodes.find((n) => n.id === e.to);
    const [one, many] = store ? entityWords(store) : ["data", "data"];
    (by.get(`${one}|${many}`) ?? by.set(`${one}|${many}`, new Set()).get(`${one}|${many}`)!).add(e.target!.entity!);
  }
  return [...by].map(([w, names]) => plural(names.size, w.split("|")[0]!, w.split("|")[1]!)).join(" and ");
}

export function blockQuestions(map: MapPayload, knowledge: KnowledgePayload | undefined, node: ArchNode): { questions: Question[]; others: Finding[] } {
  const id = node.id;
  const findings = map.model.findings.filter((f) => f.nodes?.includes(id));
  const byScreen = new Map<Screen, Finding[]>();
  for (const f of findings) {
    const s = findingPlace(map, f).screen;
    const key: Screen = s === "table" ? "donnees" : s === "carte" ? "bloc" : s;
    byScreen.set(key, [...(byScreen.get(key) ?? []), f]);
  }
  const mark = (s: Screen) => markOf(byScreen.get(s) ?? [], node);
  const out: Question[] = [];

  // L'intérieur : ses modules et ses points d'entrée.
  const modules = map.model.nodes.filter((n) => n.parent === id && n.facets.component).length;
  const entries = (node.facets.entrypoints ?? []).filter((e) => e.kind !== "main");
  if (modules || entries.length) out.push({ id: "inside", text: "Components", fact: [modules && plural(modules, "module", "modules"), entries.length && plural(entries.length, "entry point", "entry points")].filter(Boolean).join(", "), go: "", screen: "bloc", item: id, mark: mark("bloc") });

  // Ce qu'il contient, pour un stockage ; ce qu'il touche, pour un programme.
  const held = node.facets.data?.entities ?? [];
  if (held.length) out.push({ id: "data", text: "Data", fact: plural(held.length, entityWords(node)[0], entityWords(node)[1]), go: "", screen: "donnees", item: id, mark: mark("donnees") });

  // Qui entre : les routes d'un programme, ou celles qui touchent une ressource, ou la preuve d'un service extérieur.
  const own = (node.facets.entrypoints ?? []).filter((e) => e.kind === "http" || e.kind === "rpc");
  if (own.length) {
    const guarded = own.filter((e) => e.access && !["public", "unknown"].includes(e.access.level)).length;
    const unread = own.filter((e) => !e.access || e.access.level === "unknown").length;
    out.push({ id: "access", text: "Access", fact: `${guarded} guarded out of ${plural(own.length, "route", "routes")}${unread ? `, ${unread} with an unrecognized guard` : ""}`, go: "", screen: "acces", item: "entrees", scope: id, mark: mark("acces") });
  } else if (node.role === "external") {
    const row = actors(map, node).rows.find((r) => r.group === "outside");
    if (row) out.push({ id: "access", text: "Access", fact: `${row.proof}, ${row.note ?? row.name}`, go: "", screen: "acces", item: row.id, scope: id, mark: mark("acces") });
  } else if (held.length && routesOf(map, node).length) {
    const who = actors(map, node).rows.filter((r) => r.group !== "system").length;
    out.push({ id: "access", text: "Access", fact: plural(who, "acteur", "acteurs"), go: "", screen: "acces", scope: id, mark: mark("acces") });
  }

  // Ce qu'il touche.
  const { reads, writes } = touchedBy(map, node);
  if (stores(map, node).length && !stores(map).includes(node)) {
    const fact = [writes.length && `writes ${touchedText(map, node, "write")}`, reads.length && `reads ${touchedText(map, node, "read")}`].filter(Boolean).join(", ")
      || `touche ${stores(map, node).map((s) => s.name).join(", ")}`;
    out.push({ id: "touches", text: "Data", fact, go: "", screen: "donnees", ...(stores(map, node).length === 1 ? { item: stores(map, node)[0]!.id } : {}), scope: id, mark: mark("donnees") });
  }

  // Ce qui décide, et ce qui tombe.
  const m = mechanismsOf(map, node);
  const ownOutage = m.outages.find((o) => o.dep.id === id);
  const topics = node.facets.channel?.topics ?? [];
  if (topics.length) out.push({ id: "message", text: "Queues", fact: topics.map((t) => t.name).join(", "), go: "", screen: "mecanismes", item: `files:${id}/${topics[0]!.name}`, scope: id });
  if (ownOutage) out.push({ id: "falls", text: "Outages", fact: ownOutage.dependents.length ? `${ownOutage.dependents.map((d) => d.node.name).join(", ")} ${ownOutage.dependents.length > 1 ? "wait" : "waits"} forever` : "no maximum timeout read", go: "", screen: "mecanismes", item: `pannes:${id}`, scope: id, mark: mark("mecanismes") });
  else if (!topics.length && (m.contracts.length || m.queues.length || m.outages.length)) {
    const fills = m.queues.filter((q) => q.producers.some((p) => p.from === id)).map((q) => q.topic);
    const eats = m.queues.filter((q) => q.consumers.some((c) => c.node.id === id)).map((q) => q.topic);
    const fact = [m.contracts.length && plural(m.contracts.length, "contract", "contracts"), fills.length && `enqueues ${fills.join(", ")}`, eats.length && `consomme ${eats.join(", ")}`, m.outages.length && plural(m.outages.length, "dependency with no timeout", "dependencies with no timeout")].filter(Boolean).join(", ");
    out.push({ id: "decides", text: "Mechanisms", fact, go: "", screen: "mecanismes", ...(m.outages.length && byScreen.get("mecanismes")?.length ? { item: "pannes:" } : {}), scope: id, mark: mark("mecanismes") });
  }

  // Ce qui tourne sans clic.
  const t = triggers(map, node);
  if (t.length) {
    const n = (k: string) => t.filter((x) => x.kind === k).length;
    const fact = [n("schedule") && plural(n("schedule"), "scheduled task", "scheduled tasks"), n("queue") && plural(n("queue"), "queue consumed", "queues consumed"), n("webhook") && plural(n("webhook"), "webhook", "webhooks")].filter(Boolean).join(", ");
    out.push({ id: "tasks", text: "Tasks", fact, go: "", screen: "taches", scope: id, mark: mark("taches") });
  }

  // Ce qui a été dit. Sans règle dans le projet, la question ne se pose pas.
  const all = rules(knowledge);
  if (all.length && (node.files?.length || modules)) {
    const mine = rulesOf(all, map, node);
    const bad = mine.filter((r) => r.tone === "cr").length;
    out.push(mine.length
      ? { id: "rules", text: "Rules", fact: plural(mine.length, "rule anchored on it", "rules anchored on it"), go: "", screen: "regles", scope: id, ...(bad ? { mark: { text: plural(bad, "contredite", "contredites"), tone: "cr" as const } } : mark("regles") ? { mark: mark("regles")! } : {}) }
      : { id: "rules", text: "Rules", fact: "no rule anchored on it", go: "", screen: "regles", off: true });
  }

  // Sans pack : la seule question est pourquoi rien de plus.
  if (isUnread(node)) out.push({ id: "unread", text: "No pack", fact: `no pack reads ${node.tech?.map((x) => map.tech[x]?.name ?? x).join(", ") || "its technology"}`, go: "", screen: "packs" });

  // Un constat dont aucune ligne ne répond reste dans le panneau : aucun n'est perdu.
  const others = [...byScreen].filter(([screen]) => !out.some((q) => q.screen === screen && q.mark)).flatMap(([, list]) => list);
  return { questions: out, others };
}
