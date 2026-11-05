import type { ArchNode, KnowledgePayload, MapPayload } from "../api/types";

/**
 * L'écran Règles et décisions (planche Regles) : ce qui est déclaré, confronté au code. Deux sources, jamais un
 * modèle de langue : les affirmations des agents (`.vision/knowledge/`), ancrées et revérifiées à chaque carte ; et les
 * règles écrites dans un document (une section “Règles” du README), lues telles quelles, sans ancrage.
 */

export type Tone = "ok" | "sg" | "cr" | "q";
export interface Evidence { what: string; path: string; line: number; to: number; note?: string }
export interface RuleRow {
  id: string; text: string; who: "agent" | "document"; kind: string;
  src: { path: string; line: number }; code: string; state: string; tone: Tone;
  evidence: Evidence[]; tests: string[]; note: string; since?: string;
}

const KINDS: Record<string, string> = { rule: "rule", invariant: "invariant", decision: "decision", guarantee: "garantie", limit: "limite", failure: "panne" };
const STATE: Record<string, [string, Tone]> = {
  verified: ["Holds", "ok"], current: ["In force", "q"], stale: ["To reconfirm", "sg"],
  contradicted: ["Contradicted", "cr"], orphan: ["Code not found", "sg"], unanchored: ["No code", "q"],
};
const STATUS: Record<string, string> = { moved: "moved, found identical", candidate: "not found in place; a symbol with the same name exists elsewhere", orphan: "introuvable" };

export function rules(k?: KnowledgePayload): RuleRow[] {
  const out: RuleRow[] = [];
  for (const c of k?.report.concepts ?? []) for (const claim of c.claims) {
    if (!KINDS[claim.type]) continue;
    const [state, tone] = STATE[claim.state] ?? ["?", "q"];
    const found = claim.anchors.filter((a) => a.at);
    const evidence = claim.anchors.map((a): Evidence => ({
      what: a.ref.symbol ?? a.ref.marker ?? "the anchored code", path: a.at?.path ?? a.ref.path, line: a.at?.line ?? 0, to: a.at?.endLine ?? 0,
      ...(a.checkNote ? { note: a.checkNote } : a.status !== "ok" ? { note: STATUS[a.status] } : a.changed ? { note: "the code changed since the declaration" } : {}),
    }));
    const failed = claim.anchors.find((a) => a.check === "failed");
    const code = failed?.checkNote ? `No longer holds: ${failed.checkNote}.`
      : !claim.anchors.length ? "No anchor: nothing links it to the code."
      : !found.length ? "Its code can't be found."
      : `Anchored on ${found.map((a) => a.ref.symbol ?? a.at!.path.split("/").pop()).join(", ")}${claim.anchors.some((a) => a.check === "ok") ? "; the check passes" : ""}${claim.anchors.some((a) => a.changed) ? "; the code changed since" : ""}.`;
    out.push({
      id: claim.id, text: claim.text, who: "agent", kind: KINDS[claim.type]!, src: { path: claim.file, line: claim.line }, code, state, tone, evidence, tests: claim.tests,
      note: claim.state === "contradicted" ? "VisionLayer doesn't decide: the rule or the code is wrong. The gap goes to the project's agent."
        : claim.state === "stale" ? "The anchored code changed: an agent must reconfirm or correct it."
        : `Declared by an agent in ${c.name}${claim.reference.date ? `, le ${claim.reference.date.slice(0, 10)}` : ""}${claim.reference.uncommitted ? ", uncommitted" : ""}.`,
      ...(claim.reference.commit ? { since: claim.reference.commit.slice(0, 7) } : {}),
    });
  }
  for (const [i, d] of (k?.documents ?? []).entries()) out.push({
    id: `doc:${i}`, text: d.text, who: "document", kind: "rule", src: { path: d.path, line: d.line },
    code: "Written in a document: nothing links it to the code, nothing is checked.", state: "Stated, not checked", tone: "q", evidence: [], tests: [],
    note: `Read in ${d.path}, section “${d.section}”. An agent that declares it in .vision/knowledge/ anchors it on the code that holds it; it is then re-checked at every analysis.`,
  });
  // Les contredites d'abord, puis celles à reconfirmer ; l'ordre de déclaration sinon.
  const rank: Record<Tone, number> = { cr: 0, sg: 1, ok: 2, q: 3 };
  return out.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.tone] - rank[b.r.tone] || a.i - b.i).map((x) => x.r);
}

/** Les règles ancrées sur un bloc : un de leurs ancrages tombe dans ses fichiers ou ceux de ses modules. */
export function rulesOf(list: RuleRow[], map: MapPayload, block: ArchNode): RuleRow[] {
  const files = new Set([block, ...map.model.nodes.filter((n) => n.parent === block.id)].flatMap((n) => n.files ?? []));
  return list.filter((r) => r.evidence.some((e) => files.has(e.path)));
}
