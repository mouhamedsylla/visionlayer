import type { Value } from "./datalog.js";
import { importBindings, literal, topLevelFunctions, walkAll, type Node } from "../arch/ast.js";
import type { FileFact } from "./types.js";

/**
 * Ce que la syntaxe dit d'un contrat (une interface et ses implémentations),
 * sans rien savoir d'un framework ni d'un fournisseur :
 *
 *   type_field(Fichier, Type, Champ, TypeÉcrit, req|opt, Commentaire, Ligne)
 *                                                 to: string; dans interface EmailMessage, avec le commentaire au-dessus
 *   iface_op(Fichier, Interface, Membre, Paramètre, Retour, Commentaire, Ligne)
 *                                                 send(message: EmailMessage): Promise<SendResult> → ("EmailMessage", "SendResult")
 *   class_call(Fichier, Classe, Méthode, Appel, Ligne)
 *                                                 this.client.emails.send(…) dans ResendSender.send ; aussi un nom importé
 *                                                 d'un paquet (nodemailer.createTransport) et console.log ; jamais this.méthode()
 *                                                 et fetch(…)
 *   class_self(Fichier, Classe, Méthode, Autre)   this.build(…) : une méthode de la classe qui en appelle une autre
 *   class_return(Fichier, Classe, Méthode, Ligne) un return de la méthode (hors fonctions imbriquées)
 *   selects_when(Fichier, Fonction, Classe, Valeur, Ligne)
 *                                                 case "smtp": sender = new SmtpSender(…) → "smtp" ; default → "" ;
 *                                                 if (x === "console") return new ConsoleSender() → "console" ;
 *                                                 hors de toute condition → "" (ce qui reste quand aucun cas n'a répondu)
 *   file_header(Fichier, Texte, Ligne)            le commentaire qui ouvre le fichier, avant la première instruction
 */

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const bare = (t: string) => clean(t.replace(/^:\s*/, "")).replace(/^Promise<(.+)>$/, "$1");

/** Le texte d'un ou plusieurs commentaires, sans les marques ni les filets. */
function commentText(parts: string[]): string {
  return clean(parts.join("\n").replace(/^\s*\/\*\*?|\*\/\s*$/gm, "").split("\n")
    .map((l) => l.replace(/^\s*(\*|\/\/)\s?/, "").trim()).filter((l) => l && !/^[-=*#─\s]+$/.test(l)).join(" "));
}

/** Un commentaire : la grammaire nomme parfois autrement ceux écrits dans le corps d'une interface. */
const isComment = (n: Node | null): n is Node => !!n && (n.type === "comment" || /^\/[/*]/.test(n.text));

/** Le commentaire juste au-dessus d'un nœud, ou en fin de sa ligne. */
function commentOf(n: Node): string {
  const parts: string[] = [];
  let row = n.startPosition.row;
  for (let p = n.previousNamedSibling; isComment(p) && row - p.endPosition.row <= 1; p = p.previousNamedSibling) {
    parts.unshift(p.text);
    row = p.startPosition.row;
  }
  if (parts.length) return commentText(parts);
  const next = n.nextNamedSibling;
  return isComment(next) && next.startPosition.row === n.endPosition.row ? commentText([next.text]) : "";
}

const isFn = (n: Node) => ["arrow_function", "function_expression", "function_declaration", "function", "method_definition"].includes(n.type);

/** La valeur qui mène à `n` : le `case "x"` qui le contient, `default` (""), ou le `if (… === "x")` dont il est la branche. */
function choiceOf(n: Node, fn: Node): string | undefined {
  for (let cur: Node | null = n, up = n.parent; up && up !== fn; cur = up, up = up.parent) {
    if (up.type === "switch_case") return literal(up.childForFieldName("value") ?? undefined);
    if (up.type === "switch_default") return "";
    if (up.type === "if_statement" && up.childForFieldName("consequence")?.startIndex === cur!.startIndex) {
      const m = up.childForFieldName("condition")?.text.match(/===?\s*["'`]([^"'`]+)["'`]|["'`]([^"'`]+)["'`]\s*===?/);
      return m ? m[1] ?? m[2] : undefined;
    }
    if (up.type === "else_clause") return "";
  }
  // hors de toute condition : ce qui reste quand aucun cas n'a répondu
  return "";
}

export function contractFacts(path: string, root: Node, fact: (rel: string, args: Value[], line: number) => FileFact): FileFact[] {
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const pkgs = new Set([...importBindings(root)].filter(([, b]) => !b.raw.startsWith(".") && !b.raw.startsWith("/")).map(([local]) => local));

  const header: string[] = [];
  for (const c of root.namedChildren) {
    if (c.type !== "comment") break;
    if (header.length && c.startPosition.row > root.namedChildren[header.length - 1]!.endPosition.row + 1) break;
    header.push(c.text);
  }
  const head = commentText(header);
  if (head) out.push(fact("file_header", [path, head, 1], 1));

  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    const name = decl?.childForFieldName("name")?.text;
    if (!decl || !name) continue;
    const body = decl.type === "interface_declaration" ? decl.childForFieldName("body")
      : decl.type === "type_alias_declaration" && decl.childForFieldName("value")?.type === "object_type" ? decl.childForFieldName("value") : null;
    for (const m of body?.namedChildren ?? []) {
      const member = m.childForFieldName("name")?.text;
      if (!member) continue;
      if (m.type === "property_signature") {
        const type = bare(m.childForFieldName("type")?.text ?? "");
        out.push(fact("type_field", [path, name, member, type, m.children.some((x) => x.type === "?") ? "opt" : "req", commentOf(m), line(m)], line(m)));
      } else if (m.type === "method_signature" && decl.type === "interface_declaration") {
        const param = m.childForFieldName("parameters")?.namedChildren[0]?.childForFieldName("type")?.text ?? "";
        out.push(fact("iface_op", [path, name, member, bare(param), bare(m.childForFieldName("return_type")?.text ?? ""), commentOf(m), line(m)], line(m)));
      }
    }
    if (decl.type !== "class_declaration") continue;
    const methods = (decl.childForFieldName("body")?.namedChildren ?? []).filter((m) => m.type === "method_definition");
    const own = new Set(methods.map((m) => m.childForFieldName("name")?.text));
    for (const m of methods) {
      const mName = m.childForFieldName("name")?.text ?? "";
      // les retours de la méthode elle-même ; les appels aussi dans ses fonctions imbriquées (withRetry(() => this.client.x()))
      const nested = (n: Node) => { for (let up = n.parent; up && up !== m; up = up.parent) if (isFn(up)) return true; return false; };
      walkAll(m, (n) => {
        if (n.type === "return_statement" && !nested(n)) out.push(fact("class_return", [path, name, mName, line(n)], line(n)));
        if (n.type !== "call_expression") return;
        const chain = n.childForFieldName("function")?.text.replace(/\s+/g, "") ?? "";
        const segs = chain.split(".");
        if (segs[0] === "this" && segs.length === 2 && own.has(segs[1])) out.push(fact("class_self", [path, name, mName, segs[1]!], line(n)));
        const native = chain === "fetch" || (segs[0] === "this" && segs.length >= 3 && !own.has(segs[1])) || (segs.length >= 2 && (pkgs.has(segs[0]!) || segs[0] === "console"));
        if (native && /^[\w$.]+$/.test(chain)) out.push(fact("class_call", [path, name, mName, chain, line(n)], line(n)));
      });
    }
  }

  for (const [fn, body] of topLevelFunctions(root)) {
    walkAll(body, (n) => {
      if (n.type !== "new_expression") return;
      const cls = n.childForFieldName("constructor");
      const value = cls?.type === "identifier" ? choiceOf(n, body) : undefined;
      if (cls && value !== undefined) out.push(fact("selects_when", [path, fn, cls.text, value, line(n)], line(n)));
    });
  }
  return out;
}
