import type { DependencyFact, ReExportFact, SymbolFact, SystemModel } from "../model/types.js";

export interface ChangedSymbol {
  id: string;
  before: SymbolFact;
  after: SymbolFact;
}

export interface ArchitectureDiff {
  addedFiles: string[];
  removedFiles: string[];
  addedSymbols: SymbolFact[];
  removedSymbols: SymbolFact[];
  /** Même symbole (même id), mais kind ou exported a changé — un changement de visibilité publique est architecturalement significatif. */
  changedSymbols: ChangedSymbol[];
  addedDependencies: DependencyFact[];
  removedDependencies: DependencyFact[];
  addedReExports: ReExportFact[];
  removedReExports: ReExportFact[];
  /** Union de tous les fichiers touchés par un des changements ci-dessus. */
  affectedFiles: string[];
}

function dependencyKey(dep: DependencyFact): string {
  return `${dep.from}->${dep.to}`;
}

function reExportKey(r: ReExportFact): string {
  return `${r.file}#${r.exportedName}`;
}

export function diffModels(before: SystemModel, after: SystemModel): ArchitectureDiff {
  const beforeFilePaths = new Set(before.files.map((f) => f.path));
  const afterFilePaths = new Set(after.files.map((f) => f.path));
  const addedFiles = [...afterFilePaths].filter((p) => !beforeFilePaths.has(p)).sort();
  const removedFiles = [...beforeFilePaths].filter((p) => !afterFilePaths.has(p)).sort();

  const beforeSymbols = new Map<string, SymbolFact>();
  for (const f of before.files) for (const s of f.symbols) beforeSymbols.set(s.id, s);
  const afterSymbols = new Map<string, SymbolFact>();
  for (const f of after.files) for (const s of f.symbols) afterSymbols.set(s.id, s);

  const addedSymbols: SymbolFact[] = [];
  const changedSymbols: ChangedSymbol[] = [];
  for (const [id, symbol] of afterSymbols) {
    const previous = beforeSymbols.get(id);
    if (!previous) {
      addedSymbols.push(symbol);
      continue;
    }
    if (previous.kind !== symbol.kind || previous.exported !== symbol.exported) {
      changedSymbols.push({ id, before: previous, after: symbol });
    }
  }
  const removedSymbols = [...beforeSymbols]
    .filter(([id]) => !afterSymbols.has(id))
    .map(([, symbol]) => symbol);

  const beforeDeps = new Map(before.dependencies.map((d) => [dependencyKey(d), d]));
  const afterDeps = new Map(after.dependencies.map((d) => [dependencyKey(d), d]));
  const addedDependencies = [...afterDeps].filter(([k]) => !beforeDeps.has(k)).map(([, d]) => d);
  const removedDependencies = [...beforeDeps].filter(([k]) => !afterDeps.has(k)).map(([, d]) => d);

  const beforeReExports = new Map(before.reExports.map((r) => [reExportKey(r), r]));
  const afterReExports = new Map(after.reExports.map((r) => [reExportKey(r), r]));
  const addedReExports = [...afterReExports].filter(([k]) => !beforeReExports.has(k)).map(([, r]) => r);
  const removedReExports = [...beforeReExports].filter(([k]) => !afterReExports.has(k)).map(([, r]) => r);

  const affectedFiles = new Set<string>([...addedFiles, ...removedFiles]);
  for (const s of [...addedSymbols, ...removedSymbols]) affectedFiles.add(s.location.path);
  for (const c of changedSymbols) affectedFiles.add(c.after.location.path);
  for (const d of [...addedDependencies, ...removedDependencies]) {
    affectedFiles.add(d.from);
    if (!d.external) affectedFiles.add(d.to);
  }
  for (const r of [...addedReExports, ...removedReExports]) {
    affectedFiles.add(r.file);
    if (!r.external) affectedFiles.add(r.sourceFile);
  }

  return {
    addedFiles,
    removedFiles,
    addedSymbols,
    removedSymbols,
    changedSymbols,
    addedDependencies,
    removedDependencies,
    addedReExports,
    removedReExports,
    affectedFiles: [...affectedFiles].sort(),
  };
}
