import type { ArchModelV2, ArchNode, CodeFunction, Entrypoint, FlowStep } from "../../api/types";

/** Une fonction et le bloc qui la porte. */
export interface FnRef {
  fn: CodeFunction;
  node: ArchNode;
}

export function allFunctions(model: ArchModelV2): FnRef[] {
  return model.nodes.flatMap((node) => (node.facets.functions ?? []).map((fn) => ({ fn, node })));
}

export function findFunction(model: ArchModelV2, id: string): FnRef | undefined {
  return allFunctions(model).find((r) => r.fn.id === id);
}

/** La fonction d'un fichier qui porte ce nom : pour ouvrir un appelant ou un appelé depuis une fiche. */
export function functionNamed(model: ArchModelV2, path: string, name: string): FnRef | undefined {
  return allFunctions(model).find((r) => r.fn.proof.path === path && r.fn.name === name);
}

/** Les fonctions rangées par bloc, puis par fichier, dans l'ordre de la carte et des lignes. */
export function functionTree(model: ArchModelV2): { node: ArchNode; files: { path: string; fns: CodeFunction[] }[] }[] {
  return model.nodes.filter((n) => n.facets.functions?.length).map((node) => {
    const files = new Map<string, CodeFunction[]>();
    for (const fn of node.facets.functions!) (files.get(fn.proof.path) ?? files.set(fn.proof.path, []).get(fn.proof.path)!).push(fn);
    return { node, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, fns]) => ({ path, fns })) };
  });
}

/** Le point d'entrée dont elle est la fonction, quand elle en est une. */
export function entryOf({ fn, node }: FnRef): Entrypoint | undefined {
  return (node.facets.entrypoints ?? []).find((e) => e.handler?.path === fn.proof.path
    && ((e.handler.line >= fn.proof.line && e.handler.line <= fn.end) || (e.handler.name === fn.name && e.handler.line <= fn.proof.line)));
}

/** Les étapes de son propre code, sans celles des fonctions qu'elle déplie : la fiche les numérote. */
export function ownSteps(fn: CodeFunction): FlowStep[] {
  return (fn.flow ?? []).filter((s) => s.depth === 0);
}

/** Ses chiffres, tous lus dans son propre code : étapes, refus, et les lignes du dépôt qui l'appellent. */
export function fnCounts(fn: CodeFunction): { steps: number; refusals: number; callers: number } {
  const own = ownSteps(fn);
  return {
    steps: own.length,
    refusals: own.filter((s) => s.kind === "refuse").length,
    callers: fn.calledFrom?.length ?? 0,
  };
}

/** Les fonctions qui l'appellent, sans doublon, avec leurs lignes : `checkout` ×2. */
export function callerGroups(fn: CodeFunction): { name?: string; path: string; lines: number[] }[] {
  const groups = new Map<string, { name?: string; path: string; lines: number[] }>();
  for (const c of fn.calledFrom ?? []) {
    const key = `${c.proof.path}\0${c.fn ?? ""}`;
    (groups.get(key) ?? groups.set(key, { name: c.fn, path: c.proof.path, lines: [] }).get(key)!).lines.push(c.proof.line);
  }
  return [...groups.values()];
}

export type FnTree = ReturnType<typeof functionTree>;

/** L'arbre réduit aux fonctions dont le nom ou le fichier contient le texte cherché, sans tenir compte de la casse. */
export function filterTree(tree: FnTree, query: string): FnTree {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  return tree
    .map(({ node, files }) => ({
      node,
      files: files.map((f) => ({ path: f.path, fns: f.path.toLowerCase().includes(q) ? f.fns : f.fns.filter((fn) => fn.name.toLowerCase().includes(q)) })).filter((f) => f.fns.length),
    }))
    .filter((b) => b.files.length);
}
