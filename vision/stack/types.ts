/**
 * Niveau Technologies : l'inventaire des technologies qu'un repository
 * utilise, à l'instant du scan.
 *
 * Chaque technologie n'existe que par ses preuves (`evidence`), toutes
 * vérifiables dans un fichier du repository : un paquet déclaré dans un
 * manifeste, un fichier de configuration, une image de conteneur, un paquet
 * système installé dans un Dockerfile, une version d'exécution, un composant
 * d'infrastructure, ou des fichiers dans un langage. Le catalogue
 * (catalog.ts) ne fait que nommer et ranger : « le paquet `react` est la
 * technologie React ». Un paquet absent du catalogue reste listé, sous son
 * propre nom, dans « Autres bibliothèques » — rien n'est caché.
 */

export type TechCategory =
  | "language"
  | "runtime"
  | "framework"
  | "styling"
  | "data"
  | "backend"
  | "cloud"
  | "database"
  | "ai"
  | "media"
  | "build"
  | "test"
  | "quality"
  | "analytics"
  | "ci"
  | "library";

export type Ecosystem = "npm" | "pypi" | "go" | "cargo" | "composer" | "gem";

export type TechEvidence =
  | { kind: "package"; ecosystem: Ecosystem; manifest: string; line?: number; package: string; range: string; installed?: string; dev: boolean; peer?: boolean; facet?: string }
  | { kind: "config"; path: string; facet?: string }
  | { kind: "infra"; component: string; name: string; path: string; line?: number; facet?: string }
  | { kind: "image"; image: string; tag?: string; path: string; line?: number }
  | { kind: "system"; package: string; path: string; line?: number }
  | { kind: "runtime"; value: string; path: string; line?: number; field: string }
  | { kind: "files"; extension: string; count: number };

export interface Technology {
  /** Identifiant du catalogue (`react`), ou `<écosystème>:<paquet>` hors catalogue. */
  id: string;
  name: string;
  category: TechCategory;
  /** Slug Simple Icons, si la marque y figure. */
  icon?: string;
  /** Versions déclarées ou constatées, distinctes, triées (`^19.0.0`, `19.1.2`, `3.11`). */
  versions: string[];
  /** Espaces de travail (manifestes) qui la déclarent, par nom. */
  workspaces: string[];
  /** Produits ou sous-parties utilisés (Firebase : Hosting, Firestore, Authentication…). */
  facets: string[];
  evidence: TechEvidence[];
  /** Fichiers source qui l'importent (niveau Fichiers), triés. */
  importers: string[];
}

export interface Workspace {
  name: string;
  /** Dossier du manifeste ("" à la racine). */
  dir: string;
  manifest: string;
  ecosystem: Ecosystem;
}

export interface LanguageShare {
  id: string;
  name: string;
  icon?: string;
  files: number;
  extensions: string[];
}

export interface StackWarning {
  code: "version_divergence" | "undeclared_import" | "declared_unused" | "manifest_invalid";
  message: string;
  tech?: string;
  path?: string;
}

export interface StackModel {
  version: 1;
  technologies: Technology[];
  workspaces: Workspace[];
  languages: LanguageShare[];
  warnings: StackWarning[];
}
