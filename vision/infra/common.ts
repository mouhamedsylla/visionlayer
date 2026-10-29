import type { ComponentKind, ExtractedSource, InfraComponent } from "./types.js";
import { ALL_ENVIRONMENTS } from "./types.js";

const ENV_ALIASES: Record<string, string> = {
  prod: "prod",
  production: "prod",
  prd: "prod",
  live: "prod",
  dev: "dev",
  development: "dev",
  local: "dev",
  staging: "staging",
  stage: "staging",
  stg: "staging",
  preprod: "staging",
  preproduction: "staging",
  preview: "staging",
  "deploy-preview": "staging",
  "branch-deploy": "staging",
  test: "test",
  testing: "test",
  ci: "test",
  qa: "test",
};

/** Normalise un nom d'environnement (`production` → `prod`). Inconnu : conservé tel quel, en minuscules. */
export function normalizeEnv(name: string): string {
  const key = name.trim().toLowerCase();
  return ENV_ALIASES[key] ?? key;
}

/** Environnement porté par un nom de fichier : `docker-compose.prod.yml`, `.env.production`, `overlays/prod/x.yaml`. */
export function envFromPath(path: string): string | undefined {
  const segments = path.split("/");
  const base = segments[segments.length - 1]!;
  const stem = base.replace(/\.(ya?ml|toml|json|tf|tfvars|conf|env)$/i, "");
  const parts = stem.split(/[.\-_]/).filter(Boolean);
  for (const p of parts) if (ENV_ALIASES[p.toLowerCase()]) return ENV_ALIASES[p.toLowerCase()];
  for (const dir of segments.slice(0, -1)) if (ENV_ALIASES[dir.toLowerCase()]) return ENV_ALIASES[dir.toLowerCase()];
  return undefined;
}

export function envsOf(env: string | undefined): string[] {
  return [env ?? ALL_ENVIRONMENTS];
}

/** Devine le rôle d'un composant à partir de son image de conteneur (fait : le nom de l'image, pas une interprétation). */
export function kindFromImage(image: string | undefined, name: string): ComponentKind {
  const hay = `${image ?? ""} ${name}`.toLowerCase();
  if (/postgres|mysql|mariadb|mongo|cockroach|timescale|sqlite|mssql|oracle/.test(hay)) return "database";
  if (/redis|memcache|valkey|keydb/.test(hay)) return "cache";
  if (/rabbitmq|kafka|nats|activemq|pulsar|sqs|mosquitto/.test(hay)) return "queue";
  if (/minio|s3|blob|bucket/.test(hay)) return "storage";
  if (/nginx|traefik|caddy|haproxy|envoy|apache|httpd/.test(hay)) return "proxy";
  if (/cron|worker|scheduler|job/.test(hay)) return "job";
  return "service";
}

export function componentId(kind: ComponentKind, name: string): string {
  return `${kind}:${name.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-")}`;
}

/** Numéro de ligne (1-based) de la première ligne contenant `needle`, sinon undefined. */
export function lineOf(content: string, needle: string | RegExp, from = 0): number | undefined {
  const lines = content.split("\n");
  for (let i = from; i < lines.length; i++) {
    const l = lines[i]!;
    if (typeof needle === "string" ? l.includes(needle) : needle.test(l)) return i + 1;
  }
  return undefined;
}

export function src(path: string, line?: number): ExtractedSource {
  return line === undefined ? { kind: "extracted", path } : { kind: "extracted", path, line };
}

/** Noms de variables dans une chaîne `KEY=value` / `KEY: value` / `${KEY}` — jamais les valeurs. */
export function envVarNamesIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\$\{?([A-Z][A-Z0-9_]{1,})\}?/g)) names.add(m[1]!);
  return [...names];
}

export function isEnvVarName(s: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(s);
}

/** Retire les secrets potentiels d'un attribut : on ne garde que l'hôte:port d'une URL avec identifiants. */
export function redactUrl(value: string): string {
  return value.replace(/(\w+:\/\/)([^/@\s]+)@/g, "$1***@");
}

export interface DeployCommand {
  /** Outil qui déploie : firebase, gcloud-run, gcloud-functions, vercel, netlify, kubectl, terraform, fly, wrangler. */
  tool: string;
  /** La commande telle qu'écrite. */
  command: string;
  /** Environnement ciblé (`--project dev` résolu via les alias .firebaserc), sinon `all`. */
  env: string;
  /** Ce que la commande déploie, si elle le dit (`--only hosting`, nom du service Cloud Run). */
  what?: string;
}

const DEPLOY_PATTERNS: { tool: string; re: RegExp }[] = [
  { tool: "firebase", re: /\bfirebase\s+deploy\b[^;&|\n]*/g },
  { tool: "gcloud-run", re: /\bgcloud\s+(?:beta\s+)?run\s+deploy\b[^;&|\n]*/g },
  { tool: "gcloud-functions", re: /\bgcloud\s+functions\s+deploy\b[^;&|\n]*/g },
  { tool: "gcloud-app", re: /\bgcloud\s+app\s+deploy\b[^;&|\n]*/g },
  { tool: "vercel", re: /\bvercel\s+(?:deploy\b|--prod\b)[^;&|\n]*/g },
  { tool: "netlify", re: /\bnetlify\s+deploy\b[^;&|\n]*/g },
  { tool: "kubectl", re: /\bkubectl\s+apply\b[^;&|\n]*/g },
  { tool: "terraform", re: /\bterraform\s+apply\b[^;&|\n]*/g },
  { tool: "fly", re: /\bfly(?:ctl)?\s+deploy\b[^;&|\n]*/g },
  { tool: "wrangler", re: /\bwrangler\s+(?:deploy|publish)\b[^;&|\n]*/g },
];

/**
 * Commandes de déploiement dans un script shell (package.json, étape CI) :
 * fait littéral — la commande est écrite dans le fichier. `aliases` traduit
 * `--project dev` / un id de projet en environnement.
 */
export function deployCommandsIn(script: string, aliases: Map<string, string> = new Map()): DeployCommand[] {
  const out: DeployCommand[] = [];
  for (const { tool, re } of DEPLOY_PATTERNS) {
    for (const m of script.matchAll(re)) {
      const cmd = m[0];
      const project = cmd.match(/(?:--project|-P)[=\s]+([\w.-]+)/)?.[1];
      let env = project ? (aliases.get(project) ?? normalizeEnv(project)) : ALL_ENVIRONMENTS;
      if (!project && tool === "vercel") env = /--prod\b/.test(cmd) ? "prod" : "staging";
      if (!project && tool === "netlify") env = /--prod\b/.test(cmd) ? "prod" : "staging";
      if (!project && tool === "fly") env = ALL_ENVIRONMENTS;
      const only = cmd.match(/--only[=\s]+([\w:,.-]+)/)?.[1];
      const service = tool === "gcloud-run" || tool === "gcloud-functions" ? cmd.match(/deploy\s+([a-z][\w-]*)/)?.[1] : undefined;
      const what = only ?? service;
      out.push(what ? { tool, command: cmd.trim(), env, what } : { tool, command: cmd.trim(), env });
    }
  }
  return out;
}

export const DEPLOY_TOOL_LABEL: Record<string, string> = {
  firebase: "Firebase",
  "gcloud-run": "Cloud Run",
  "gcloud-functions": "Cloud Functions",
  "gcloud-app": "App Engine",
  vercel: "Vercel",
  netlify: "Netlify",
  kubectl: "Kubernetes",
  terraform: "Terraform",
  fly: "Fly.io",
  wrangler: "Cloudflare",
};

/**
 * `gcloud run deploy <service> --source x --region y` : le service Cloud Run
 * existe, sous ce nom — fait écrit dans la commande. Composant `service`
 * fusionné avec toute autre mention du même nom (réécriture Firebase).
 */
export function cloudRunServiceFrom(d: DeployCommand, source: ExtractedSource): InfraComponent | undefined {
  if (d.tool !== "gcloud-run" || !d.what) return undefined;
  const attrs: Record<string, string> = { plateforme: "Cloud Run" };
  const flag = (name: string) => d.command.match(new RegExp(`--${name}[=\\s]+([^\\s]+)`))?.[1];
  for (const [k, f] of [["source", "source"], ["image", "image"], ["région", "region"]] as const) {
    const v = flag(f);
    if (v) attrs[k] = v;
  }
  return { id: componentId("service", d.what), name: d.what, kind: "service", source, environments: [ALL_ENVIRONMENTS], attrs };
}
