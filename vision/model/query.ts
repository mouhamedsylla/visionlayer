import type { DependencyFact, FileFact, SymbolFact, SystemModel } from "./types.js";

export interface SymbolMatch {
  file: FileFact;
  symbol: SymbolFact;
}

export interface ResolvedSymbol {
  file: FileFact;
  symbol: SymbolFact;
  /** Chaîne de ré-exports suivie pour arriver ici — vide si déclaration directe. */
  via: { file: string; exportedName: string }[];
}

export type ResolveOutcome =
  | { kind: "found"; result: ResolvedSymbol }
  | { kind: "ambiguous"; results: ResolvedSymbol[] }
  | { kind: "external"; via: { file: string; exportedName: string }[]; externalSource: string }
  | { kind: "not-found" };

export function findFile(model: SystemModel, path: string): FileFact | undefined {
  return model.files.find((f) => f.path === path);
}

/** Symboles *déclarés* portant ce nom dans le fichier donné (pas les ré-exports). */
function symbolsDeclaredInFile(model: SystemModel, path: string, name: string): SymbolFact[] {
  const file = findFile(model, path);
  if (!file) return [];
  return file.symbols.filter((s) => s.name === name);
}

/** Toutes les déclarations directes portant ce nom, tous fichiers confondus. */
function allDirectDeclarations(model: SystemModel, name: string): SymbolMatch[] {
  const matches: SymbolMatch[] = [];
  for (const file of model.files) {
    for (const symbol of file.symbols) {
      if (symbol.name === name) matches.push({ file, symbol });
    }
  }
  return matches;
}

const MAX_REEXPORT_HOPS = 10;

/**
 * Résout un nom de symbole jusqu'à sa déclaration réelle, en suivant les
 * ré-exports (locaux ou cross-fichier) si le nom n'est déclaré nulle part
 * directement. C'est le point exact où une navigation naïve (qui ne
 * regarderait que les déclarations directes) se tromperait — cf.
 * workflow/docs/mvp-roadmap.md, MVP1.
 */
export function resolveSymbol(model: SystemModel, name: string): ResolveOutcome {
  const direct = allDirectDeclarations(model, name);
  if (direct.length === 1) {
    return { kind: "found", result: { ...direct[0]!, via: [] } };
  }
  if (direct.length > 1) {
    return { kind: "ambiguous", results: direct.map((m) => ({ ...m, via: [] })) };
  }

  return followReExports(model, name, [], new Set());
}

function followReExports(
  model: SystemModel,
  exportedName: string,
  via: { file: string; exportedName: string }[],
  visited: Set<string>,
): ResolveOutcome {
  const candidates = model.reExports.filter((r) => r.exportedName === exportedName);
  if (candidates.length === 0) return { kind: "not-found" };

  const results: ResolvedSymbol[] = [];
  for (const candidate of candidates) {
    const hopKey = `${candidate.file}#${candidate.exportedName}`;
    if (visited.has(hopKey) || via.length >= MAX_REEXPORT_HOPS) {
      continue; // cycle ou chaîne anormalement longue — on ignore ce chemin plutôt que boucler
    }
    const nextVia = [...via, { file: candidate.file, exportedName: candidate.exportedName }];
    const nextVisited = new Set(visited).add(hopKey);

    if (candidate.external) {
      return { kind: "external", via: nextVia, externalSource: candidate.sourceFile };
    }

    const direct = symbolsDeclaredInFile(model, candidate.sourceFile, candidate.originalName);
    if (direct.length === 1) {
      const file = findFile(model, candidate.sourceFile)!;
      results.push({ file, symbol: direct[0]!, via: nextVia });
      continue;
    }
    if (direct.length > 1) {
      for (const symbol of direct) {
        results.push({ file: findFile(model, candidate.sourceFile)!, symbol, via: nextVia });
      }
      continue;
    }

    // Pas de déclaration directe dans le fichier source : c'est peut-être
    // lui-même un ré-export (chaîne à plusieurs sauts).
    const deeper = followReExports(model, candidate.originalName, nextVia, nextVisited);
    if (deeper.kind === "found") results.push(deeper.result);
    else if (deeper.kind === "ambiguous") results.push(...deeper.results);
    else if (deeper.kind === "external") return deeper;
  }

  if (results.length === 1) return { kind: "found", result: results[0]! };
  if (results.length > 1) return { kind: "ambiguous", results };
  return { kind: "not-found" };
}

export function dependenciesOf(model: SystemModel, path: string): DependencyFact[] {
  return model.dependencies.filter((d) => d.from === path);
}

export function dependentsOf(model: SystemModel, path: string): DependencyFact[] {
  return model.dependencies.filter((d) => d.to === path && !d.external);
}
