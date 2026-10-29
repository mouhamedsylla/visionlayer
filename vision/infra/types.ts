/**
 * Niveau Infrastructure (MVP7) : comment le système est déployé et exposé.
 *
 * Deux origines, toujours distinguées (gouvernance §6) :
 *  - faits extraits d'un fichier du repository (`source.kind === "extracted"`,
 *    avec chemin et ligne) ;
 *  - faits déclarés à la main dans `.vision/infra.yaml` (`source.kind ===
 *    "declared"`), pour ce qu'aucun fichier ne dit (CDN, hébergeur…).
 *
 * Les variables d'environnement sont extraites par NOM uniquement — jamais
 * une valeur (gouvernance §4).
 */

export type ComponentKind =
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "proxy"
  | "gateway"
  | "cdn"
  | "dns"
  | "host"
  | "platform"
  | "job"
  | "image"
  | "network"
  | "other";

export type LinkKind =
  | "routes_to"
  | "depends_on"
  | "connects_to"
  | "builds"
  | "deploys"
  | "exposes"
  | "mounts";

export type ExtractedSource = { kind: "extracted"; path: string; line?: number };
export type DeclaredSource = { kind: "declared"; path: string };
export type FactSource = ExtractedSource | DeclaredSource;

/** Environnement de déploiement. `all` désigne ce qui vaut pour tous. */
export const ALL_ENVIRONMENTS = "all";

export interface InfraComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  source: FactSource;
  /** Environnements où le composant existe (`all` si indépendant de l'env). */
  environments: string[];
  /** Attributs factuels, sans valeur secrète : image, ports, domaines, région… */
  attrs: Record<string, string>;
  /** Attributs qui varient selon l'environnement : env -> attribut -> valeur. */
  perEnv?: Record<string, Record<string, string>>;
  note?: string;
}

export interface InfraLink {
  from: string;
  to: string;
  kind: LinkKind;
  source: FactSource;
  environments: string[];
  label?: string;
}

export interface EnvVarFact {
  name: string;
  /** Composant qui la consomme (id), si connu. */
  component?: string;
  source: FactSource;
  environments: string[];
}

export interface InfraSourceFile {
  path: string;
  format:
    | "docker-compose"
    | "dockerfile"
    | "nginx"
    | "caddy"
    | "traefik"
    | "dotenv"
    | "github-actions"
    | "terraform"
    | "kubernetes"
    | "vercel"
    | "netlify"
    | "firebase"
    | "cloudbuild"
    | "package-scripts"
    | "declared";
  /** Environnement porté par le nom du fichier (`docker-compose.prod.yml`, `.env.production`, `overlays/prod/`). */
  environment?: string;
  parseError?: string;
}

export interface InfraModel {
  version: 1;
  environments: string[];
  components: InfraComponent[];
  links: InfraLink[];
  envVars: EnvVarFact[];
  sources: InfraSourceFile[];
  /** Points d'attention calculés (jamais des interprétations) : cible de route inconnue, env var présente dans un seul env… */
  warnings: InfraWarning[];
}

export interface InfraWarning {
  code: "unknown_link_target" | "env_only" | "no_infra_files" | "declared_invalid";
  message: string;
  source?: FactSource;
}

/** Résultat d'un extracteur sur UN fichier ; fusionné ensuite par build.ts. */
export interface ExtractedFacts {
  components: InfraComponent[];
  links: InfraLink[];
  envVars: EnvVarFact[];
}

export function emptyFacts(): ExtractedFacts {
  return { components: [], links: [], envVars: [] };
}
