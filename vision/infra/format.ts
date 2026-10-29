import type { InfraComponent, InfraModel } from "./types.js";
import { ALL_ENVIRONMENTS } from "./types.js";

const KIND_LABEL: Record<InfraComponent["kind"], string> = {
  service: "service",
  database: "base de données",
  cache: "cache",
  queue: "file de messages",
  storage: "stockage",
  proxy: "reverse proxy",
  gateway: "gateway",
  cdn: "CDN",
  dns: "DNS",
  host: "hôte",
  platform: "plateforme",
  job: "job / CI",
  image: "image",
  network: "réseau",
  other: "autre",
};

export function kindLabel(kind: InfraComponent["kind"]): string {
  return KIND_LABEL[kind];
}

function envLabel(envs: string[]): string {
  return envs.includes(ALL_ENVIRONMENTS) ? "tous" : envs.join(", ");
}

function srcLabel(s: InfraComponent["source"]): string {
  return s.kind === "declared" ? `déclaré (${s.path})` : `${s.path}${s.line ? `:${s.line}` : ""}`;
}

/** Sortie texte de `vision infra` — même contenu que l'écran Infrastructure de l'interface. */
export function formatInfraModel(infra: InfraModel): string {
  const out: string[] = [];
  out.push("INFRASTRUCTURE");
  out.push("────────────────────────────────");
  out.push("");
  out.push(`ENVIRONNEMENTS (${infra.environments.length})`);
  out.push(infra.environments.length ? "  " + infra.environments.join(" · ") : "  (aucun environnement nommé — tout vaut pour tous)");
  out.push("");

  out.push(`COMPOSANTS (${infra.components.length})`);
  for (const c of infra.components) {
    out.push(`  ${c.name}  [${kindLabel(c.kind)}]  env: ${envLabel(c.environments)}  ← ${srcLabel(c.source)}`);
    for (const [k, v] of Object.entries(c.attrs)) out.push(`      ${k}: ${v}`);
    if (c.perEnv) for (const [e, a] of Object.entries(c.perEnv)) for (const [k, v] of Object.entries(a)) out.push(`      ${k} (${e}): ${v}`);
    if (c.note) out.push(`      note: ${c.note}`);
  }
  out.push("");

  out.push(`LIENS (${infra.links.length})`);
  const name = (id: string) => infra.components.find((c) => c.id === id)?.name ?? id.replace(/^(name|env):/, "");
  for (const l of infra.links) out.push(`  ${name(l.from)} —${l.kind}${l.label ? ` (${l.label})` : ""}→ ${name(l.to)}  env: ${envLabel(l.environments)}`);
  out.push("");

  out.push(`VARIABLES D'ENVIRONNEMENT — noms uniquement (${infra.envVars.length})`);
  for (const v of infra.envVars) out.push(`  ${v.name}${v.component ? `  (${name(v.component)})` : ""}  env: ${envLabel(v.environments)}`);
  out.push("");

  const withDiff = infra.components.filter((c) => c.perEnv);
  out.push(`DIFFÉRENCES ENTRE ENVIRONNEMENTS (${withDiff.length} composant(s))`);
  for (const c of withDiff) {
    out.push(`  ${c.name}`);
    for (const [e, a] of Object.entries(c.perEnv!)) for (const [k, v] of Object.entries(a)) out.push(`      ${e}: ${k} = ${v}${c.attrs[k] !== undefined ? `  (base : ${c.attrs[k]})` : ""}`);
  }
  out.push("");

  out.push(`SOURCES (${infra.sources.length})`);
  for (const s of infra.sources) out.push(`  ${s.path}  [${s.format}${s.environment ? ` · ${s.environment}` : ""}]${s.parseError ? `  ⚠ ${s.parseError}` : ""}`);
  if (infra.warnings.length) {
    out.push("");
    out.push(`POINTS D'ATTENTION (${infra.warnings.length})`);
    for (const w of infra.warnings) out.push(`  ⚠ ${w.message}${w.source ? `  ← ${srcLabel(w.source)}` : ""}`);
  }
  return out.join("\n") + "\n";
}
