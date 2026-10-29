import { createHash } from "node:crypto";
import type Parser from "tree-sitter";
import { parse } from "../parsers/parser.js";
import { languageFor } from "../scanner/scanner.js";
import type { AnchorRef, ClaimType } from "./types.js";

type Node = Parser.SyntaxNode;

/** Un symbole nommé du fichier : fonction, constante, classe, méthode, interface, type. */
export interface FoundSymbol {
  name: string;
  node: Node;
  nameNode: Node;
}

/** Ce qu'un ancrage désigne dans un fichier : ses lignes et l'empreinte de son code normalisé. */
export interface AnchorSpan {
  line: number;
  endLine: number;
  symbol?: string;
  fingerprint: string;
  /** Pour les vérifications structurelles ; absent hors TypeScript/JavaScript. */
  node?: Node;
}

/** Commentaire marqueur d'une partie sans nom : `// @k identifiant` (ou `# @k`, `/* @k … *\/`). */
const markerPattern = (id: string) => new RegExp(`(?:\\/\\/|#|\\/\\*)\\s*@k\\s+${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`);

export function parseSource(path: string, source: string): Node | undefined {
  const lang = languageFor(path);
  if (!lang) return undefined;
  const tree = parse(source, lang);
  return tree.rootNode;
}

/** Symboles de premier niveau (et méthodes de classe, `Classe.méthode`). */
export function symbolsOf(root: Node): FoundSymbol[] {
  const out: FoundSymbol[] = [];
  const visit = (n: Node, prefix = "") => {
    for (const c of n.namedChildren) {
      if (c.type === "export_statement") {
        visit(c, prefix);
        continue;
      }
      const name = c.childForFieldName("name");
      if (["function_declaration", "generator_function_declaration", "class_declaration", "abstract_class_declaration", "interface_declaration", "type_alias_declaration", "enum_declaration"].includes(c.type) && name) {
        out.push({ name: prefix + name.text, node: c, nameNode: name });
        const body = c.childForFieldName("body");
        if (body && c.type.includes("class")) {
          for (const m of body.namedChildren) {
            const mn = m.childForFieldName("name");
            if ((m.type === "method_definition" || m.type === "public_field_definition") && mn) out.push({ name: `${name.text}.${mn.text}`, node: m, nameNode: mn });
          }
        }
      } else if (c.type === "lexical_declaration" || c.type === "variable_declaration") {
        for (const d of c.namedChildren) {
          const dn = d.childForFieldName("name");
          if (d.type === "variable_declarator" && dn?.type === "identifier") out.push({ name: dn.text, node: d, nameNode: dn });
        }
      }
    }
  };
  visit(root);
  return out;
}

/**
 * Empreinte du code : les jetons de l'arbre syntaxique, sans commentaires ni
 * mise en forme. Le nom du symbole lui-même est remplacé, pour qu'un simple
 * renommage garde la même empreinte (et soit reconnu comme un déplacement).
 */
export function fingerprint(node: Node, skip?: Node): string {
  const tokens: string[] = [];
  const walk = (n: Node) => {
    if (n.type === "comment") return;
    if (skip && n.startIndex === skip.startIndex && n.endIndex === skip.endIndex) {
      tokens.push("_");
      return;
    }
    if (n.childCount === 0) {
      tokens.push(n.text);
      return;
    }
    for (const c of n.children) walk(c);
  };
  walk(node);
  return hash(tokens.join(" "));
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

/** Texte sans commentaires ni espaces : empreinte d'un fichier qu'on ne sait pas analyser (règles, YAML…). */
function textFingerprint(text: string): string {
  return hash(text.replace(/\/\/.*$|#.*$/gm, "").replace(/\s+/g, " ").trim());
}

/** L'instruction qui suit un marqueur, dans le nœud donné. */
function markedPart(scope: Node, source: string, marker: string): Node | undefined {
  const re = markerPattern(marker);
  let found: Node | undefined;
  const walk = (n: Node) => {
    if (found) return;
    for (const c of n.namedChildren) {
      if (found) return;
      if (c.type === "comment" && re.test(c.text)) {
        let s = c.nextNamedSibling;
        while (s && s.type === "comment") s = s.nextNamedSibling;
        found = s ?? undefined;
        return;
      }
      walk(c);
    }
  };
  walk(scope);
  return found;
}

/** Hors TypeScript/JavaScript : du marqueur à la fin du bloc qui suit (accolades équilibrées), sinon la ligne suivante. */
function markedLines(source: string, marker: string): { line: number; endLine: number; text: string } | undefined {
  const lines = source.split("\n");
  const re = markerPattern(marker);
  const at = lines.findIndex((l) => re.test(l));
  if (at < 0) return undefined;
  let depth = 0;
  let opened = false;
  for (let i = at + 1; i < lines.length; i++) {
    for (const ch of lines[i]!.replace(/\/\/.*$/, "")) {
      if (ch === "{") (depth++, (opened = true));
      else if (ch === "}") depth--;
    }
    if (!opened && lines[i]!.trim()) return { line: at + 2, endLine: i + 1, text: lines[i]! };
    if (opened && depth <= 0) return { line: at + 2, endLine: i + 1, text: lines.slice(at + 1, i + 1).join("\n") };
  }
  return undefined;
}

/** Ce que l'ancrage désigne dans ce fichier, ou undefined s'il n'y est pas. */
export function locate(ref: AnchorRef, path: string, source: string): AnchorSpan | undefined {
  const root = parseSource(path, source);
  if (!root) {
    if (ref.symbol) return undefined;
    if (ref.marker) {
      const part = markedLines(source, ref.marker);
      return part && { line: part.line, endLine: part.endLine, fingerprint: textFingerprint(part.text) };
    }
    return { line: 1, endLine: source.split("\n").length, fingerprint: textFingerprint(source) };
  }
  let scope: Node = root;
  let symbol: FoundSymbol | undefined;
  if (ref.symbol) {
    symbol = symbolsOf(root).find((s) => s.name === ref.symbol);
    if (!symbol) return undefined;
    scope = symbol.node;
  }
  if (ref.marker) {
    const part = markedPart(scope, source, ref.marker);
    if (!part) return undefined;
    return { line: part.startPosition.row + 1, endLine: part.endPosition.row + 1, symbol: symbol?.name, fingerprint: fingerprint(part), node: part };
  }
  const node = symbol ? symbol.node : root;
  return { line: node.startPosition.row + 1, endLine: node.endPosition.row + 1, symbol: symbol?.name, fingerprint: fingerprint(node, symbol?.nameNode), node };
}

/** Tous les symboles d'un fichier, avec leur empreinte (recherche d'un symbole déplacé ou renommé). */
export function fingerprintsOf(path: string, source: string): { name: string; line: number; endLine: number; fingerprint: string }[] {
  const root = parseSource(path, source);
  if (!root) return [];
  return symbolsOf(root).map((s) => ({ name: s.name, line: s.node.startPosition.row + 1, endLine: s.node.endPosition.row + 1, fingerprint: fingerprint(s.node, s.nameNode) }));
}

export const hasMarker = (source: string, marker: string) => markerPattern(marker).test(source);

const GUARD = new Set(["if_statement", "throw_statement", "ternary_expression", "switch_statement"]);
const ERROR_PATH = new Set(["catch_clause", "throw_statement", "try_statement", "if_statement", "return_statement"]);

/**
 * Vérification structurelle propre au type : une règle ou un invariant est
 * appliqué par une condition, un refus ou un filtre ; une panne par un chemin
 * d'erreur ; une garantie par une interface ou un type. Elle ne prouve pas le
 * sens de la phrase : elle attrape un ancrage qui ne peut plus la porter.
 */
export function structuralCheck(type: ClaimType, node: Node | undefined): { check?: "ok" | "failed"; note?: string } {
  if (!node) return {};
  const has = (kinds: Set<string>, extra?: (n: Node) => boolean) => {
    let yes = kinds.has(node.type) || !!extra?.(node);
    const walk = (n: Node) => {
      for (const c of n.namedChildren) {
        if (yes) return;
        if (kinds.has(c.type) || extra?.(c)) yes = true;
        else walk(c);
      }
    };
    if (!yes) walk(node);
    return yes;
  };
  const filterCall = (n: Node) => n.type === "call_expression" && /\.(filter|where)$/.test(n.childForFieldName("function")?.text ?? "");
  switch (type) {
    case "rule":
    case "invariant":
      return has(GUARD, filterCall) ? { check: "ok" } : { check: "failed", note: "l'ancrage ne contient plus ni condition, ni refus, ni filtre" };
    case "failure":
      return has(ERROR_PATH) ? { check: "ok" } : { check: "failed", note: "l'ancrage ne contient plus de chemin d'erreur" };
    case "guarantee":
      return ["interface_declaration", "type_alias_declaration", "method_signature", "property_signature", "abstract_class_declaration"].includes(node.type) || has(new Set(["method_signature", "property_signature"]))
        ? { check: "ok" }
        : { check: "failed", note: "l'ancrage n'est plus une interface ni un type" };
    default:
      return {};
  }
}
