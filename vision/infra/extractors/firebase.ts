import type { ExtractedFacts, InfraComponent } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { componentId, lineOf, normalizeEnv, src } from "../common.js";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);
const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * `.firebaserc` : alias de projets (`dev` → id GCP) et cibles d'hébergement
 * (cible `prep` → site `mon-app` dans tel projet). C'est lui qui dit quel
 * environnement correspond à quel projet — aucun autre fichier ne le dit.
 */
export interface FirebaseProjects {
  /** Environnement normalisé → id du projet. */
  projectOf: Map<string, string>;
  /** Alias ou id de projet → environnement normalisé. */
  envOf: Map<string, string>;
  /** id du projet → cible → sites. */
  sites: Map<string, Map<string, string[]>>;
}

export function parseFirebaserc(content: string): FirebaseProjects {
  const doc = asRec(JSON.parse(content));
  const projectOf = new Map<string, string>();
  const envOf = new Map<string, string>();
  const aliases = Object.entries(asRec(doc.projects)).filter(([, v]) => typeof v === "string") as [string, string][];
  // `default` n'est un environnement que s'il est le seul alias ; sinon il double un alias nommé.
  const named = aliases.filter(([a]) => a !== "default");
  for (const [alias, id] of named.length ? named : aliases) {
    const env = alias === "default" ? ALL_ENVIRONMENTS : normalizeEnv(alias);
    if (!projectOf.has(env)) projectOf.set(env, id);
    envOf.set(alias, env);
    if (!envOf.has(id)) envOf.set(id, env);
  }
  for (const [alias, id] of aliases) if (alias === "default" && !envOf.has("default")) envOf.set("default", envOf.get(id) ?? ALL_ENVIRONMENTS);
  const sites = new Map<string, Map<string, string[]>>();
  for (const [project, raw] of Object.entries(asRec(doc.targets))) {
    const perTarget = new Map<string, string[]>();
    for (const [target, list] of Object.entries(asRec(asRec(raw).hosting))) perTarget.set(target, asList(list).map(String));
    sites.set(project, perTarget);
  }
  return { projectOf, envOf, sites };
}

/**
 * firebase.json : sites d'hébergement (un par cible), Cloud Functions (une
 * par codebase), Firestore, Storage, et les réécritures d'hébergement vers une
 * fonction ou un service Cloud Run. Avec `.firebaserc`, chaque composant porte
 * le projet et le site propres à chaque environnement (`perEnv`).
 */
export function extractFirebase(path: string, content: string, projects: FirebaseProjects | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const doc = asRec(JSON.parse(content));
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const envs = projects ? [...projects.projectOf.keys()].filter((e) => e !== ALL_ENVIRONMENTS) : [];

  const withProjects = (c: InfraComponent, extra?: (env: string, project: string) => Record<string, string>): InfraComponent => {
    if (!projects || envs.length === 0) return c;
    const perEnv: Record<string, Record<string, string>> = {};
    for (const env of envs) {
      const project = projects.projectOf.get(env)!;
      perEnv[env] = { projet: project, ...(extra?.(env, project) ?? {}) };
    }
    return { ...c, perEnv };
  };

  const functionIds = new Map<string, string>();
  for (const fn of asList(doc.functions).map(asRec)) {
    const source = asStr(fn.source) ?? "functions";
    const codebase = asStr(fn.codebase) ?? "default";
    const id = componentId("service", `firebase-functions-${codebase}`);
    functionIds.set(codebase, id);
    const attrs: Record<string, string> = { source: `${dir}${source}`, codebase };
    if (asStr(fn.runtime)) attrs.runtime = asStr(fn.runtime)!;
    const predeploy = asList(fn.predeploy).map(String);
    if (predeploy.length) attrs.predeploy = predeploy.join(" && ");
    const line = lineOf(content, /"functions"\s*:/) ?? 1;
    facts.components.push(withProjects({ id, name: codebase === "default" ? "Cloud Functions" : `Cloud Functions · ${codebase}`, kind: "service", source: src(path, line), environments: [ALL_ENVIRONMENTS], attrs }));
  }

  for (const db of asList(doc.firestore).map(asRec)) {
    const name = asStr(db.database) ?? "(default)";
    const id = componentId("database", `firestore-${name === "(default)" ? "default" : name}`);
    const attrs: Record<string, string> = { base: name };
    if (asStr(db.rules)) attrs.règles = `${dir}${asStr(db.rules)}`;
    if (asStr(db.indexes)) attrs.index = `${dir}${asStr(db.indexes)}`;
    if (asStr(db.location)) attrs.région = asStr(db.location)!;
    facts.components.push(withProjects({ id, name: "Firestore", kind: "database", source: src(path, lineOf(content, /"firestore"\s*:/) ?? 1), environments: [ALL_ENVIRONMENTS], attrs }));
  }

  for (const st of asList(doc.storage).map(asRec)) {
    const bucket = asStr(st.bucket);
    const id = componentId("storage", `firebase-storage${bucket ? `-${bucket}` : ""}`);
    const attrs: Record<string, string> = {};
    if (bucket) attrs.bucket = bucket;
    if (asStr(st.rules)) attrs.règles = `${dir}${asStr(st.rules)}`;
    facts.components.push(withProjects({ id, name: "Cloud Storage", kind: "storage", source: src(path, lineOf(content, /"storage"\s*:/) ?? 1), environments: [ALL_ENVIRONMENTS], attrs }));
  }

  let hostingFrom = 0;
  for (const h of asList(doc.hosting).map(asRec)) {
    const target = asStr(h.target) ?? asStr(h.site);
    const id = componentId("host", `firebase-hosting${target ? `-${target}` : ""}`);
    const line = (target ? lineOf(content, `"${target}"`, hostingFrom) : lineOf(content, /"hosting"\s*:/)) ?? 1;
    hostingFrom = line;
    const attrs: Record<string, string> = {};
    if (asStr(h.public)) attrs.public = `${dir}${asStr(h.public)}`;
    const rewrites = asList(h.rewrites).map(asRec);
    const spa = rewrites.filter((r) => asStr(r.destination));
    if (spa.length) attrs.réécritures = spa.map((r) => `${asStr(r.source) ?? "?"} → ${asStr(r.destination)}`).join(", ");
    const headers = asList(h.headers);
    if (headers.length) attrs.headers = String(headers.length);
    const redirects = asList(h.redirects);
    if (redirects.length) attrs.redirections = String(redirects.length);

    const c = withProjects(
      { id, name: target ? `Firebase Hosting · ${target}` : "Firebase Hosting", kind: "host", source: src(path, line), environments: [ALL_ENVIRONMENTS], attrs },
      (_env, project): Record<string, string> => {
        const sites = target ? projects?.sites.get(project)?.get(target) : undefined;
        return sites?.length ? { site: sites.join(", ") } : {};
      },
    );
    facts.components.push(c);

    for (const r of rewrites) {
      const fn = r.function;
      const run = asRec(r.run);
      const label = asStr(r.source) ?? "**";
      if (typeof fn === "string" || asStr(asRec(fn).functionId)) {
        const target = functionIds.get("default") ?? componentId("service", "firebase-functions-default");
        facts.links.push({ from: id, to: target, kind: "routes_to", source: src(path, lineOf(content, `"${label}"`, line) ?? line), environments: [ALL_ENVIRONMENTS], label: `${label} → ${typeof fn === "string" ? fn : asStr(asRec(fn).functionId)}` });
      } else if (asStr(run.serviceId)) {
        // Une réécriture vers Cloud Run nomme le service : il existe, même si aucun autre fichier ne le décrit.
        const service = asStr(run.serviceId)!;
        const runLine = lineOf(content, service) ?? line;
        const attrs: Record<string, string> = { plateforme: "Cloud Run" };
        if (asStr(run.region)) attrs.région = asStr(run.region)!;
        facts.components.push({ id: componentId("service", service), name: service, kind: "service", source: src(path, runLine), environments: [ALL_ENVIRONMENTS], attrs });
        facts.links.push({ from: id, to: componentId("service", service), kind: "routes_to", source: src(path, runLine), environments: [ALL_ENVIRONMENTS], label: `${label} (Cloud Run)` });
      }
    }
  }

  return facts;
}
