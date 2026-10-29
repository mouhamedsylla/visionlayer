import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listProjectFiles } from "../scanner/files.js";
import type { InfraSourceFile } from "./types.js";
import { envFromPath } from "./common.js";
import { hasDeployScript } from "./extractors/scripts.js";

type Format = InfraSourceFile["format"];

/**
 * Reconnaît les fichiers d'infrastructure par leur nom, puis (pour les YAML
 * ambigus) par leur contenu. Déterministe : un fichier reconnu l'est toujours
 * de la même façon.
 */
export function classifyInfraFile(path: string, content: () => string): Format | undefined {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const lower = base.toLowerCase();

  if (/^(docker-)?compose(\..*)?\.ya?ml$/.test(lower)) return "docker-compose";
  if (/^dockerfile(\..*)?$/.test(lower) || /\.dockerfile$/.test(lower)) return "dockerfile";
  if (/^nginx.*\.conf$/.test(lower) || (lower.endsWith(".conf") && /\/nginx\//.test(path))) return "nginx";
  if (/^caddyfile(\..*)?$/.test(lower)) return "caddy";
  if (/^traefik(\..*)?\.(ya?ml|toml)$/.test(lower)) return "traefik";
  if (/^\.env(\..*)?$/.test(lower) && !/\.(js|ts|d\.ts)$/.test(lower)) return "dotenv";
  if (/\.github\/workflows\/[^/]+\.ya?ml$/.test(path)) return "github-actions";
  if (lower.endsWith(".tf")) return "terraform";
  if (lower === "vercel.json") return "vercel";
  if (lower === "netlify.toml") return "netlify";
  if (lower === "firebase.json") return "firebase";
  if (lower === "package.json") return hasDeployScript(content()) ? "package-scripts" : undefined;
  if (/^cloudbuild(\..*)?\.ya?ml$/.test(lower)) return "cloudbuild";
  if (/\.ya?ml$/.test(lower)) {
    const head = content().slice(0, 4000);
    if (/^\s*apiVersion:\s*\S+/m.test(head) && /^\s*kind:\s*\S+/m.test(head)) return "kubernetes";
  }
  return undefined;
}

export function discoverInfraFiles(root: string): InfraSourceFile[] {
  const found: InfraSourceFile[] = [];
  for (const { path, size } of listProjectFiles(root)) {
    if (size > 512 * 1024) continue;
    const format = classifyInfraFile(path, () => readFileSync(join(root, path), "utf-8"));
    if (!format) continue;
    // Un Dockerfile décrit une image, un workflow CI des jobs : leur nom ne porte pas d'environnement
    // (`ci.yml` n'est pas un environnement « test »). Les jobs le disent via `environment:`.
    const environment = format === "dockerfile" || format === "github-actions" || format === "cloudbuild" || format === "package-scripts" || format === "firebase" ? undefined : envFromPath(path);
    found.push(environment ? { path, format, environment } : { path, format });
  }
  return found;
}
