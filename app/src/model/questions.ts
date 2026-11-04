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
 * Le panneau d'un bloc de la Carte (planche 03b) : ce qu'on veut savoir de lui, une ligne par question, chacune avec
 * son fait, ses constats et l'écran qui en répond. Rien n'est propre à un projet ni à une technologie : une ligne vient
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
  uncalled_entry: ["sans appelant", "sans appelant"], dead_code: ["code mort", "codes morts"], unguarded_route: ["sans rôle", "sans rôle"],
  missing_timeout: ["sans délai", "sans délai"], race_read_then_write: ["course", "courses"], write_then_enqueue: ["écrit puis met en file", "écrivent puis mettent en file"],
  personal_data_logged: ["donnée perso. journalisée", "données perso. journalisées"], unused_value: ["valeur jamais écrite", "valeurs jamais écrites"],
};

function markOf(list: Finding[], node: ArchNode): Question["mark"] {
  if (!list.length) return undefined;
  const tone = list.some((f) => FINDING_TONE[f.code] === "critical") ? "cr" : "sg";
  const codes = new Set(list.map((f) => f.code));
  const code = codes.size === 1 ? list[0]!.code : undefined;
  if (code === "scheduled_on_every_instance") return { text: `sur ${node.instances?.min ?? 2} machines`, tone };
  const word = code && WORD[code];
  return { text: word ? `${list.length} ${word[list.length > 1 ? 1 : 0]}` : plural(list.length, "constat", "constats"), tone };
}

/** Comment on appelle ce que contient un stockage : le mot suit sa forme, pas sa technologie. */
export function entityWords(node: ArchNode): [string, string] {
  const shape = node.facets.data?.shape;
  return shape === "relational" ? ["table", "tables"] : shape === "document" ? ["collection", "collections"] : shape === "key-value" ? ["famille de clés", "familles de clés"] : ["donnée", "données"];
}

const entities = (map: MapPayload, names: string[]) => {
  const stored = map.model.nodes.flatMap((n) => (n.facets.data?.entities ?? []).map((e) => ({ name: e.name, words: entityWords(n) })));
  const words = stored.filter((s) => names.includes(s.name)).map((s) => s.words);
  return plural(names.length, words.every((w) => w[0] === words[0]?.[0]) ? words[0]?.[0] ?? "donnée" : "donnée", words.every((w) => w[0] === words[0]?.[0]) ? words[0]?.[1] ?? "données" : "données");
};

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
  if (modules || entries.length) out.push({ id: "inside", text: "Comment est-il fait ?", fact: [modules && plural(modules, "module", "modules"), entries.length && plural(entries.length, "point d'entrée", "points d'entrée")].filter(Boolean).join(", "), go: "Intérieur", screen: "bloc", item: id, mark: mark("bloc") });

  // Ce qu'il contient, pour un stockage ; ce qu'il touche, pour un programme.
  const held = node.facets.data?.entities ?? [];
  if (held.length) out.push({ id: "data", text: "Quelles données, quels états ?", fact: plural(held.length, entityWords(node)[0], entityWords(node)[1]), go: "Données", screen: "donnees", item: id, mark: mark("donnees") });

  // Qui entre : les routes d'un programme, ou celles qui touchent une ressource, ou la preuve d'un service extérieur.
  const own = (node.facets.entrypoints ?? []).filter((e) => e.kind === "http" || e.kind === "rpc");
  if (own.length) {
    const guarded = own.filter((e) => e.access && !["public", "unknown"].includes(e.access.level)).length;
    const unread = own.filter((e) => !e.access || e.access.level === "unknown").length;
    out.push({ id: "access", text: "Qui peut y entrer ?", fact: `${guarded} ${guarded > 1 ? "gardées" : "gardée"} sur ${plural(own.length, "route", "routes")}${unread ? `, ${unread} à garde non reconnue` : ""}`, go: "Accès", screen: "acces", item: "entrees", scope: id, mark: mark("acces") });
  } else if (node.role === "external") {
    const row = actors(map, node).rows.find((r) => r.group === "outside");
    if (row) out.push({ id: "access", text: "Comment prouve-t-il qui il est ?", fact: `${row.proof}, ${row.note ?? row.name}`, go: "Accès", screen: "acces", item: row.id, scope: id, mark: mark("acces") });
  } else if (held.length && routesOf(map, node).length) {
    const who = actors(map, node).rows.filter((r) => r.group !== "system").length;
    out.push({ id: "access", text: "Qui peut les toucher ?", fact: plural(who, "acteur", "acteurs"), go: "Accès", screen: "acces", scope: id, mark: mark("acces") });
  }

  // Ce qu'il touche.
  const { reads, writes } = touchedBy(map, node);
  if (stores(map, node).length && !stores(map).includes(node)) {
    const fact = [writes.length && `écrit ${entities(map, writes)}`, reads.length && `en lit ${reads.length}`].filter(Boolean).join(", ")
      || `touche ${stores(map, node).map((s) => s.name).join(", ")}`;
    out.push({ id: "touches", text: "Que touche-t-il ?", fact, go: "Données", screen: "donnees", ...(stores(map, node).length === 1 ? { item: stores(map, node)[0]!.id } : {}), scope: id, mark: mark("donnees") });
  }

  // Ce qui décide, et ce qui tombe.
  const m = mechanismsOf(map, node);
  const ownOutage = m.outages.find((o) => o.dep.id === id);
  const topics = node.facets.channel?.topics ?? [];
  if (topics.length) out.push({ id: "message", text: "Que fait ce message ?", fact: topics.map((t) => t.name).join(", "), go: "Mécanismes", screen: "mecanismes", item: `files:${id}/${topics[0]!.name}`, scope: id });
  if (ownOutage) out.push({ id: "falls", text: `Si ${node.name} tombe ?`, fact: ownOutage.dependents.length ? `${ownOutage.dependents.map((d) => d.node.name).join(", ")} ${ownOutage.dependents.length > 1 ? "attendent" : "attend"} sans fin` : "aucun délai maximum lu", go: "Mécanismes", screen: "mecanismes", item: `pannes:${id}`, scope: id, mark: mark("mecanismes") });
  else if (!topics.length && (m.contracts.length || m.queues.length || m.outages.length)) {
    const fills = m.queues.filter((q) => q.producers.some((p) => p.from === id)).map((q) => q.topic);
    const eats = m.queues.filter((q) => q.consumers.some((c) => c.node.id === id)).map((q) => q.topic);
    const fact = [m.contracts.length && plural(m.contracts.length, "contrat", "contrats"), fills.length && `met en file ${fills.join(", ")}`, eats.length && `consomme ${eats.join(", ")}`, m.outages.length && plural(m.outages.length, "dépendance sans délai", "dépendances sans délai")].filter(Boolean).join(", ");
    out.push({ id: "decides", text: "Qu'est-ce qui décide, et si ça tombe ?", fact, go: "Mécanismes", screen: "mecanismes", ...(m.outages.length && byScreen.get("mecanismes")?.length ? { item: "pannes:" } : {}), scope: id, mark: mark("mecanismes") });
  }

  // Ce qui tourne sans clic.
  const t = triggers(map, node);
  if (t.length) {
    const n = (k: string) => t.filter((x) => x.kind === k).length;
    const fact = [n("schedule") && plural(n("schedule"), "tâche planifiée", "tâches planifiées"), n("queue") && plural(n("queue"), "file consommée", "files consommées"), n("webhook") && plural(n("webhook"), "webhook", "webhooks")].filter(Boolean).join(", ");
    out.push({ id: "tasks", text: "Qu'est-ce qui tourne sans clic ?", fact, go: "Tâches", screen: "taches", scope: id, mark: mark("taches") });
  }

  // Ce qui a été dit. Sans règle dans le projet, la question ne se pose pas.
  const all = rules(knowledge);
  if (all.length && (node.files?.length || modules)) {
    const mine = rulesOf(all, map, node);
    const bad = mine.filter((r) => r.tone === "cr").length;
    out.push(mine.length
      ? { id: "rules", text: "Ce qui a été dit tient-il ?", fact: plural(mine.length, "règle ancrée sur lui", "règles ancrées sur lui"), go: "Règles", screen: "regles", scope: id, ...(bad ? { mark: { text: plural(bad, "contredite", "contredites"), tone: "cr" as const } } : mark("regles") ? { mark: mark("regles")! } : {}) }
      : { id: "rules", text: "Ce qui a été dit tient-il ?", fact: "aucune règle ancrée sur lui", go: "Règles", screen: "regles", off: true });
  }

  // Sans pack : la seule question est pourquoi rien de plus.
  if (isUnread(node)) out.push({ id: "unread", text: "Pourquoi rien de plus ?", fact: `aucun pack ne lit ${node.tech?.map((x) => map.tech[x]?.name ?? x).join(", ") || "sa technologie"}`, go: "Écrire le pack", screen: "packs" });

  // Un constat dont aucune ligne ne répond reste dans le panneau : aucun n'est perdu.
  const others = [...byScreen].filter(([screen]) => !out.some((q) => q.screen === screen && q.mark)).flatMap(([, list]) => list);
  return { questions: out, others };
}
