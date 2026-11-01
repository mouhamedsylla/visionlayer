import type { ArchModelV2, ArchNode } from "../arch/types.js";

/** La carte v2 en texte, pour la ligne de commande : nœuds par niveau, liens, couverture. */
export function formatNeutral(m: ArchModelV2): string {
  const out: string[] = [`${m.system.name} · ${m.nodes.length} nœuds, ${m.edges.length} liens`];
  const levels: [ArchNode["level"], string][] = [["system", "Système"], ["deployable", "Déployables"], ["component", "Composants"]];
  for (const [level, title] of levels) {
    const nodes = m.nodes.filter((n) => n.level === level);
    if (!nodes.length) continue;
    out.push("", title);
    for (const n of nodes) {
      const bits = [
        n.facets.entrypoints?.length ? `${n.facets.entrypoints.length} ${n.facets.entrypoints.length > 1 ? "points" : "point"} d'entrée` : "",
        n.facets.data ? `${n.facets.data.entities.length} entités` : "",
        n.facets.channel ? `canal ${n.facets.channel.topics.map((t) => t.name).join(", ")}` : "",
        n.facets.contract ? `contrat ${n.facets.contract.map((c) => `${c.name} (${c.implementations.length} implémentations)`).join(", ")}` : "",
        n.instances ? `${n.instances.min} exemplaires` : "",
      ].filter(Boolean);
      out.push(`  ${n.name} [${n.role}]${n.tech?.length ? ` ${n.tech.join(", ")}` : ""}${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
      out.push(`      ${n.proof[0] ? `${n.proof[0].path}:${n.proof[0].line}` : ""}${n.subtitle && n.subtitle.includes("non lu") ? ` · ${n.subtitle}` : ""}`);
    }
  }
  if (m.edges.length) {
    out.push("", "Liens");
    const name = (id: string) => m.nodes.find((n) => n.id === id)?.name ?? id;
    for (const e of m.edges) {
      const t = e.target?.entity ?? e.target?.topic ?? e.target?.entrypoint?.split(":").slice(2).join(":");
      out.push(`  ${name(e.from)} ${e.kind} ${name(e.to)}${t ? ` (${t})` : ""} ×${e.count} · ${e.occurrences[0]?.path}:${e.occurrences[0]?.line}`);
    }
  }
  out.push("", "Couverture");
  for (const c of m.coverage) {
    out.push(`  ${c.level} : ${c.read} / ${c.total} ${c.unit === "files" ? "fichiers analysés" : c.unit === "manifests" ? "manifestes lus" : c.unit}${c.understood !== undefined ? `, dont ${c.understood} compris (exécutés par un programme lu)` : ""}`);
    for (const g of c.gaps) out.push(`    ${g.kind === "language_not_read" ? "non lu" : g.kind === "pack_missing" ? "pack manquant" : g.kind} : ${g.subject} (${g.count})`);
  }
  return out.join("\n") + "\n";
}
