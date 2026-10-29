/**
 * Knowledge layer (prototype, docs/knowledge/02-modele-de-connaissance.md) :
 * les affirmations déclarées par les agents, ancrées dans le code, et l'état
 * que VisionLayer leur calcule à chaque lecture. Le format des fichiers est
 * jetable ; le modèle (concept, affirmation, ancrage, état) est ce qu'on éprouve.
 */

export const CONCEPT_KINDS = ["feature", "flow", "contract", "entity", "block", "decision", "term"] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export const CLAIM_TYPES = ["purpose", "rule", "invariant", "step", "why", "failure", "guarantee", "state-meaning", "assumption", "decision", "limit", "term"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

/** Types sans code : une affirmation sans ancrage est acceptée et affichée comme telle. */
export const UNANCHORED_TYPES: ClaimType[] = ["assumption", "term"];

/** `chemin`, `chemin#Symbole`, `chemin#Classe.méthode`, `chemin#Symbole@marqueur` ou `chemin@marqueur`. */
export interface AnchorRef {
  raw: string;
  path: string;
  symbol?: string;
  marker?: string;
}

export interface DeclaredClaim {
  id: string;
  type: ClaimType;
  text: string;
  anchors: AnchorRef[];
  /** Lignes (1-based, incluses) de l'affirmation dans son fichier : sert au point de référence (git blame). */
  lines: [number, number];
}

export interface DeclaredConcept {
  id: string;
  kind: ConceptKind;
  name: string;
  /** Feature : ses points d'entrée (noms de la carte). Tout le reste se calcule. */
  entries: string[];
  file: string;
  claims: DeclaredClaim[];
}

export type AnchorStatus =
  | "ok" // trouvé à sa place
  | "moved" // introuvable à sa place, retrouvé ailleurs avec un code identique
  | "candidate" // introuvable à sa place, un symbole du même nom existe ailleurs (code différent)
  | "orphan"; // introuvable

export interface ResolvedAnchor {
  ref: AnchorRef;
  status: AnchorStatus;
  /** Où il est maintenant (si trouvé). */
  at?: { path: string; line: number; endLine: number; symbol?: string };
  /** Le code ancré a changé depuis le point de référence (arbre normalisé, sans commentaires ni espaces). */
  changed?: boolean;
  /** Le code ancré au point de référence était introuvable : on ne peut pas dire s'il a changé. */
  unknownAtReference?: boolean;
  /** Vérification propre au type de l'affirmation. */
  check?: "ok" | "failed";
  checkNote?: string;
}

export type ClaimState =
  | "verified" // vérification réussie, code inchangé
  | "current" // pas de vérification possible, code inchangé
  | "stale" // à reconfirmer : le code ancré a changé, ou n'est retrouvé qu'approximativement
  | "contradicted" // la vérification échoue
  | "orphan" // ancrage introuvable
  | "unanchored"; // hypothèse ou définition, sans code

export interface Reference {
  /** Commit où l'affirmation a été écrite ou reconfirmée pour la dernière fois ; absent si non commitée. */
  commit?: string;
  date?: string;
  uncommitted: boolean;
}

export interface KnowledgeClaim {
  id: string;
  concept: string;
  type: ClaimType;
  text: string;
  state: ClaimState;
  reference: Reference;
  anchors: ResolvedAnchor[];
  /** Fichiers de test dont les imports atteignent un fichier ancré. */
  tests: string[];
  file: string;
  line: number;
}

export interface KnowledgeConcept {
  id: string;
  kind: ConceptKind;
  name: string;
  file: string;
  entries: { name: string; found: boolean }[];
  claims: KnowledgeClaim[];
}

export interface KnowledgeReport {
  concepts: KnowledgeConcept[];
  /** Points d'entrée de la carte qu'aucune feature déclarée ne couvre. */
  entriesWithoutFeature: string[];
  /** Fichiers illisibles, identifiants en double, ancrages mal formés. */
  errors: { file: string; message: string }[];
}
