import type { Entity, SourceExcerpt } from "../../api/types";

/** Lignes lues au-dessus d'une déclaration, pour y trouver son commentaire. */
export const COMMENT_LOOKBACK = 3;

/** Le passage qui déclare une entité : de sa première ligne à la dernière de ses champs et contraintes, plus la fermeture. */
export function declarationSpan(entity: Entity): { path: string; line: number; from: number; to: number; marks: number[] } | undefined {
  const p = entity.proof;
  if (!p) return undefined;
  const own = [...(entity.fields ?? []).map((f) => f.proof), ...(entity.constraints ?? []).map((c) => c.proof)].filter((x) => x?.path === p.path);
  const last = Math.max(p.line, ...own.map((x) => x!.line));
  const marks = (entity.constraints ?? []).filter((c) => c.kind === "unique" || c.kind === "check").filter((c) => c.proof.path === p.path).map((c) => c.proof.line);
  return { path: p.path, line: p.line, from: Math.max(1, p.line - COMMENT_LOOKBACK), to: last + 1, marks };
}

/** Garde au-dessus de la déclaration le seul commentaire qui la touche ; le reste du haut est retiré. */
export function withLeadingComment(ex: SourceExcerpt, declLine: number): SourceExcerpt {
  let start = declLine - ex.from;
  while (start > 0 && /^\s*(\/\/|\*|\/\*|--|#)/.test(ex.lines[start - 1] ?? "")) start--;
  return { ...ex, from: ex.from + start, lines: ex.lines.slice(Math.max(0, start)) };
}

/** Le commentaire posé juste au-dessus d'une déclaration, sans ses marques : ce que l'auteur en dit. */
export function leadingComment(ex: SourceExcerpt, declLine: number): { text: string; line: number } | undefined {
  const lead = withLeadingComment(ex, declLine);
  const count = declLine - lead.from;
  if (count <= 0) return undefined;
  const text = lead.lines.slice(0, count).map((l) => l.replace(/^\s*(\/\*+|\*\/|\*|\/\/+|--|#)\s?/, "").replace(/\*\/\s*$/, "").trim()).filter(Boolean).join(" ");
  return text ? { text, line: lead.from } : undefined;
}

/** Le passage sans son commentaire du haut : la déclaration seule. */
export function withoutLeadingComment(ex: SourceExcerpt, declLine: number): SourceExcerpt {
  const start = Math.max(0, declLine - ex.from);
  return { ...ex, from: ex.from + start, lines: ex.lines.slice(start) };
}
