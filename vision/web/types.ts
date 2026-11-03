import type { PackState } from "../facts/registry.js";
import type { ArchModelV2, Proof } from "../arch/types.js";
import type { DeployModel } from "../deploy/types.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import type { DocumentRule } from "../knowledge/documents.js";
import type { StackModel } from "../stack/types.js";

/**
 * Ce que le serveur local donne à l'interface. Partagé tel quel avec `app/`
 * (import de type seulement) : un seul endroit décrit le contrat HTTP.
 */

export interface ProjectInfo {
  name: string;
  branch?: string;
  /** Hash court du commit lu. */
  commit?: string;
  /** Le dernier commit qui a touché ce dossier, et la première ligne de son message. */
  lastChange?: { commit: string; subject: string };
  /** La personne qui ouvre l'interface, d'après la configuration de Git (`user.name`). */
  user?: string;
}

export interface TechLabel {
  /** `postgresql` → `PostgreSQL`. */
  name: string;
  /** `framework`, `backend`, `database`… */
  category?: string;
  /** Le tracé SVG (24×24) de son logo Simple Icons ; absent, l'interface montre un monogramme. */
  icon?: string;
}

export interface MapPayload {
  model: ArchModelV2;
  /** Quand la carte a été calculée (ISO 8601). */
  builtAt: string;
  /** Fichiers relus lors de ce calcul (les autres sont repris tels quels). */
  reread: number;
  /** Chaque technologie citée par la carte : son nom affiché et sa catégorie du catalogue. */
  tech: Record<string, TechLabel>;
  /** Ce qui a changé depuis l'analyse précédente ; absent tant qu'il n'y en a eu qu'une. */
  changes?: { since: string; items: MapChange[] };
  /** Les packs locaux du projet (.vision/packs/) : actifs, inactifs faute de ce qu'ils lisent, ou refusés avec la raison. */
  localPacks?: PackState[];
  /** Les fichiers de code analysés, pour la grille de couverture : chaque fichier y a sa case. */
  files: string[];
  /** Les packs dont au moins un fait est sur la carte. */
  packs: string[];
}

/** Un élément de la carte apparu ou disparu entre deux analyses : `+ POST /bookings/:id/transfer dans API`. */
export interface MapChange {
  sign: "added" | "removed";
  kind: "node" | "entry" | "trust" | "entity" | "field" | "value" | "edge" | "finding";
  text: string;
  proof?: Proof;
}

/** Les technologies du dépôt, lues dans ses manifestes et fichiers de configuration. */
export interface StackPayload {
  stack: StackModel;
  /** Chaque technologie et chaque langage de l'inventaire : nom, catégorie, logo. */
  tech: Record<string, TechLabel>;
  /** La carte dont l'inventaire a été calculé. */
  builtAt: string;
}

/** Les chaînes de livraison du dépôt (workflows), lues sans rien lancer. */
export interface DeployPayload {
  deploy: DeployModel;
  /** Chaque pack par son id (`fly`) : son nom (`Fly.io`), ses technologies, et s'il lit un manifeste de déploiement. */
  packs: Record<string, { name: string; tech: string[]; deploys?: boolean }>;
  /** Les logos des packs et des cibles de déploiement. */
  tech: Record<string, TechLabel>;
  builtAt: string;
}

/** La connaissance déclarée par les agents et les humains, et son état contre le code. */
export interface KnowledgePayload {
  report: KnowledgeReport;
  /** Les règles écrites dans un document (README, docs/), sans ancrage ni vérification. */
  documents: DocumentRule[];
  /** Les notes à jour au démarrage du serveur qui ne le sont plus. */
  sinceStart: string[];
  builtAt: string;
}

export interface SourceExcerpt {
  path: string;
  /** Numéro de la première ligne rendue. */
  from: number;
  /** Les lignes, une valeur qui ressemble à un secret masquée. */
  lines: string[];
}

/** Une proposition de l'écrivain de packs : tout ce qu'il a déposé dans .vision/packs/proposes/. */
export interface PackProposal {
  id: string;
  name: string;
  /** Le pack, tel qu'écrit. */
  yaml: string;
  /** Sa page de documentation : les formes de l'API, lues ou non lues. */
  doc: string;
  /** La fiche que l'écrivain a reçue. */
  fiche: string;
  provides: string[];
  rules: string[];
  tests: string[];
  /** Le nombre de motifs de syntaxe qu'il reconnaît. */
  matches: number;
  /** L'essai à part sur le projet : l'état du pack et ce qu'il changerait sur la carte. */
  preview?: { state: PackState; changes: MapChange[] };
  usage?: { input: number; output: number; cost: number; turns: number; seconds: number };
}

/** L'écrivain lancé depuis l'interface : ce qu'il affiche, et s'il a fini. */
export interface WriterJob { pkg: string; lines: string[]; done: boolean; ok?: boolean; started: string }

export interface PacksPayload {
  builtins: { id: string; name: string; tech: string[]; used: boolean }[];
  /** Les packs du projet dans .vision/packs/ ; `meta` pour ceux que Muse a écrits et qui se sont chargés seuls. */
  local: { id: string; name: string; tech: string[]; used: boolean; meta?: { by: "muse"; pkg: string; at: string; tests: number; cost?: number } }[];
  proposals: PackProposal[];
  /** Les paquets qui attendent l'écrivain. */
  queue: string[];
  /** Les écritures arrêtées sans pack chargé, par paquet. */
  failed: Record<string, { reason: string; at: string }>;
  job?: WriterJob;
}

/** Une session d'agent sur ce dépôt, telle que l'agent l'a consignée : jamais un prompt, ni une commande, ni un contenu. */
export interface AgentSession {
  agent: "muse" | "claude" | "codex";
  id: string;
  model?: string;
  branch?: string;
  started: string;
  ended?: string;
  /** Tokens additionnés sur les appels au modèle. */
  tokens: { input: number; cached: number; output: number; reasoning: number };
  calls: number;
  /** Les lectures de la carte par MCP, dans l'ordre : l'outil, et si elle a eu lieu avant la première écriture. */
  mapReads: { tool: string; beforeFirstWrite: boolean }[];
  /** Les fichiers du dépôt que la session a écrits, relatifs à la racine. */
  writes: string[];
  /** D'où vient ce qu'on sait : le journal de Muse Code, ou les crochets de Claude Code et Codex. */
  source: string;
  /** Les moments de la session : lectures de la carte et écritures, avec leur heure. */
  timeline: { at: string; what: "map" | "write"; detail: string }[];
}

/** Un agent de code, vu depuis le projet : installé sur la machine, et ce qui le relie à VisionLayer. */
export interface AgentLink {
  agent: "muse" | "claude" | "codex";
  installed: boolean;
  /** Lit la carte : le serveur MCP de VisionLayer est déclaré là où l'agent le cherche. */
  map: { linked: boolean; where: string; editable: boolean };
  /** Dit ce qu'il touche : son propre journal (Muse Code) ou les crochets de VisionLayer. */
  report: { linked: boolean; where: string; editable: boolean };
  /** Déclare ce qu'il sait : la section VisionLayer de son fichier de consignes. */
  contract: { linked: boolean; where: string; editable: boolean };
}

export type { VigieAnswer, VigieStep } from "../vigie/vigie.js";
export type { Proposal, ProposalStep, Replay, ReplayTest } from "../replay/replay.js";
