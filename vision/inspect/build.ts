import type { DependencyFact, FileFact, SymbolFact, SystemModel } from "../model/types.js";
import { dependenciesOf, dependentsOf, findFile, resolveSymbol } from "../model/query.js";
import { assertWithinRepo } from "../model/paths.js";

export interface FileInspection {
  path: string;
  language: FileFact["language"];
  parseError?: string;
  symbols: SymbolFact[];
  dependsOn: DependencyFact[];
  dependents: DependencyFact[];
}

export type InspectResult =
  | { kind: "file"; file: FileInspection }
  | { kind: "symbol"; symbol: SymbolFact; via: { file: string; exportedName: string }[]; file: FileInspection }
  | { kind: "ambiguous"; candidates: { id: string; path: string }[] }
  | { kind: "external"; externalSource: string }
  | { kind: "not-found" };

/**
 * Cœur de `vision inspect`, extrait en fonction pure pour être partagé par
 * le CLI (cli/inspect.ts, qui l'imprime) et le serveur MCP (MVP5, qui le
 * sérialise en JSON) — pas de logique dupliquée entre les deux surfaces.
 */
export function buildInspectResult(model: SystemModel, root: string, query: string): InspectResult {
  const file = findFile(model, query);
  if (file) {
    assertWithinRepo(root, file.path);
    return { kind: "file", file: inspectFile(model, file.path) };
  }

  const outcome = resolveSymbol(model, query);
  switch (outcome.kind) {
    case "found": {
      assertWithinRepo(root, outcome.result.file.path);
      return {
        kind: "symbol",
        symbol: outcome.result.symbol,
        via: outcome.result.via,
        file: inspectFile(model, outcome.result.file.path),
      };
    }
    case "ambiguous":
      return {
        kind: "ambiguous",
        candidates: outcome.results.map((r) => ({ id: r.symbol.id, path: r.file.path })),
      };
    case "external":
      return { kind: "external", externalSource: outcome.externalSource };
    case "not-found":
      return { kind: "not-found" };
  }
}

function inspectFile(model: SystemModel, path: string): FileInspection {
  const f = findFile(model, path)!;
  return {
    path: f.path,
    language: f.language,
    parseError: f.parseError,
    symbols: f.symbols,
    dependsOn: dependenciesOf(model, f.path),
    dependents: dependentsOf(model, f.path),
  };
}
