import type { ArchEdge, ArchNode, Entrypoint } from "../arch/types.js";
import { handlerSpans } from "./flow.js";
import { fnId, reachOf, type FnGraph, type FnSpan, type Reach } from "./fn-graph.js";

/**
 * Ce que chaque point d'entrée exécute (sa portée), et à quel point d'entrée
 * revient chaque occurrence d'un lien (une lecture, une écriture, une mise en
 * file).
 *
 * La portée se lit au niveau des fonctions (fn-graph.ts) : la fonction du
 * point d'entrée, puis les fonctions du dépôt qu'elle appelle, de proche en
 * proche, sans sortir du déployable. `files` en est la liste des fichiers ;
 * `ranges`, les lignes de son propre fichier qu'il exécute. Un fichier que la
 * déclaration importe sans qu'aucune de ses fonctions soit appelée n'en fait
 * pas partie (un index qui importe tous les gestionnaires).
 *
 * Quand plusieurs points d'entrée sont écrits dans la même fonction, chacun
 * n'exécute que sa branche : les appels écrits entre sa ligne et celle du
 * suivant. Un point d'entrée dont la fonction n'est pas connue garde la
 * lecture par imports : son fichier et ce qu'il importe.
 *
 * Une occurrence dans un fichier qui porte des fonctions de points d'entrée,
 * à partir de la première, revient à la dernière qui commence avant elle : les
 * routes d'un même fichier ne se partagent pas leurs effets. Ailleurs, une
 * occurrence écrite dans une fonction revient aux points d'entrée qui
 * exécutent cette fonction. Si aucun ne l'exécute d'après les appels lus (une
 * fonction passée en valeur, appelée par une méthode), ou si elle est écrite
 * hors de toute fonction, elle revient, comme avant, à chaque point d'entrée
 * qui atteint son fichier par imports.
 */
export function attributeEntrypoints(
  nodes: ArchNode[], edges: ArchEdge[], depends: Map<string, string[]>, graph: FnGraph, importers: (path: string, fn: string) => string[],
): { reaches: Map<string, Reach>; owners: Owners } {
  const entriesOf = new Map<string, Entrypoint[]>();
  const reaches = new Map<string, Reach>();
  /** Par imports : la lecture de repli des occurrences, jamais la portée d'un point d'entrée dont la fonction est connue. */
  const byImports = new Map<string, string[]>();
  for (const n of nodes) {
    const own = new Set(n.files ?? []);
    const entries = (n.facets.entrypoints ?? []).filter((e) => e.kind !== "main" && e.handler);
    const at = handlerSpans(entries, graph.spans);
    for (const e of entries) {
      byImports.set(e.id, importReach(e.handler!.path, depends, own));
      const found = at.get(e);
      const span = found && graph.byId.get(`${e.handler!.path}:${found.span.start}`);
      if (!span) { e.files = byImports.get(e.id)!; continue; }
      const r = reachOf(graph, span, found.shared ? branchCalls(graph, span, e, entries) : undefined, own);
      reaches.set(e.id, r);
      e.files = [...r.files].sort();
      const ranges = [...r.fns].map((id) => graph.byId.get(id)!).filter((sp) => sp.path === span.path).map((sp): [number, number] => [sp.start, sp.end]);
      e.ranges = ranges.sort((a, b) => a[0] - b[0]);
    }
    entriesOf.set(n.id, entries);
  }

  const ownersOf: Owners = (entries, path, line) => owners(entries, path, line, graph, reaches, byImports, importers);
  for (const edge of edges) {
    const entries = entriesOf.get(edge.from) ?? [];
    if (!entries.length) continue;
    edge.occurrences = edge.occurrences.map((o) => {
      const ids = ownersOf(entries, o.path, o.line);
      // Une copie : une occurrence peut être la preuve d'un fait partagé ailleurs.
      return ids.length ? { ...o, entrypoints: ids } : o;
    });
  }
  return { reaches, owners: ownersOf };
}

/** La branche d'un point d'entrée écrit dans une fonction partagée : les appels entre sa ligne et celle du point d'entrée suivant. */
function branchCalls(graph: FnGraph, span: FnSpan, e: Entrypoint, entries: Entrypoint[]) {
  const next = Math.min(span.end + 1, ...entries.filter((x) => x.handler!.path === span.path && x.handler!.line > e.handler!.line).map((x) => x.handler!.line));
  return (graph.calls.get(fnId(span)) ?? []).filter((c) => c.proof.line >= e.handler!.line && c.proof.line < next);
}

function importReach(start: string, depends: Map<string, string[]>, within: Set<string>): string[] {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of depends.get(queue.shift()!) ?? []) {
      if (seen.has(next) || !within.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen].sort();
}

/** Les points d'entrée auxquels revient une ligne de code. */
export type Owners = (entries: Entrypoint[], path: string, line: number) => string[];

function owners(
  entries: Entrypoint[], path: string, line: number, graph: FnGraph, reaches: Map<string, Reach>, byImports: Map<string, string[]>,
  importers: (path: string, fn: string) => string[],
): string[] {
  const here = entries.filter((e) => e.handler!.path === path);
  const startsBefore = here.filter((e) => e.handler!.line <= line);
  if (startsBefore.length) {
    const start = Math.max(...startsBefore.map((e) => e.handler!.line));
    return startsBefore.filter((e) => e.handler!.line === start).map((e) => e.id);
  }
  const fn = graph.enclosing(path, line);
  // Hors de toute fonction (le code du module), ou pour un point d'entrée dont la fonction n'est pas connue : par imports.
  const viaImports = entries.filter((e) => (!fn || !reaches.has(e.id)) && byImports.get(e.id)?.includes(path)).map((e) => e.id);
  if (!fn) return viaImports;
  const id = fnId(fn);
  const reached = entries.filter((e) => reaches.get(e.id)?.fns.has(id)).map((e) => e.id);
  // Une fonction qu'aucun appel lu n'atteint, mais importée par son nom dans un fichier exécuté : passée en valeur (un middleware).
  const from = new Set(importers(path, fn.name));
  const byValue = from.size ? entries.filter((e) => [...(reaches.get(e.id)?.files ?? [])].some((f) => from.has(f))).map((e) => e.id) : [];
  return [...new Set([...reached, ...(reached.length ? [] : byValue), ...viaImports])];
}

/**
 * Le déployable et les points d'entrée de chaque écriture, et de chaque lecture, d'un champ d'entité.
 * L'écriture est dans une fonction : si c'est la fonction d'un point d'entrée,
 * c'est lui ; si d'autres fichiers l'importent, ce sont les points d'entrée de
 * ces fichiers (markRefunded, importée par le webhook) ; sinon, la règle des
 * occurrences des liens.
 */
export function attributeFieldWrites(nodes: ArchNode[], importers: (path: string, fn: string) => string[], owners: Owners): void {
  const runs = nodes.filter((n) => n.level === "deployable" && n.files?.length);
  for (const store of nodes) for (const entity of store.facets.data?.entities ?? []) for (const field of entity.fields ?? []) {
    for (const w of [...(field.writes ?? []), ...(field.reads ?? [])]) {
      // Un fichier partagé par plusieurs déployables revient au premier dont un point d'entrée l'atteint.
      const found = runs.filter((n) => n.files!.includes(w.proof.path)).map((n) => {
        const entries = (n.facets.entrypoints ?? []).filter((e) => e.kind !== "main" && e.handler);
        return { node: n, ids: writers(entries, w, w.fn ? importers(w.proof.path, w.fn) : [], owners) };
      });
      const best = found.find((f) => f.ids.length) ?? found[0];
      if (!best) continue;
      w.node = best.node.id;
      if (best.ids.length) w.entrypoints = best.ids;
    }
  }
}

function writers(entries: Entrypoint[], w: { fn?: string; proof: { path: string; line: number } }, importedBy: string[], owners: Owners): string[] {
  const own = entries.filter((e) => e.handler!.path === w.proof.path && e.handler!.name === w.fn);
  if (own.length) return own.map((e) => e.id);
  const viaImport = importedBy.flatMap((file) => entries.filter((e) => e.handler!.path === file));
  if (viaImport.length) return [...new Set(viaImport.map((e) => e.id))];
  return owners(entries, w.proof.path, w.proof.line);
}
