import type { StackModel, TechCategory, TechEvidence } from "./types.js";
import type { StackDiff } from "./diff.js";

export const CATEGORY_LABEL: Record<TechCategory, string> = {
  language: "Langages",
  runtime: "Exécution",
  framework: "Frameworks & interface",
  styling: "Style",
  data: "Données & état",
  backend: "Backend & API",
  cloud: "Cloud & hébergement",
  database: "Bases de données & files",
  ai: "Intelligence artificielle",
  media: "Médias, maths & rendu",
  build: "Build & paquets",
  test: "Tests",
  quality: "Qualité",
  analytics: "Analytique & observabilité",
  ci: "CI/CD, conteneurs & réseau",
  library: "Autres bibliothèques",
};

export function evidenceLabel(e: TechEvidence): string {
  switch (e.kind) {
    case "package":
      return `${e.package} ${e.range}${e.installed ? ` (installé ${e.installed})` : ""}${e.dev ? " · dev" : ""} ← ${e.manifest}${e.line ? `:${e.line}` : ""}`;
    case "config":
      return `configuration ← ${e.path}`;
    case "infra":
      return `composant « ${e.name} » ← ${e.path}${e.line ? `:${e.line}` : ""}`;
    case "image":
      return `image ${e.image} ← ${e.path}${e.line ? `:${e.line}` : ""}`;
    case "system":
      return `paquet système ${e.package} ← ${e.path}${e.line ? `:${e.line}` : ""}`;
    case "runtime":
      return `${e.field} = ${e.value} ← ${e.path}${e.line ? `:${e.line}` : ""}`;
    case "files":
      return `${e.count} fichier(s) ${e.extension}`;
  }
}

/** Sortie texte de `vision stack` — même contenu que l'écran Technologies. */
export function formatStackModel(stack: StackModel, diff?: StackDiff): string {
  const out: string[] = [];
  out.push("TECHNOLOGIES");
  out.push("────────────────────────────────");
  out.push("");
  const total = stack.languages.reduce((n, l) => n + l.files, 0);
  out.push(`LANGAGES (${stack.languages.length})`);
  for (const l of stack.languages) out.push(`  ${l.name.padEnd(12)} ${String(l.files).padStart(5)} fichiers  ${total ? Math.round((l.files / total) * 100) : 0} %  (${l.extensions.join(" ")})`);
  out.push("");
  out.push(`ESPACES DE TRAVAIL (${stack.workspaces.length})`);
  for (const w of stack.workspaces) out.push(`  ${w.name}  [${w.ecosystem}]  ← ${w.manifest}`);
  out.push("");

  let current: string | undefined;
  for (const t of stack.technologies) {
    if (t.category === "language") continue;
    const label = CATEGORY_LABEL[t.category];
    if (label !== current) {
      current = label;
      out.push(`${label.toUpperCase()} (${stack.technologies.filter((x) => x.category === t.category).length})`);
    }
    const versions = t.versions.length ? `  ${t.versions.join(" · ")}` : "";
    const facets = t.facets.length ? `  [${t.facets.join(", ")}]` : "";
    const importers = t.importers.length ? `  — importé par ${t.importers.length} fichier(s)` : "";
    out.push(`  ${t.name}${versions}${facets}${importers}`);
    if (t.category !== "library") for (const e of t.evidence.filter((e) => e.kind !== "files").slice(0, 6)) out.push(`      ${evidenceLabel(e)}`);
  }
  out.push("");

  if (diff && (diff.added.length || diff.removed.length || diff.changed.length)) {
    out.push("DEPUIS LE SCAN PRÉCÉDENT");
    for (const t of diff.added) out.push(`  + ${t.name}${t.versions.length ? `  ${t.versions.join(" · ")}` : ""}`);
    for (const t of diff.removed) out.push(`  − ${t.name}`);
    for (const c of diff.changed) out.push(`  ~ ${c.name}  ${c.before.join(" · ") || "—"} → ${c.after.join(" · ") || "—"}`);
    out.push("");
  }

  if (stack.warnings.length) {
    out.push(`POINTS D'ATTENTION (${stack.warnings.length})`);
    for (const w of stack.warnings) out.push(`  ⚠ ${w.message}${w.path && w.code !== "version_divergence" ? `  ← ${w.path}` : ""}`);
  }
  return out.join("\n") + "\n";
}
