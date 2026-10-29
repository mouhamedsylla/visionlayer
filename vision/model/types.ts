export interface SourceLocation {
  path: string;
  startLine: number;
  endLine: number;
}

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable";

export interface SymbolFact {
  id: string;
  name: string;
  kind: SymbolKind;
  exported: boolean;
  location: SourceLocation;
}

export interface DependencyFact {
  from: string;
  to: string;
  raw: string;
  external: boolean;
}

/**
 * `export { originalName as exportedName } from "./sourceFile"` (ou sans
 * alias). `sourceFile` est le chemin résolu si l'import est interne, ou le
 * specifier brut si externe/non résolu. Nécessaire pour que `vision source`
 * suive la chaîne jusqu'à la déclaration réelle plutôt que de s'arrêter au
 * premier fichier qui ré-exporte (cf. workflow/docs/mvp-roadmap.md, MVP1).
 */
export interface ReExportFact {
  file: string;
  exportedName: string;
  originalName: string;
  sourceFile: string;
  external: boolean;
}

export type Language = "typescript" | "tsx" | "javascript" | "jsx";

export interface FileFact {
  path: string;
  language: Language;
  symbols: SymbolFact[];
  parseError?: string;
}

export interface RepositorySnapshot {
  root: string;
  files: string[];
}

export interface SystemModel {
  repository: {
    root: string;
  };
  files: FileFact[];
  dependencies: DependencyFact[];
  reExports: ReExportFact[];
}
