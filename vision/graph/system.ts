import type { ArchModel } from "../arch/types.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import type { SymbolFact, SystemModel } from "../model/types.js";

/**
 * Le graphe du système (docs/knowledge/04, section 5) : ce qui est extrait du
 * code et ce que les agents ont déclaré, réunis dans un seul graphe. Tous les
 * usages (écran Feature, hooks de l'agent, rapport de PR) passent par `reach`,
 * pour dire la même chose.
 *
 * Construit depuis la carte persistée (modèle et architecture) et le rapport
 * de connaissance, sans relire ni réanalyser le code.
 *
 * Les liens sont orientés dans le sens où un changement se propage : un point
 * d'entrée exécute un fichier, un fichier écrit une collection, une écriture
 * déclenche un point d'entrée, un symbole porte une affirmation. « down » suit
 * ce sens (ce que ça enclenche) ; « up » le remonte (ce qui l'exécute).
 */

export type NodeKind = "file" | "symbol" | "entry" | "block" | "collection" | "concept" | "claim";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  path?: string;
  line?: number;
  endLine?: number;
}

export type EdgeKind =
  // extraits
  | "defines" // fichier → symbole
  | "imports" // fichier → fichier
  | "executes" // point d'entrée → fichier ou symbole
  | "hosts" // bloc → point d'entrée
  | "reads" // code ou point d'entrée → collection
  | "writes"
  | "triggers" // collection → point d'entrée
  | "calls" // code → point d'entrée appelé (fonction appelable, route)
  | "enqueues" // code → file
  | "uses" // code → couche IA
  | "requests" // code → service externe
  // déclarés
  | "covers" // concept → point d'entrée
  | "declares" // concept → affirmation
  | "anchors"; // code → affirmation qui y est ancrée

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  origin: "extracted" | "declared";
  /** La ligne qui prouve le lien, quand il y en a une. */
  at?: { path: string; line: number };
}

export interface SystemGraph {
  nodes: Map<string, GraphNode>;
  out: Map<string, GraphEdge[]>;
  in: Map<string, GraphEdge[]>;
  /** Symboles de chaque fichier, triés par ligne : sert à situer une ligne. */
  symbolsOf: Map<string, SymbolFact[]>;
}

export const nodeId = {
  file: (path: string) => `file:${path}`,
  symbol: (id: string) => `symbol:${id}`,
  entry: (id: string) => id, // les ids de la carte commencent déjà par `entry:`
  block: (id: string) => `block:${id}`,
  collection: (path: string) => `collection:${path}`,
  concept: (id: string) => `concept:${id}`,
  claim: (id: string) => `claim:${id}`,
};

export function buildSystemGraph(model: SystemModel, arch: ArchModel, knowledge?: KnowledgeReport | null): SystemGraph {
  const g: SystemGraph = { nodes: new Map(), out: new Map(), in: new Map(), symbolsOf: new Map() };
  const node = (n: GraphNode) => {
    if (!g.nodes.has(n.id)) g.nodes.set(n.id, n);
    return n.id;
  };
  const seen = new Set<string>();
  const edge = (e: GraphEdge) => {
    if (e.from === e.to) return;
    const key = `${e.from}|${e.kind}|${e.to}`;
    if (seen.has(key)) return;
    seen.add(key);
    (g.out.get(e.from) ?? g.out.set(e.from, []).get(e.from)!).push(e);
    (g.in.get(e.to) ?? g.in.set(e.to, []).get(e.to)!).push(e);
  };

  // Fichiers et symboles.
  for (const f of model.files) {
    const file = node({ id: nodeId.file(f.path), kind: "file", label: f.path, path: f.path });
    const symbols = [...f.symbols].sort((a, b) => a.location.startLine - b.location.startLine);
    g.symbolsOf.set(f.path, symbols);
    for (const s of symbols) {
      const sym = node({ id: nodeId.symbol(s.id), kind: "symbol", label: s.name, path: f.path, line: s.location.startLine, endLine: s.location.endLine });
      edge({ from: file, to: sym, kind: "defines", origin: "extracted" });
    }
  }
  for (const d of model.dependencies) {
    if (d.external || !g.nodes.has(nodeId.file(d.to))) continue;
    edge({ from: nodeId.file(d.from), to: nodeId.file(d.to), kind: "imports", origin: "extracted" });
  }
  /** Le symbole qui contient la ligne, sinon le fichier. */
  const codeAt = (path: string, line: number): string => {
    const inner = (g.symbolsOf.get(path) ?? []).filter((s) => s.location.startLine <= line && s.location.endLine >= line);
    const s = inner.sort((a, b) => a.location.endLine - a.location.startLine - (b.location.endLine - b.location.startLine))[0];
    return s ? nodeId.symbol(s.id) : node({ id: nodeId.file(path), kind: "file", label: path, path });
  };

  // Blocs et points d'entrée.
  for (const b of arch.blocks) node({ id: nodeId.block(b.id), kind: "block", label: b.name });
  for (const e of arch.entries) {
    const id = node({ id: nodeId.entry(e.id), kind: "entry", label: e.name, path: e.path, line: e.line });
    edge({ from: nodeId.block(e.block), to: id, kind: "hosts", origin: "extracted" });
    // Dans son propre fichier, une fonction n'exécute que ses lignes ; les autres fichiers comptent en entier.
    const own = e.ranges ?? (e.symbol ? symbolRange(g, e.symbol) : undefined);
    if (own) {
      for (const s of g.symbolsOf.get(e.path) ?? []) {
        if (own.some(([a, z]) => s.location.startLine >= a && s.location.endLine <= z)) edge({ from: id, to: nodeId.symbol(s.id), kind: "executes", origin: "extracted", at: { path: e.path, line: s.location.startLine } });
      }
    } else if (g.nodes.has(nodeId.file(e.path))) {
      edge({ from: id, to: nodeId.file(e.path), kind: "executes", origin: "extracted" });
    }
    for (const f of e.files ?? []) {
      if (f !== e.path && g.nodes.has(nodeId.file(f))) edge({ from: id, to: nodeId.file(f), kind: "executes", origin: "extracted" });
    }
  }

  // Données : chaque accès part du code qui le fait, et des points d'entrée que la carte y rattache.
  for (const b of arch.blocks) {
    if (b.interior?.kind !== "datastore") continue;
    for (const c of b.interior.collections) {
      const col = node({ id: nodeId.collection(c.path), kind: "collection", label: c.path });
      for (const [kind, list] of [["reads", c.reads], ["writes", c.writes]] as const) {
        for (const a of list) {
          const at = { path: a.path, line: a.line };
          edge({ from: codeAt(a.path, a.line), to: col, kind, origin: "extracted", at });
          for (const en of a.entries) edge({ from: nodeId.entry(en), to: col, kind, origin: "extracted", at });
        }
      }
      for (const t of c.triggers) edge({ from: col, to: nodeId.entry(t), kind: "triggers", origin: "extracted" });
    }
  }

  // Appels, files, IA, services externes : la ligne de preuve situe le code qui parle.
  for (const l of arch.links) {
    if (l.kind === "calls") {
      for (const ev of l.evidence) if (ev.target) edge({ from: codeAt(ev.path, ev.line), to: nodeId.entry(ev.target), kind: "calls", origin: "extracted", at: { path: ev.path, line: ev.line } });
    } else if (l.kind === "enqueues" || l.kind === "uses" || l.kind === "requests") {
      for (const ev of l.evidence) edge({ from: codeAt(ev.path, ev.line), to: nodeId.block(l.to), kind: l.kind, origin: "extracted", at: { path: ev.path, line: ev.line } });
    }
  }

  // Connaissance déclarée.
  const entryByName = new Map<string, string[]>();
  for (const e of arch.entries) entryByName.set(e.name, [...(entryByName.get(e.name) ?? []), nodeId.entry(e.id)]);
  for (const c of knowledge?.concepts ?? []) {
    const concept = node({ id: nodeId.concept(c.id), kind: "concept", label: c.name, path: c.file });
    for (const e of c.entries) for (const en of entryByName.get(e.name) ?? []) edge({ from: concept, to: en, kind: "covers", origin: "declared" });
    for (const k of c.claims) {
      const claim = node({ id: nodeId.claim(k.id), kind: "claim", label: k.text, path: k.file, line: k.line });
      edge({ from: concept, to: claim, kind: "declares", origin: "declared" });
      for (const a of k.anchors) {
        if (!a.at) continue;
        const sym = a.at.symbol ? (g.symbolsOf.get(a.at.path) ?? []).find((s) => s.name === a.at!.symbol) : undefined;
        const from = sym ? nodeId.symbol(sym.id) : a.ref.symbol || a.ref.marker ? codeAt(a.at.path, a.at.line) : node({ id: nodeId.file(a.at.path), kind: "file", label: a.at.path, path: a.at.path });
        edge({ from, to: claim, kind: "anchors", origin: "declared", at: { path: a.at.path, line: a.at.line } });
      }
    }
  }
  return g;
}

function symbolRange(g: SystemGraph, symbolId: string): [number, number][] | undefined {
  const path = symbolId.split("#")[0]!;
  const s = (g.symbolsOf.get(path) ?? []).find((x) => x.id === symbolId);
  return s ? [[s.location.startLine, s.location.endLine]] : undefined;
}

// ── reach ──

/** Point de départ : un fichier, un symbole, des lignes, une collection, un point d'entrée, une feature. */
export type ReachStart =
  | { file: string }
  | { symbol: string }
  | { range: { path: string; from: number; to: number } }
  | { collection: string }
  | { entry: string }
  | { feature: string };

export interface Reached {
  node: GraphNode;
  /** Nombre de liens depuis le départ. */
  depth: number;
  /** Les liens, dans l'ordre, du départ jusqu'à ce nœud. */
  path: GraphEdge[];
}

export interface ReachResult {
  start: GraphNode[];
  reached: Reached[];
}

export interface ReachOptions {
  /** « down » : ce que le départ enclenche. « up » : ce qui exécute ou déclenche le départ. */
  direction?: "down" | "up";
  /** Profondeur maximale (par défaut, sans limite). */
  maxDepth?: number;
}

/** Les nœuds qui correspondent au départ. Vide si rien ne correspond. */
export function startNodes(g: SystemGraph, start: ReachStart): string[] {
  const has = (id: string) => (g.nodes.has(id) ? [id] : []);
  if ("file" in start) return has(nodeId.file(start.file));
  if ("symbol" in start) return has(nodeId.symbol(start.symbol));
  if ("collection" in start) return has(nodeId.collection(start.collection));
  if ("entry" in start) {
    const byId = has(nodeId.entry(start.entry));
    return byId.length ? byId : [...g.nodes.values()].filter((n) => n.kind === "entry" && n.label === start.entry).map((n) => n.id);
  }
  if ("feature" in start) return has(nodeId.concept(start.feature));
  const { path, from, to } = start.range;
  const touched = (g.symbolsOf.get(path) ?? []).filter((s) => s.location.startLine <= to && s.location.endLine >= from);
  // Les symboles les plus internes qui recouvrent les lignes ; sinon le fichier.
  const inner = touched.filter((s) => !touched.some((o) => o !== s && o.location.startLine >= s.location.startLine && o.location.endLine <= s.location.endLine && (o.location.startLine > s.location.startLine || o.location.endLine < s.location.endLine)));
  return inner.length ? inner.map((s) => nodeId.symbol(s.id)) : has(nodeId.file(path));
}

/**
 * Tout ce qui est atteint depuis le départ, avec le chemin le plus court qui
 * l'y relie. En descendant, un fichier ne mène à ses symboles que si on part
 * de lui ou si un point d'entrée l'exécute en entier : un autre symbole du
 * même fichier n'est pas atteint parce qu'il est voisin.
 */
export function reach(g: SystemGraph, start: ReachStart, opts: ReachOptions = {}): ReachResult {
  const down = (opts.direction ?? "down") === "down";
  const max = opts.maxDepth ?? Infinity;
  let starts = startNodes(g, start);
  // Remonter depuis un fichier, c'est remonter depuis tout ce qu'il définit : un point d'entrée n'exécute parfois que ses propres lignes.
  if (!down && "file" in start) starts = [...starts, ...starts.flatMap((id) => (g.out.get(id) ?? []).filter((e) => e.kind === "defines").map((e) => e.to))];
  const via = new Map<string, { edge?: GraphEdge; depth: number }>(starts.map((id) => [id, { depth: 0 }]));
  let frontier = starts;
  for (let depth = 1; frontier.length && depth <= max; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const came = via.get(id)!.edge;
      for (const e of (down ? g.out : g.in).get(id) ?? []) {
        if (down && e.kind === "defines" && came && came.kind !== "executes") continue;
        if (down && e.kind === "imports") continue; // la fermeture des imports est déjà dans `executes`
        const to = down ? e.to : e.from;
        if (via.has(to)) continue;
        via.set(to, { edge: e, depth });
        next.push(to);
      }
    }
    frontier = next;
  }
  const reached: Reached[] = [];
  for (const [id, v] of via) {
    if (!v.edge) continue;
    const path: GraphEdge[] = [];
    for (let cur = id; via.get(cur)?.edge; ) {
      const e = via.get(cur)!.edge!;
      path.unshift(e);
      cur = down ? e.from : e.to;
    }
    reached.push({ node: g.nodes.get(id)!, depth: v.depth, path });
  }
  reached.sort((a, b) => a.depth - b.depth || a.node.kind.localeCompare(b.node.kind) || a.node.id.localeCompare(b.node.id));
  return { start: starts.map((id) => g.nodes.get(id)!), reached };
}

// ── Ce que l'écran Feature montre ──

export interface FeatureReach {
  /** Nœuds de départ : la feature déclarée qui couvre le point d'entrée, sinon le point d'entrée ou le symbole. */
  start: string[];
  /**
   * Affirmations atteintes. `feature` : déclarées par la feature elle-même ;
   * `here` : sans feature déclarée, ancrées dans le symbole affiché ou dans
   * les lignes que le point d'entrée exécute dans son propre fichier ;
   * `code` : ancrées dans le reste du code qu'elle exécute.
   */
  claims: { id: string; via: "feature" | "code" | "here"; path: GraphEdge[] }[];
  /** Collections lues ou écrites, directement ou par ce qui est déclenché ensuite ; `path` mène au premier accès trouvé. */
  collections: { name: string; ops: ("reads" | "writes")[]; path: GraphEdge[] }[];
  /** Points d'entrée atteints hors du départ (déclenchés, appelés). */
  entries: { id: string; path: GraphEdge[] }[];
}

/**
 * La sélection de l'écran Feature, pour qu'un test obtienne exactement ce que
 * l'écran affiche. Un point d'entrée couvert par une feature déclarée part de
 * la feature (tous ses points d'entrée) ; sinon du point d'entrée ou du symbole.
 */
export function featureReach(g: SystemGraph, ref: { entry?: string; symbol?: string }): FeatureReach {
  const concept = ref.entry
    ? (g.in.get(nodeId.entry(ref.entry)) ?? []).find((e) => e.kind === "covers")?.from
    : undefined;
  const start: ReachStart = concept ? { feature: concept.slice("concept:".length) } : ref.entry ? { entry: ref.entry } : { symbol: ref.symbol! };
  const r = reach(g, start);
  const starts = new Set(r.start.map((n) => n.id));
  const seen = new Set(r.reached.map((x) => x.node.id));
  const claims: FeatureReach["claims"] = [];
  const collections: FeatureReach["collections"] = [];
  const entries: FeatureReach["entries"] = [];
  for (const x of r.reached) {
    const last = x.path.at(-1)!;
    if (x.node.kind === "claim") {
      // « ici » : ancrée dans le symbole affiché, ou dans les lignes que le point d'entrée exécute dans son propre fichier.
      const here = !concept && (x.depth === 1 || (x.depth === 2 && x.path[0]!.kind === "executes" && x.path[0]!.to.startsWith("symbol:")));
      const via = last.kind === "declares" ? "feature" : here ? "here" : "code";
      claims.push({ id: x.node.id.slice("claim:".length), via, path: x.path });
    } else if (x.node.kind === "collection" && (last.kind === "reads" || last.kind === "writes")) {
      const ops = new Set((g.in.get(x.node.id) ?? []).filter((e) => (e.kind === "reads" || e.kind === "writes") && (starts.has(e.from) || seen.has(e.from))).map((e) => e.kind as "reads" | "writes"));
      collections.push({ name: x.node.label, ops: (["reads", "writes"] as const).filter((o) => ops.has(o)), path: x.path });
    } else if (x.node.kind === "entry" && !starts.has(x.node.id) && !(concept && x.depth === 1 && last.kind === "covers")) {
      entries.push({ id: x.node.id, path: x.path });
    }
  }
  return { start: [...starts], claims, collections, entries };
}
