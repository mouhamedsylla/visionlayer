import type { ClaimState, KnowledgeReport, ResolvedAnchor } from "./types.js";

export const STATE_LABEL: Record<ClaimState, string> = {
  verified: "structure vérifiée",
  current: "à jour",
  stale: "à reconfirmer",
  contradicted: "contredit",
  orphan: "orphelin",
  unanchored: "hypothèse",
};

function anchorLine(a: ResolvedAnchor): string {
  if (!a.at) return `      ${a.ref.raw} · introuvable`;
  const where = `${a.at.path}:${a.at.line}${a.at.endLine > a.at.line ? `–${a.at.endLine}` : ""}${a.at.symbol ? ` (${a.at.symbol})` : ""}`;
  const notes = [
    a.status === "moved" && `déplacé depuis ${a.ref.raw}`,
    a.status === "candidate" && `candidat pour ${a.ref.raw}`,
    a.changed && "code changé depuis la référence",
    a.unknownAtReference && "code introuvable au point de référence",
    a.check === "failed" && a.checkNote,
  ].filter(Boolean);
  return `      ${where}${notes.length ? ` · ${notes.join(" · ")}` : ""}`;
}

/** Rapport lisible : par concept, chaque affirmation avec son état, sa référence et ses ancrages. */
export function formatKnowledge(r: KnowledgeReport): string {
  const out: string[] = [];
  const all = r.concepts.flatMap((c) => c.claims);
  const count = (s: ClaimState) => all.filter((c) => c.state === s).length;
  out.push(`Connaissance · ${r.concepts.length} concepts · ${all.length} affirmations`);
  out.push(`  ${(Object.keys(STATE_LABEL) as ClaimState[]).map((s) => `${STATE_LABEL[s]} ${count(s)}`).join(" · ")}`);
  for (const c of r.concepts) {
    out.push("", `${c.kind} ${c.id} — ${c.name}  (${c.file})`);
    if (c.entries.length) out.push(`  points d'entrée : ${c.entries.map((e) => (e.found ? e.name : `${e.name} (absent de la carte)`)).join(", ")}`);
    for (const k of c.claims) {
      const ref = k.reference.uncommitted ? "non commitée" : `vraie au ${k.reference.commit!.slice(0, 7)} (${k.reference.date})`;
      out.push(`  [${STATE_LABEL[k.state]}] ${k.type} ${k.id} · ${ref}${k.anchors.length ? ` · tests : ${k.tests.length ? k.tests.join(", ") : "aucun"}` : ""}`);
      out.push(`      « ${k.text.replace(/\s+/g, " ")} »`);
      for (const a of k.anchors) out.push(anchorLine(a));
    }
  }
  if (r.entriesWithoutFeature.length) out.push("", `Points d'entrée sans feature (${r.entriesWithoutFeature.length}) : ${r.entriesWithoutFeature.join(", ")}`);
  if (r.errors.length) out.push("", "Erreurs :", ...r.errors.map((e) => `  ${e.file} : ${e.message}`));
  return out.join("\n") + "\n";
}
