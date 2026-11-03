import type { KnowledgePayload } from "../api/types";

/**
 * L'écran Règles et décisions (planche Regles) : ce qui est déclaré, confronté au code. Deux sources, jamais un
 * modèle de langue : les affirmations des agents (`.vision/knowledge/`), ancrées et revérifiées à chaque carte ; et les
 * règles écrites dans un document (une section « Règles » du README), lues telles quelles, sans ancrage.
 */

export type Tone = "ok" | "sg" | "cr" | "q";
export interface Evidence { what: string; path: string; line: number; to: number; note?: string }
export interface RuleRow {
  id: string; text: string; who: "agent" | "document"; kind: string;
  src: { path: string; line: number }; code: string; state: string; tone: Tone;
  evidence: Evidence[]; tests: string[]; note: string; since?: string;
}

const KINDS: Record<string, string> = { rule: "règle", invariant: "invariant", decision: "décision", guarantee: "garantie", limit: "limite", failure: "panne" };
const STATE: Record<string, [string, Tone]> = {
  verified: ["Tient", "ok"], current: ["En vigueur", "q"], stale: ["À reconfirmer", "sg"],
  contradicted: ["Contredite", "cr"], orphan: ["Code introuvable", "sg"], unanchored: ["Sans code", "q"],
};
const STATUS: Record<string, string> = { moved: "déplacé, retrouvé à l'identique", candidate: "introuvable à sa place ; un symbole du même nom existe ailleurs", orphan: "introuvable" };

export function rules(k?: KnowledgePayload): RuleRow[] {
  const out: RuleRow[] = [];
  for (const c of k?.report.concepts ?? []) for (const claim of c.claims) {
    if (!KINDS[claim.type]) continue;
    const [state, tone] = STATE[claim.state] ?? ["?", "q"];
    const found = claim.anchors.filter((a) => a.at);
    const evidence = claim.anchors.map((a): Evidence => ({
      what: a.ref.symbol ?? a.ref.marker ?? "le code ancré", path: a.at?.path ?? a.ref.path, line: a.at?.line ?? 0, to: a.at?.endLine ?? 0,
      ...(a.checkNote ? { note: a.checkNote } : a.status !== "ok" ? { note: STATUS[a.status] } : a.changed ? { note: "le code a changé depuis la déclaration" } : {}),
    }));
    const failed = claim.anchors.find((a) => a.check === "failed");
    const code = failed?.checkNote ? `Ne tient plus : ${failed.checkNote}.`
      : !claim.anchors.length ? "Aucun ancrage : rien ne la relie au code."
      : !found.length ? "Son code est introuvable."
      : `Ancrée sur ${found.map((a) => a.ref.symbol ?? a.at!.path.split("/").pop()).join(", ")}${claim.anchors.some((a) => a.check === "ok") ? " ; la vérification passe" : ""}${claim.anchors.some((a) => a.changed) ? " ; le code a changé depuis" : ""}.`;
    out.push({
      id: claim.id, text: claim.text, who: "agent", kind: KINDS[claim.type]!, src: { path: claim.file, line: claim.line }, code, state, tone, evidence, tests: claim.tests,
      note: claim.state === "contradicted" ? "VisionLayer ne tranche pas : la règle ou le code est faux. L'écart va à l'agent du projet."
        : claim.state === "stale" ? "Le code ancré a changé : un agent doit la reconfirmer ou la corriger."
        : `Déclarée par un agent dans ${c.name}${claim.reference.date ? `, le ${claim.reference.date.slice(0, 10)}` : ""}${claim.reference.uncommitted ? ", non commitée" : ""}.`,
      ...(claim.reference.commit ? { since: claim.reference.commit.slice(0, 7) } : {}),
    });
  }
  for (const [i, d] of (k?.documents ?? []).entries()) out.push({
    id: `doc:${i}`, text: d.text, who: "document", kind: "règle", src: { path: d.path, line: d.line },
    code: "Écrite dans un document : rien ne la relie au code, rien n'est vérifié.", state: "Dite, non vérifiée", tone: "q", evidence: [], tests: [],
    note: `Lue dans ${d.path}, section « ${d.section} ». Un agent qui la déclare dans .vision/knowledge/ l'ancre sur le code qui la tient ; elle est alors revérifiée à chaque analyse.`,
  });
  // Les contredites d'abord, puis celles à reconfirmer ; l'ordre de déclaration sinon.
  const rank: Record<Tone, number> = { cr: 0, sg: 1, ok: 2, q: 3 };
  return out.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.tone] - rank[b.r.tone] || a.i - b.i).map((x) => x.r);
}
