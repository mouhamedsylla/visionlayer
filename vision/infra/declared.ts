import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { ExtractedFacts, InfraWarning } from "./types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "./types.js";
import { componentId, normalizeEnv } from "./common.js";

export const DECLARED_FILE = ".vision/infra.yaml";

const KINDS = ["service", "database", "cache", "queue", "storage", "proxy", "gateway", "cdn", "dns", "host", "platform", "job", "image", "network", "other"] as const;
const LINK_KINDS = ["routes_to", "depends_on", "connects_to", "builds", "deploys", "exposes", "mounts"] as const;

const DeclaredSchema = z.object({
  version: z.literal(1),
  environments: z.array(z.string()).optional(),
  components: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        kind: z.enum(KINDS),
        environments: z.array(z.string()).optional(),
        attrs: z.record(z.string(), z.string()).optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  links: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum(LINK_KINDS),
        environments: z.array(z.string()).optional(),
        label: z.string().optional(),
      }),
    )
    .optional(),
});

export type DeclaredInfra = z.infer<typeof DeclaredSchema>;

/**
 * `.vision/infra.yaml` — la part déclarée à la main : ce qu'aucun fichier du
 * repository ne dit (CDN devant le domaine, VPS chez tel hébergeur…). Chaque
 * fait qui en sort porte `source.kind === "declared"` et est affiché comme
 * tel. C'est le seul fichier de `.vision/` écrit par un humain : il doit être
 * versionné (contrairement à model.json), voir ADR 0010.
 */
export function loadDeclared(root: string): { facts: ExtractedFacts; environments: string[]; warnings: InfraWarning[]; present: boolean } {
  const path = join(root, DECLARED_FILE);
  if (!existsSync(path)) return { facts: emptyFacts(), environments: [], warnings: [], present: false };
  const source = { kind: "declared" as const, path: DECLARED_FILE };
  const facts = emptyFacts();
  const warnings: InfraWarning[] = [];

  let parsed: DeclaredInfra;
  try {
    parsed = DeclaredSchema.parse(parseYaml(readFileSync(path, "utf-8")));
  } catch (err) {
    const detail = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ") : (err as Error).message.split("\n")[0];
    warnings.push({ code: "declared_invalid", message: `${DECLARED_FILE} invalide — ${detail}`, source });
    return { facts, environments: [], warnings, present: true };
  }

  const envs = (parsed.environments ?? []).map(normalizeEnv);
  for (const c of parsed.components ?? []) {
    const id = c.id ?? componentId(c.kind, c.name);
    facts.components.push({
      id,
      name: c.name,
      kind: c.kind,
      source,
      environments: c.environments?.length ? c.environments.map(normalizeEnv) : [ALL_ENVIRONMENTS],
      attrs: c.attrs ?? {},
      ...(c.note ? { note: c.note } : {}),
    });
  }
  for (const l of parsed.links ?? []) {
    facts.links.push({
      from: l.from,
      to: l.to,
      kind: l.kind,
      source,
      environments: l.environments?.length ? l.environments.map(normalizeEnv) : [ALL_ENVIRONMENTS],
      ...(l.label ? { label: l.label } : {}),
    });
  }
  return { facts, environments: envs, warnings, present: true };
}
