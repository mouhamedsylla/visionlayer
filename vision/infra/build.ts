import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentKind, EnvVarFact, ExtractedFacts, InfraComponent, InfraLink, InfraModel, InfraSourceFile, InfraWarning } from "./types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "./types.js";
import { discoverInfraFiles } from "./discover.js";
import { loadDeclared, DECLARED_FILE } from "./declared.js";
import { extractCompose } from "./extractors/compose.js";
import { extractDockerfile } from "./extractors/dockerfile.js";
import { extractCaddy, extractNginx, extractTraefik } from "./extractors/proxy.js";
import { extractDotenv } from "./extractors/dotenv.js";
import { extractGithubActions } from "./extractors/githubActions.js";
import { extractTerraform } from "./extractors/terraform.js";
import { extractKubernetes } from "./extractors/kubernetes.js";
import { extractNetlify, extractVercel } from "./extractors/platforms.js";
import { extractFirebase, parseFirebaserc, type FirebaseProjects } from "./extractors/firebase.js";
import { extractCloudBuild } from "./extractors/cloudbuild.js";
import { extractPackageScripts } from "./extractors/scripts.js";

interface ExtractContext {
  /** Rôle des services compose appris dans le fichier de base, pour les surcharges. */
  composeKinds: Map<string, ComponentKind>;
  /** `.firebaserc` lu à côté de chaque firebase.json (clé : dossier, "" à la racine). */
  firebase: Map<string, FirebaseProjects>;
  /** Alias et ids de projet → environnement, tous `.firebaserc` confondus (pour `--project x`). */
  aliases: Map<string, string>;
}

function runExtractor(file: InfraSourceFile, content: string, ctx: ExtractContext): ExtractedFacts {
  switch (file.format) {
    case "docker-compose":
      return extractCompose(file.path, content, file.environment, ctx.composeKinds);
    case "dockerfile":
      return extractDockerfile(file.path, content);
    case "nginx":
      return extractNginx(file.path, content, file.environment);
    case "caddy":
      return extractCaddy(file.path, content, file.environment);
    case "traefik":
      return extractTraefik(file.path, content, file.environment);
    case "dotenv":
      return extractDotenv(file.path, content, file.environment);
    case "github-actions":
      return extractGithubActions(file.path, content);
    case "terraform":
      return extractTerraform(file.path, content, file.environment);
    case "kubernetes":
      return extractKubernetes(file.path, content, file.environment);
    case "vercel":
      return extractVercel(file.path, content);
    case "netlify":
      return extractNetlify(file.path, content);
    case "firebase":
      return extractFirebase(file.path, content, ctx.firebase.get(dirOf(file.path)));
    case "cloudbuild":
      return extractCloudBuild(file.path, content, ctx.aliases);
    case "package-scripts":
      return extractPackageScripts(file.path, content, ctx.aliases);
    case "declared":
      return emptyFacts();
  }
}

/**
 * Construit le modèle Infrastructure d'un repository : découverte des fichiers,
 * extraction fichier par fichier (une erreur de parsing n'arrête jamais le
 * reste — elle est notée sur la source), fusion, résolution des cibles par nom,
 * puis part déclarée. Déterministe : mêmes fichiers → même modèle.
 */
export function buildInfraModel(root: string): InfraModel {
  const warnings: InfraWarning[] = [];
  // Les fichiers de base (sans environnement dans le nom) sont lus avant les
  // surcharges, pour que la source « de référence » d'un composant soit la base.
  const discovered = discoverInfraFiles(root);
  const ctx: ExtractContext = { composeKinds: new Map(), firebase: new Map(), aliases: new Map() };
  for (const f of discovered.filter((s) => s.format === "firebase")) {
    const rc = join(root, dirOf(f.path), ".firebaserc");
    if (!existsSync(rc)) continue;
    try {
      const projects = parseFirebaserc(readFileSync(rc, "utf-8"));
      ctx.firebase.set(dirOf(f.path), projects);
      for (const [k, v] of projects.envOf) if (!ctx.aliases.has(k)) ctx.aliases.set(k, v);
    } catch (err) {
      warnings.push({ code: "declared_invalid", message: `.firebaserc illisible : ${(err as Error).message.split("\n")[0]}`, source: { kind: "extracted", path: join(dirOf(f.path), ".firebaserc") } });
    }
  }
  // Firebase lit `functions/.env.<alias ou id de projet>` pour le projet visé :
  // le suffixe est un environnement dès que .firebaserc le connaît.
  for (const f of discovered) {
    if (f.format !== "dotenv" || f.environment) continue;
    const suffix = f.path.slice(f.path.lastIndexOf("/") + 1).replace(/^\.env\.?/, "");
    const env = ctx.aliases.get(suffix);
    if (env && env !== ALL_ENVIRONMENTS) f.environment = env;
  }
  const sources = discovered.sort((a, b) => Number(a.environment !== undefined) - Number(b.environment !== undefined) || a.path.localeCompare(b.path));
  const merged = emptyFacts();

  for (const file of sources) {
    try {
      const facts = runExtractor(file, readFileSync(join(root, file.path), "utf-8"), ctx);
      merged.components.push(...facts.components);
      merged.links.push(...facts.links);
      merged.envVars.push(...facts.envVars);
    } catch (err) {
      file.parseError = (err as Error).message.split("\n")[0];
    }
  }

  const declared = loadDeclared(root);
  if (declared.present) sources.push({ path: DECLARED_FILE, format: "declared" });
  warnings.push(...declared.warnings);
  merged.components.push(...declared.facts.components);
  merged.links.push(...declared.facts.links);

  const components = mergeComponents(merged.components);
  const byName = new Map<string, InfraComponent>();
  for (const c of components) byName.set(c.name.toLowerCase(), c);

  // Une route vers un nom de domaine qu'aucun fichier ne décrit (`api.acme.io`)
  // est un fait : point d'entrée externe. Un nom nu inconnu reste un avertissement.
  for (const l of merged.links) {
    const ref = l.to;
    if (!ref.startsWith("name:")) continue;
    const host = ref.slice(5);
    if (!host.includes(".") || byName.has(host.toLowerCase())) continue;
    const c: InfraComponent = { id: `external:${host}`, name: host, kind: "other", source: l.source, environments: [ALL_ENVIRONMENTS], attrs: { externe: "oui" } };
    components.push(c);
    byName.set(host.toLowerCase(), c);
  }
  components.sort((a, b) => a.id.localeCompare(b.id));

  const links = mergeLinks(
    merged.links.map((l) => ({ ...l, from: resolveRef(l.from, components, byName), to: resolveRef(l.to, components, byName) })),
  );
  const ids = new Set(components.map((c) => c.id));
  for (const l of links) {
    for (const end of [l.from, l.to]) {
      if (ids.has(end) || end.startsWith("env:")) continue;
      warnings.push({ code: "unknown_link_target", message: `cible inconnue « ${end.replace(/^name:/, "")} » (${l.kind}) — aucun composant ne porte ce nom`, source: l.source });
    }
  }

  attachFunctionsEnvFiles(merged.envVars, components);
  const envVars = mergeEnvVars(merged.envVars, ids);
  const environments = collectEnvironments(components, links, envVars, sources, declared.environments);
  computePerEnv(components);

  for (const v of envVars) {
    const only = v.environments.filter((e) => e !== ALL_ENVIRONMENTS);
    if (environments.length > 1 && only.length === 1 && !v.environments.includes(ALL_ENVIRONMENTS)) {
      warnings.push({ code: "env_only", message: `variable ${v.name} présente uniquement en ${only[0]}`, source: v.source });
    }
  }
  if (sources.length === 0) warnings.push({ code: "no_infra_files", message: "aucun fichier d'infrastructure reconnu dans ce repository" });

  return { version: 1, environments, components, links, envVars, sources, warnings };
}

/** `name:api` → id du composant nommé `api` s'il existe, sinon inchangé (signalé en avertissement). */
function resolveRef(ref: string, components: InfraComponent[], byName: Map<string, InfraComponent>): string {
  if (!ref.startsWith("name:")) return components.some((c) => c.id === ref) ? ref : (byName.get(ref.toLowerCase())?.id ?? ref);
  const name = ref.slice(5).toLowerCase();
  const hit = byName.get(name) ?? components.find((c) => c.id.endsWith(`:${name}`));
  return hit ? hit.id : ref;
}

/** Un même composant décrit par plusieurs fichiers (compose base + override prod) : un seul, environnements et attributs cumulés. */
function mergeComponents(all: InfraComponent[]): InfraComponent[] {
  const out = new Map<string, InfraComponent & { attrsByEnv: Record<string, Record<string, string>> }>();
  for (const c of all) {
    const existing = out.get(c.id);
    const envKey = c.environments[0] ?? ALL_ENVIRONMENTS;
    if (!existing) {
      out.set(c.id, { ...c, environments: [...c.environments], attrs: { ...c.attrs }, attrsByEnv: { [envKey]: { ...c.attrs } } });
      continue;
    }
    for (const e of c.environments) if (!existing.environments.includes(e)) existing.environments.push(e);
    existing.attrsByEnv[envKey] = { ...(existing.attrsByEnv[envKey] ?? {}), ...c.attrs };
    for (const [k, v] of Object.entries(c.attrs)) if (!(k in existing.attrs)) existing.attrs[k] = v;
    if (existing.source.kind === "declared" && c.source.kind === "extracted") existing.source = c.source;
    if (c.note && !existing.note) existing.note = c.note;
  }
  return [...out.values()]
    .map(({ attrsByEnv, ...c }) => {
      const envs = Object.keys(attrsByEnv).filter((e) => e !== ALL_ENVIRONMENTS);
      // Base = attributs valables partout ; sinon (composant propre à des envs) le premier env sert de référence.
      const base = attrsByEnv[ALL_ENVIRONMENTS] ?? (envs[0] ? { ...attrsByEnv[envs[0]]! } : {});
      const perEnv: Record<string, Record<string, string>> = {};
      for (const e of envs) {
        const diff: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrsByEnv[e]!)) if (base[k] !== v) diff[k] = v;
        if (Object.keys(diff).length) perEnv[e] = diff;
      }
      const merged: InfraComponent = { ...c, attrs: base };
      if (c.perEnv) for (const [e, a] of Object.entries(c.perEnv)) perEnv[e] = { ...(perEnv[e] ?? {}), ...a };
      if (Object.keys(perEnv).length) merged.perEnv = perEnv;
      else delete merged.perEnv;
      if (merged.environments.length > 1 && merged.environments.includes(ALL_ENVIRONMENTS)) merged.environments = [ALL_ENVIRONMENTS];
      return merged;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function mergeLinks(all: InfraLink[]): InfraLink[] {
  const out = new Map<string, InfraLink>();
  for (const l of all) {
    const key = `${l.from}|${l.to}|${l.kind}|${l.label ?? ""}`;
    const existing = out.get(key);
    if (!existing) out.set(key, { ...l, environments: [...l.environments] });
    else for (const e of l.environments) if (!existing.environments.includes(e)) existing.environments.push(e);
  }
  return [...out.values()]
    .map((l) => (l.environments.includes(ALL_ENVIRONMENTS) ? { ...l, environments: [ALL_ENVIRONMENTS] } : l))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
}

function mergeEnvVars(all: EnvVarFact[], ids: Set<string>): EnvVarFact[] {
  const out = new Map<string, EnvVarFact>();
  for (const v of all) {
    const component = v.component && ids.has(v.component) ? v.component : undefined;
    const key = `${v.name}|${component ?? ""}`;
    const existing = out.get(key);
    if (!existing) {
      const { component: _dropped, ...rest } = v;
      const entry: EnvVarFact = component ? { ...rest, component, environments: [...v.environments] } : { ...rest, environments: [...v.environments] };
      out.set(key, entry);
    } else for (const e of v.environments) if (!existing.environments.includes(e)) existing.environments.push(e);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.component ?? "").localeCompare(b.component ?? ""));
}

function collectEnvironments(components: InfraComponent[], links: InfraLink[], envVars: EnvVarFact[], sources: InfraSourceFile[], declared: string[]): string[] {
  const envs = new Set<string>(declared);
  for (const s of sources) if (s.environment) envs.add(s.environment);
  for (const x of [...components, ...links, ...envVars]) for (const e of x.environments) if (e !== ALL_ENVIRONMENTS) envs.add(e);
  for (const c of components) for (const e of Object.keys(c.perEnv ?? {})) if (e !== ALL_ENVIRONMENTS) envs.add(e);
  for (const l of links) if (l.to.startsWith("env:") && l.to !== `env:${ALL_ENVIRONMENTS}`) envs.add(l.to.slice(4));
  const order = ["dev", "test", "staging", "prod"];
  return [...envs].sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)) || a.localeCompare(b));
}

/** Retire de perEnv ce qui est identique à la base (déjà fait à la fusion) — hook conservé pour les extracteurs qui remplissent perEnv eux-mêmes. */
function computePerEnv(components: InfraComponent[]): void {
  for (const c of components) {
    if (!c.perEnv) continue;
    for (const [e, a] of Object.entries(c.perEnv)) {
      for (const k of Object.keys(a)) if (c.attrs[k] === a[k]) delete a[k];
      if (!Object.keys(a).length) delete c.perEnv[e];
    }
    if (!Object.keys(c.perEnv).length) delete c.perEnv;
  }
}

function dirOf(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

/** Les `.env*` posés dans le dossier source d'une Cloud Function sont lus par cette fonction (convention Firebase). */
function attachFunctionsEnvFiles(envVars: EnvVarFact[], components: InfraComponent[]): void {
  const fnDirs = components.filter((c) => c.id.startsWith("service:firebase-functions") && c.attrs.source).map((c) => ({ id: c.id, dir: c.attrs.source!.replace(/\/$/, "") }));
  for (const v of envVars) {
    if (v.component || v.source.kind !== "extracted") continue;
    const hit = fnDirs.find((f) => dirOf(v.source.path) === f.dir && /\/\.env[^/]*$/.test(v.source.path));
    if (hit) v.component = hit.id;
  }
}
