import type { ArchModelV2 } from "../../api/types";

/** Ce qu'un morceau de phrase désigne dans le système. */
export type MarkKind = "route" | "value" | "code" | "env" | "file" | "status" | "block" | "table" | "queue";
export type TechPiece = { text: string; kind?: MarkKind };
/** Les noms que le modèle connaît, chacun avec ce qu'il est : un bloc, une table, une file, une variable. */
export type Lexicon = Map<string, MarkKind>;

const METHOD = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ANY";
// reconnus par leur forme, jamais par le projet : l'ordre compte, le premier qui prend gagne
const SHAPES: [MarkKind | "quoted", string][] = [
  ["route", `«\\s*(?:${METHOD})\\s+\\/[^»]*?\\s*»|\\b(?:${METHOD})\\s+\\/[^\\s,;»)]*`],
  ["quoted", "«\\s*[^»]+?\\s*»"],
  ["code", "`[^`]+`"],
  ["status", "\\(\\d{3}\\)"],
  ["file", "(?<![\\w/])[\\w.-]+(?:\\/[\\w.-]+)+\\.\\w+(?::\\d+)?"],
  ["env", "\\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\\b"],
  ["code", "\\b[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+(?:\\(\\))?|\\b[a-z][a-z0-9]*[A-Z][\\w$]*(?:\\(\\))?|\\b[\\w$]+\\(\\)"],
];
const SHAPE = new RegExp(SHAPES.map(([, s]) => `(${s})`).join("|"), "g");

const unquote = (s: string) => s.replace(/^[«`]\s*|\s*[»`]$/g, "");

/** Les noms du modèle : blocs, tables, files et variables, pour les reconnaître dans une phrase. */
export function lexiconOf(model: ArchModelV2): Lexicon {
  const lex: Lexicon = new Map();
  for (const n of model.nodes) {
    if (n.level === "deployable" || n.level === "system") lex.set(n.name, "block");
    for (const e of n.facets.data?.entities ?? []) if (!e.name.includes("/")) lex.set(e.name, "table");
    for (const t of n.facets.channel?.topics ?? []) lex.set(t.name, "queue");
    for (const v of n.facets.config?.env ?? []) lex.set(v.name, "env");
  }
  return lex;
}

function words(text: string, lex: Lexicon): TechPiece[] {
  if (lex.size === 0) return [{ text }];
  return text.split(/([\p{L}\p{N}_$-]+)/u).filter(Boolean).map((w) => ({ text: w, kind: lex.get(w) }));
}

function shaped(raw: string, kind: MarkKind | "quoted", lex: Lexicon): TechPiece {
  const inner = unquote(raw);
  if (kind === "route") return { text: inner, kind };
  if (kind === "quoted") return { text: inner, kind: lex.get(inner) ?? "value" };
  if (kind === "status") return { text: raw.slice(1, -1), kind };
  return { text: kind === "code" ? inner : raw, kind: lex.get(inner) ?? kind };
}

/**
 * Découpe une phrase écrite par le moteur en morceaux : le texte courant, et
 * chaque terme technique avec sa nature, pour qu'il se voie d'un coup d'œil.
 * Les guillemets « » d'une route ou d'un nom connu tombent : la marque les remplace.
 */
export function techPieces(text: string, lex: Lexicon = new Map()): TechPiece[] {
  const out: TechPiece[] = [];
  let at = 0;
  for (const m of text.matchAll(SHAPE)) {
    if (m.index > at) out.push(...words(text.slice(at, m.index), lex));
    const i = m.slice(1).findIndex((g) => g !== undefined);
    out.push(shaped(m[0], SHAPES[i]![0], lex));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(...words(text.slice(at), lex));
  return out.reduce<TechPiece[]>((acc, p) => {
    const last = acc[acc.length - 1];
    if (last && !last.kind && !p.kind) last.text += p.text;
    else acc.push({ ...p });
    return acc;
  }, []);
}
