import { parse as parseYaml } from "yaml";
import type { ExtractedFacts } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { DEPLOY_TOOL_LABEL, cloudRunServiceFrom, componentId, deployCommandsIn, envVarNamesIn, lineOf, src } from "../common.js";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * cloudbuild.yaml (Google Cloud Build) : un composant `job` avec ses étapes
 * et les images qui les exécutent ; une commande de déploiement dans une
 * étape devient un lien `deploys`. Substitutions et secrets : noms seulement.
 */
export function extractCloudBuild(path: string, content: string, aliases: Map<string, string>): ExtractedFacts {
  const facts = emptyFacts();
  const doc = asRec(parseYaml(content));
  const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/, "");
  const id = componentId("job", `cloudbuild-${base}`);
  const steps = asList(doc.steps).map(asRec);
  const attrs: Record<string, string> = {};
  const stepIds = steps.map((s, i) => String(s.id ?? `#${i + 1}`));
  if (stepIds.length) attrs.étapes = stepIds.join(", ");
  const images = [...new Set(steps.map((s) => s.name).filter((n): n is string => typeof n === "string"))];
  if (images.length) attrs.images = images.join(", ");
  const pushed = asList(doc.images).map(String);
  if (pushed.length) attrs.publie = pushed.join(", ");
  const logging = asRec(doc.options).logging;
  if (typeof logging === "string") attrs.logs = logging;

  facts.components.push({ id, name: base === "cloudbuild" ? "Cloud Build" : `Cloud Build · ${base}`, kind: "job", source: src(path, 1), environments: [ALL_ENVIRONMENTS], attrs });

  steps.forEach((s) => {
    const script = [...asList(s.args).map(String), typeof s.script === "string" ? s.script : ""].join("\n");
    const line = lineOf(content, s.id ? `id: ${String(s.id)}` : String(s.name ?? ""), 0) ?? 1;
    for (const d of deployCommandsIn(script, aliases)) {
      const run = cloudRunServiceFrom(d, src(path, line));
      if (run) facts.components.push(run);
      facts.links.push({ from: id, to: `env:${d.env}`, kind: "deploys", source: src(path, line), environments: [d.env], label: `${DEPLOY_TOOL_LABEL[d.tool] ?? d.tool}${d.what ? ` (${d.what})` : ""}${d.env === ALL_ENVIRONMENTS ? "" : ` → ${d.env}`}` });
    }
    for (const n of asList(s.secretEnv).map(String)) facts.envVars.push({ name: n, component: id, source: src(path, line), environments: [ALL_ENVIRONMENTS] });
    for (const n of envVarNamesIn(script)) if (!n.startsWith("_") && !facts.envVars.some((v) => v.name === n)) facts.envVars.push({ name: n, component: id, source: src(path, line), environments: [ALL_ENVIRONMENTS] });
  });
  for (const k of Object.keys(asRec(doc.substitutions))) facts.envVars.push({ name: k, component: id, source: src(path, lineOf(content, `${k}:`) ?? 1), environments: [ALL_ENVIRONMENTS] });
  for (const sm of asList(asRec(doc.availableSecrets).secretManager).map(asRec)) {
    if (typeof sm.env === "string") facts.envVars.push({ name: sm.env, component: id, source: src(path, lineOf(content, sm.env) ?? 1), environments: [ALL_ENVIRONMENTS] });
  }
  return facts;
}
