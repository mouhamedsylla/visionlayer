import type { ArchModelV2, Coverage, Proof } from "../../api/types";
import { screenHref } from "../../app/screens";
import { count } from "../text/plural";
import { outdated, type Measures } from "./measure";

/** Un trou : ce qui manque, sa nature, pourquoi il compte, la ligne qui le montre. Plus `risk` est grand, plus il passe devant. */
export interface Gap {
  risk: number;
  title: string;
  tag: string;
  detail: string;
  proof?: Pick<Proof, "path" | "line">;
  href?: string;
}

const STATE_WORD = { stale: "le code ancré a changé", contradicted: "la vérification échoue", orphan: "le code ancré est introuvable" } as const;

/** Les trous, du plus risqué au moins : une note que le code contredit, un point d'entrée qui écrit sans feature, un refus muet, ce qui n'est pas lu. */
export function coverageGaps(model: ArchModelV2, m: Measures): Gap[] {
  const gaps: Gap[] = [];
  for (const c of m.claims.filter(outdated)) {
    const at = c.anchors.find((a) => a.at)?.at;
    gaps.push({ risk: c.state === "contradicted" ? 5 : 4, title: c.id, tag: "note à relire", detail: STATE_WORD[c.state as keyof typeof STATE_WORD], proof: at ?? { path: c.file, line: c.line } });
  }
  for (const { entry, node } of m.entries.filter((e) => !e.attached)) {
    const writes = entry.flow?.some((s) => s.kind === "write");
    gaps.push({
      risk: writes ? 3 : 2, title: entry.key, tag: "point d'entrée sans feature", detail: `${node.name} · ${writes ? "écrit des données" : "n'écrit rien"}`,
      proof: entry.proof, href: screenHref("features", entry.id),
    });
  }
  for (const { step, node } of m.refusals.filter((r) => !r.explained)) {
    gaps.push({ risk: 2, title: `refus ${step.status ?? ""} ${step.code ? `« ${step.code} »` : ""}`.replace(/\s+/g, " ").trim(), tag: "refus sans explication", detail: `${node.name}${step.when ? ` · si ${step.when}` : ""}`, proof: step.proof });
  }
  for (const { entity, node } of m.tables.filter((t) => !t.read)) {
    gaps.push({ risk: 1, title: entity.name, tag: "champs non lus", detail: `${node.name} · ses champs ne sont pas lus`, ...(entity.proof ? { proof: entity.proof } : {}) });
  }
  for (const g of model.coverage.flatMap((c: Coverage) => c.gaps)) {
    gaps.push({ risk: 2, title: g.subject, tag: g.kind === "language_not_read" ? "non lu" : g.kind === "pack_missing" ? "sans pack" : "cible inconnue", detail: count(g.count, "endroit"), ...(g.proof && g.proof.line > 0 ? { proof: g.proof } : {}) });
  }
  return gaps.sort((a, b) => b.risk - a.risk);
}
