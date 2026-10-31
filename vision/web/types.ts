import type { PackState } from "../facts/registry.js";
import type { ArchModelV2, Proof } from "../arch/types.js";
import type { DeployModel } from "../deploy/types.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import type { StackModel } from "../stack/types.js";

/**
 * Ce que le serveur local donne à l'interface. Partagé tel quel avec `ui/`
 * (import de type seulement) : un seul endroit décrit le contrat HTTP.
 */

export interface ProjectInfo {
  name: string;
  branch?: string;
  /** Hash court du commit lu. */
  commit?: string;
  /** Le dernier commit qui a touché ce dossier, et la première ligne de son message. */
  lastChange?: { commit: string; subject: string };
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
}

/** Un élément de la carte apparu ou disparu entre deux analyses : `+ POST /bookings/:id/transfer dans API`. */
export interface MapChange {
  sign: "added" | "removed";
  kind: "node" | "entry" | "entity" | "field" | "value" | "edge" | "finding";
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
