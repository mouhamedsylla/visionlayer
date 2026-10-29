import type { FileFact, SystemModel } from "../model/types.js";
import { dependenciesOf, dependentsOf, findFile } from "../model/query.js";
import { hasOverlap, tokenize } from "./tokenize.js";

export interface ContextFileEntry {
  path: string;
  language: FileFact["language"];
  /** Symboles déclarés dans ce fichier dont le nom correspond à la tâche. */
  matchedSymbols: string[];
  /** Noms ré-exportés depuis ce fichier correspondant à la tâche (pas des déclarations locales). */
  matchedReExports: string[];
  allSymbols: { name: string; exported: boolean }[];
}

export interface AgentContext {
  task: string;
  taskTokens: string[];
  /** Fichiers dont un symbole, un ré-export ou le chemin correspond directement à la tâche. */
  matchedFiles: ContextFileEntry[];
  /** Voisins directs (dépendances/dépendants, un seul saut) des fichiers matchés — pas matchés eux-mêmes. */
  relatedFiles: ContextFileEntry[];
  /**
   * Toujours `false` dans cette version (ADR 0005) : seule une correspondance
   * de mots-clés déterministe a été effectuée, aucune interprétation
   * sémantique. Présent explicitement pour qu'un consommateur ne suppose
   * jamais l'inverse.
   */
  semanticInterpretationApplied: false;
}

export function buildAgentContext(model: SystemModel, task: string): AgentContext {
  const taskTokens = new Set(tokenize(task));

  const matchedFiles: ContextFileEntry[] = [];
  const matchedPaths = new Set<string>();

  for (const file of model.files) {
    const matchedSymbols = file.symbols
      .filter((s) => hasOverlap(tokenize(s.name), taskTokens))
      .map((s) => s.name);

    const matchedReExports = model.reExports
      .filter((r) => r.file === file.path && hasOverlap(tokenize(r.exportedName), taskTokens))
      .map((r) => r.exportedName);

    const pathMatches = hasOverlap(tokenize(file.path), taskTokens);

    if (matchedSymbols.length > 0 || matchedReExports.length > 0 || pathMatches) {
      matchedFiles.push(toEntry(file, matchedSymbols, matchedReExports));
      matchedPaths.add(file.path);
    }
  }

  const relatedPaths = new Set<string>();
  for (const path of matchedPaths) {
    for (const dep of dependenciesOf(model, path)) if (!dep.external) relatedPaths.add(dep.to);
    for (const dep of dependentsOf(model, path)) relatedPaths.add(dep.from);
  }
  for (const path of matchedPaths) relatedPaths.delete(path);

  const relatedFiles: ContextFileEntry[] = [];
  for (const path of relatedPaths) {
    const file = findFile(model, path);
    if (file) relatedFiles.push(toEntry(file, [], []));
  }

  return { task, taskTokens: [...taskTokens], matchedFiles, relatedFiles, semanticInterpretationApplied: false };
}

function toEntry(file: FileFact, matchedSymbols: string[], matchedReExports: string[]): ContextFileEntry {
  return {
    path: file.path,
    language: file.language,
    matchedSymbols,
    matchedReExports,
    allSymbols: file.symbols.map((s) => ({ name: s.name, exported: s.exported })),
  };
}
