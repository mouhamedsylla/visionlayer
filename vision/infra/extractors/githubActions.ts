import { parse as parseYaml } from "yaml";
import type { ExtractedFacts } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { componentId, envVarNamesIn, lineOf, normalizeEnv, src } from "../common.js";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/**
 * Workflow GitHub Actions : un composant `job` par workflow ; chaque job doté
 * d'un `environment:` (ou dont le nom/les étapes parlent de déploiement)
 * devient un lien `deploys` vers cet environnement. Les secrets sont cités
 * par nom (`${{ secrets.X }}`), jamais par valeur.
 */
export function extractGithubActions(path: string, content: string): ExtractedFacts {
  const facts = emptyFacts();
  const doc = asRec(parseYaml(content));
  const name = typeof doc.name === "string" ? doc.name : path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/, "");
  const id = componentId("job", `gha-${name}`);
  const attrs: Record<string, string> = { workflow: path.slice(path.lastIndexOf("/") + 1) };

  const on = doc.on ?? doc[true as unknown as string];
  const triggers: string[] = [];
  if (typeof on === "string") triggers.push(on);
  else if (Array.isArray(on)) triggers.push(...on.map(String));
  else {
    for (const [ev, cfg] of Object.entries(asRec(on))) {
      const branches = asRec(cfg).branches;
      triggers.push(Array.isArray(branches) ? `${ev} (${branches.map(String).join(", ")})` : ev);
    }
  }
  if (triggers.length) attrs.triggers = triggers.join(", ");

  const jobs = asRec(doc.jobs);
  const jobNames: string[] = [];
  const targets = new Map<string, number>();
  for (const [jobName, raw] of Object.entries(jobs)) {
    const job = asRec(raw);
    jobNames.push(jobName);
    const line = lineOf(content, new RegExp(`^\\s{2}${jobName}:\\s*$`)) ?? 1;
    const envSpec = job.environment;
    const envName = typeof envSpec === "string" ? envSpec : typeof asRec(envSpec).name === "string" ? (asRec(envSpec).name as string) : undefined;
    if (envName) targets.set(normalizeEnv(envName.replace(/\$\{\{.*\}\}/, "").trim() || envName), line);
    else if (/deploy|release|publish/i.test(jobName)) targets.set(ALL_ENVIRONMENTS, line);

    const steps = Array.isArray(job.steps) ? job.steps : [];
    for (const s of steps) {
      const step = asRec(s);
      const uses = typeof step.uses === "string" ? step.uses : "";
      const run = typeof step.run === "string" ? step.run : "";
      for (const m of `${uses} ${run} ${JSON.stringify(step.with ?? {})} ${JSON.stringify(step.env ?? {})}`.matchAll(/secrets\.([A-Z][A-Z0-9_]*)/g)) {
        if (!facts.envVars.some((v) => v.name === m[1] && v.component === id)) facts.envVars.push({ name: m[1]!, component: id, source: src(path, line), environments: [ALL_ENVIRONMENTS] });
      }
      for (const n of envVarNamesIn(run)) if (!n.startsWith("GITHUB_") && !facts.envVars.some((v) => v.name === n && v.component === id)) facts.envVars.push({ name: n, component: id, source: src(path, line), environments: [ALL_ENVIRONMENTS] });
    }
  }
  attrs.jobs = jobNames.join(", ");

  facts.components.push({ id, name: `CI · ${name}`, kind: "job", source: src(path, 1), environments: [ALL_ENVIRONMENTS], attrs });
  for (const [env, line] of targets) {
    facts.links.push({ from: id, to: `env:${env}`, kind: "deploys", source: src(path, line), environments: [env], label: env === ALL_ENVIRONMENTS ? "déploie" : `déploie → ${env}` });
  }
  return facts;
}
