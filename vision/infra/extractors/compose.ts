import { parse as parseYaml } from "yaml";
import type { ComponentKind, ExtractedFacts, InfraComponent } from "../types.js";
import { emptyFacts } from "../types.js";
import { componentId, envsOf, isEnvVarName, kindFromImage, lineOf, redactUrl, src } from "../common.js";

type Rec = Record<string, unknown>;

const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

/** Identifiant stable d'un service compose — partagé avec nginx/traefik (upstream `api` = service `api`). */
export function composeServiceId(name: string, kind: ComponentKind): string {
  return componentId(kind, name);
}

/**
 * docker-compose*.yml : chaque service devient un composant ; `depends_on`,
 * `links`, `build` et les labels Traefik deviennent des liens. Les clés
 * d'`environment` sont extraites par nom uniquement.
 */
export function extractCompose(path: string, content: string, environment: string | undefined, kindHints: Map<string, ComponentKind> = new Map()): ExtractedFacts {
  const facts = emptyFacts();
  const doc = asRec(parseYaml(content));
  const services = asRec(doc.services);
  const envs = envsOf(environment);

  // Une surcharge (`docker-compose.prod.yml`) redéfinit souvent un service sans
  // répéter son image : le rôle vient alors du fichier de base, déjà lu.
  const kinds = new Map<string, ComponentKind>();
  for (const [name, raw] of Object.entries(services)) {
    const svc = asRec(raw);
    const image = asStr(svc.image);
    const kind = image ? kindFromImage(image, name) : (kindHints.get(name) ?? kindFromImage(undefined, name));
    kinds.set(name, kind);
    if (image) kindHints.set(name, kind);
  }

  for (const [name, raw] of Object.entries(services)) {
    const svc = asRec(raw);
    const kind = kinds.get(name)!;
    const id = composeServiceId(name, kind);
    const line = lineOf(content, new RegExp(`^\\s{2,}${escapeRe(name)}:\\s*$`));
    const attrs: Record<string, string> = {};
    const image = asStr(svc.image);
    if (image) attrs.image = image;
    const ports = asList(svc.ports).map((p) => (typeof p === "object" ? `${asStr(asRec(p).published) ?? "?"}:${asStr(asRec(p).target) ?? "?"}` : String(p)));
    if (ports.length) attrs.ports = ports.join(", ");
    const build = svc.build;
    const buildCtx = typeof build === "string" ? build : asStr(asRec(build).context);
    const dockerfile = typeof build === "object" ? asStr(asRec(build).dockerfile) : undefined;
    if (buildCtx) attrs.build = dockerfile ? `${buildCtx} (${dockerfile})` : buildCtx;
    const volumes = asList(svc.volumes).map((v) => (typeof v === "string" ? v.split(":")[0]! : asStr(asRec(v).source) ?? "?"));
    if (volumes.length) attrs.volumes = volumes.join(", ");
    if (asStr(svc.restart)) attrs.restart = asStr(svc.restart)!;
    const replicas = asStr(asRec(svc.deploy).replicas);
    if (replicas) attrs.replicas = replicas;
    const profiles = asList(svc.profiles).map(String);
    if (profiles.length) attrs.profiles = profiles.join(", ");
    const command = svc.command;
    if (command !== undefined) attrs.command = Array.isArray(command) ? command.map(String).join(" ") : String(command);
    const healthcheck = asRec(svc.healthcheck);
    if (healthcheck.test) attrs.healthcheck = "oui";

    const component: InfraComponent = { id, name, kind, source: src(path, line), environments: envs, attrs };
    facts.components.push(component);

    // Variables d'environnement : noms seulement.
    const envBlock = svc.environment;
    const names: string[] = [];
    if (Array.isArray(envBlock)) for (const e of envBlock) names.push(String(e).split("=")[0]!);
    else for (const k of Object.keys(asRec(envBlock))) names.push(k);
    for (const n of names) if (isEnvVarName(n)) facts.envVars.push({ name: n, component: id, source: src(path, line), environments: envs });
    const envFiles = asList(svc.env_file).map(String).concat(typeof svc.env_file === "string" ? [svc.env_file] : []);
    if (envFiles.length) attrs.env_file = envFiles.join(", ");

    // Liens.
    const dependsOn = Array.isArray(svc.depends_on) ? svc.depends_on.map(String) : Object.keys(asRec(svc.depends_on));
    for (const dep of dependsOn) {
      const depKind = kinds.get(dep) ?? "service";
      facts.links.push({ from: id, to: composeServiceId(dep, depKind), kind: "depends_on", source: src(path, line), environments: envs });
    }
    for (const l of asList(svc.links).map(String)) {
      const target = l.split(":")[0]!;
      facts.links.push({ from: id, to: composeServiceId(target, kinds.get(target) ?? "service"), kind: "connects_to", source: src(path, line), environments: envs });
    }
    if (buildCtx) {
      const dfPath = normalizeDockerfilePath(path, buildCtx, dockerfile);
      facts.links.push({ from: `image:${dfPath}`, to: id, kind: "builds", source: src(path, line), environments: envs, label: "build" });
    }

    // Traefik via labels : Host(`x`) et routers.
    const labels = Array.isArray(svc.labels) ? Object.fromEntries(svc.labels.map((l) => String(l).split(/=(.*)/s).slice(0, 2) as [string, string])) : asRec(svc.labels);
    const hosts = new Set<string>();
    for (const [k, v] of Object.entries(labels)) {
      if (!k.startsWith("traefik.")) continue;
      for (const m of String(v).matchAll(/Host\(`([^`]+)`\)/g)) hosts.add(m[1]!);
    }
    if (hosts.size) {
      attrs.domains = [...hosts].join(", ");
      const proxyId = componentId("proxy", "traefik");
      for (const h of hosts) facts.links.push({ from: proxyId, to: id, kind: "routes_to", source: src(path, line), environments: envs, label: h });
    }
    for (const [k] of Object.entries(attrs)) if (/url|dsn|uri/i.test(k)) attrs[k] = redactUrl(attrs[k]!);
  }

  return facts;
}

function normalizeDockerfilePath(composePath: string, context: string, dockerfile: string | undefined): string {
  const dir = composePath.includes("/") ? composePath.slice(0, composePath.lastIndexOf("/")) : "";
  const parts = [...(dir ? dir.split("/") : []), ...context.split("/"), ...(dockerfile ?? "Dockerfile").split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
