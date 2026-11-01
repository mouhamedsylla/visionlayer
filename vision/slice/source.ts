import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type Parser from "tree-sitter";
import { parse } from "../parsers/parser.js";
import type { Language } from "../model/types.js";
import type { Database } from "../facts/datalog.js";

/**
 * Où un nom est déclaré, et qui l'appelle : ce qu'un agent cherche avec `grep` (ADR 0013, contexte des agents).
 * Les déclarations viennent de l'arbre syntaxique de chaque fichier de code suivi par git : fonctions, classes
 * et leurs méthodes, constantes, interfaces et types. Les appels viennent de la base de faits (`fn_calls`,
 * `member_call`). Un nom écrit seulement comme propriété d'objet ou variable locale n'est pas indexé, et
 * la réponse le dit.
 */
export interface Declaration { name: string; kind: string; path: string; line: number; end: number; owner?: string }

const LANG: Record<string, Language> = { ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".tsx": "tsx", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".jsx": "jsx" };

/** Les déclarations d'un dépôt, gardées par fichier tant que le fichier ne change pas. */
export class DeclarationIndex {
  private readonly cache = new Map<string, { mtime: number; decls: Declaration[] }>();

  constructor(readonly root: string) {}

  /** `deleteArchivedEmail`, `ArchivedEmailService.deleteArchivedEmail`, `ArchivedEmailService`. */
  find(name: string): Declaration[] {
    const dot = name.lastIndexOf(".");
    if (dot < 0) return this.all().filter((d) => d.name === name);
    const [owner, member] = [name.slice(0, dot), name.slice(dot + 1)];
    return this.all().filter((d) => d.name === member && d.owner === owner);
  }

  private all(): Declaration[] {
    const out: Declaration[] = [];
    for (const path of codeFiles(this.root)) {
      const full = join(this.root, path);
      let mtime: number;
      try { mtime = statSync(full).mtimeMs; } catch { continue; }
      const hit = this.cache.get(path);
      if (hit && hit.mtime === mtime) { out.push(...hit.decls); continue; }
      let decls: Declaration[] = [];
      try { decls = declarations(path, readFileSync(full, "utf8")); } catch { /* fichier illisible : rien */ }
      this.cache.set(path, { mtime, decls });
      out.push(...decls);
    }
    return out;
  }
}

export function declarations(path: string, source: string): Declaration[] {
  const ext = path.slice(path.lastIndexOf("."));
  const lang = LANG[ext];
  if (!lang || path.endsWith(".d.ts")) return [];
  const out: Declaration[] = [];
  const add = (name: string | undefined, kind: string, n: Parser.SyntaxNode, owner?: string) => {
    if (name) out.push({ name, kind, path, line: n.startPosition.row + 1, end: n.endPosition.row + 1, ...(owner ? { owner } : {}) });
  };
  const walk = (n: Parser.SyntaxNode, owner?: string) => {
    switch (n.type) {
      case "function_declaration": case "generator_function_declaration":
        add(n.childForFieldName("name")?.text, "function", n); break;
      case "class_declaration": case "abstract_class_declaration": {
        const name = n.childForFieldName("name")?.text;
        add(name, "class", n);
        for (const c of n.childForFieldName("body")?.namedChildren ?? []) walk(c, name);
        return;
      }
      case "method_definition": case "abstract_method_signature":
        add(n.childForFieldName("name")?.text, "method", n, owner); return;
      case "public_field_definition": case "field_definition": {
        const value = n.childForFieldName("value");
        if (value && /function|arrow_function/.test(value.type)) add(n.childForFieldName("name")?.text ?? n.childForFieldName("property")?.text, "method", n, owner);
        return;
      }
      case "variable_declarator": {
        const value = n.childForFieldName("value");
        const kind = value && /function|arrow_function/.test(value.type) ? "function" : "constant";
        // Une variable locale n'est pas une déclaration qu'on cherche : seulement celles du premier niveau.
        if (isTopLevel(n)) add(n.childForFieldName("name")?.text, kind, n);
        return;
      }
      case "interface_declaration": add(n.childForFieldName("name")?.text, "interface", n); return;
      case "type_alias_declaration": add(n.childForFieldName("name")?.text, "type", n); return;
      case "enum_declaration": add(n.childForFieldName("name")?.text, "enum", n); return;
    }
    for (const c of n.namedChildren) walk(c, owner);
  };
  walk(parse(source, lang).rootNode);
  return out;
}

function isTopLevel(n: Parser.SyntaxNode): boolean {
  let p = n.parent;
  while (p && (p.type === "lexical_declaration" || p.type === "variable_declaration" || p.type === "export_statement")) p = p.parent;
  return p?.type === "program";
}

function codeFiles(root: string): string[] {
  try {
    return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })
      .split("\n").filter((f) => f && LANG[f.slice(f.lastIndexOf("."))] && !f.includes("node_modules/"));
  } catch {
    // Pas un dépôt git : tout le dossier, sans node_modules ni dossiers cachés.
    const out: string[] = [];
    const walk = (rel: string) => {
      for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(p); }
        else if (LANG[e.name.slice(e.name.lastIndexOf("."))]) out.push(p);
      }
    };
    try { walk(""); } catch { /* dossier illisible */ }
    return out.sort();
  }
}

/** La réponse de `vision_source` : les déclarations du nom, puis chaque endroit qui l'appelle. */
export function formatSource(name: string, decls: Declaration[], db: Database): string {
  const member = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  const out = [`SOURCE ${name}`];
  if (!decls.length) {
    out.push("  aucune déclaration de ce nom dans le code suivi par git (fonctions, classes et méthodes, constantes de premier niveau, interfaces, types) : une propriété d'objet ou une variable locale n'est pas indexée");
  }
  for (const d of decls) out.push(`  déclaré : ${d.kind} ${d.owner ? `${d.owner}.` : ""}${d.name}  ${d.path}:${d.line}-${d.end}`);
  const calls = new Set<string>();
  for (const t of db.get("fn_calls")) if (String(t.args[2]) === member) calls.add(`${t.args[0]}:${t.args[3]}  ${member}(…)`);
  for (const t of db.get("member_call")) {
    const path = String(t.args[2]);
    if (path === member || path.endsWith(`.${member}`)) calls.add(`${t.args[0]}:${t.args[3]}  ${t.args[1]}.${path}(…)`);
  }
  const sorted = [...calls].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  out.push(sorted.length ? `  appelé à ${sorted.length} endroit${sorted.length > 1 ? "s" : ""} :` : "  aucun appel lu (un appel par une valeur calculée, ou dans un fichier non lu, n'est pas vu)");
  for (const c of sorted) out.push(`    ${c}`);
  return out.join("\n");
}
