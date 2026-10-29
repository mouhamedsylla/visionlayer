import type { ExtractedFacts } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { DEPLOY_TOOL_LABEL, cloudRunServiceFrom, componentId, deployCommandsIn, lineOf, src } from "../common.js";

/** Vrai si un package.json contient au moins une commande de déploiement dans ses scripts. */
export function hasDeployScript(content: string): boolean {
  try {
    const scripts = (JSON.parse(content) as { scripts?: Record<string, unknown> }).scripts ?? {};
    return Object.values(scripts).some((s) => typeof s === "string" && deployCommandsIn(s).length > 0);
  } catch {
    return false;
  }
}

/**
 * Scripts npm/pnpm qui déploient (`"deploy:prod": "… firebase deploy --project prod"`) :
 * un composant `job` par script — un déploiement lancé à la main depuis un
 * poste est un fait d'infrastructure aussi important qu'un job CI.
 */
export function extractPackageScripts(path: string, content: string, aliases: Map<string, string>): ExtractedFacts {
  const facts = emptyFacts();
  const scripts = (JSON.parse(content) as { scripts?: Record<string, unknown> }).scripts ?? {};
  const where = path.includes("/") ? `${path.slice(0, path.lastIndexOf("/"))} · ` : "";
  for (const [name, raw] of Object.entries(scripts)) {
    if (typeof raw !== "string") continue;
    const deploys = deployCommandsIn(raw, aliases);
    if (!deploys.length) continue;
    const id = componentId("job", `script-${where}${name}`);
    const line = lineOf(content, `"${name}"`) ?? 1;
    facts.components.push({ id, name: `script · ${where}${name}`, kind: "job", source: src(path, line), environments: [ALL_ENVIRONMENTS], attrs: { commande: raw } });
    for (const d of deploys) {
      const run = cloudRunServiceFrom(d, src(path, line));
      if (run) facts.components.push(run);
      facts.links.push({ from: id, to: `env:${d.env}`, kind: "deploys", source: src(path, line), environments: [d.env], label: `${DEPLOY_TOOL_LABEL[d.tool] ?? d.tool}${d.what ? ` (${d.what})` : ""}${d.env === ALL_ENVIRONMENTS ? "" : ` → ${d.env}`}` });
    }
  }
  return facts;
}
