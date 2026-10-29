import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, isFunction, literal, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * Journaux, d'après l'inventaire (docs/fonctionnement/packs/logs.md). Le script relève ce que le langage
 * dit ; les règles décident ce qui est un journal (log_maker) et ce qui fait un constat.
 *
 * log_make(Fichier, Variable, Paquet, Chemin, Ligne)   const logger = pino() → "default" ; winston.createLogger() → "createLogger"
 * log_redact(Fichier, Variable)                        pino({ redact: […] }) : ce journal masque des champs
 * log_derive(Fichier, Variable, Depuis)                const log = logger.child({ … })
 * log_req_body(Fichier, Journal, LigneFonction, Ligne)   logger.info({ body: req.body }) : req, premier paramètre de la fonction
 * log_personal(Fichier, Journal, Nom, Ligne)           logger.info({ email }), console.log(user.phone)
 */
const LEVELS = new Set(["log", "trace", "debug", "info", "warn", "error", "fatal"]);
const PERSONAL = new Set(["email", "mail", "password", "passwd", "phone", "telephone", "address", "birthdate", "birthday", "ssn", "iban"]);

/** Un nom dont un des mots désigne une donnée personnelle : userEmail, phone_number, passwordHash. */
export function personal(name: string): boolean {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_-]+/).some((w) => PERSONAL.has(w.toLowerCase()));
}

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  /** Ce qu'une expression crée avec un paquet : `pino()`, `winston.createLogger()`, `require("pino")()`. */
  const creation = (n: Node | undefined): { pkg: string; path: string; args: Node[] } | undefined => {
    const x = unwrap(n);
    if (x?.type !== "call_expression") return undefined;
    const fn = unwrap(x.childForFieldName("function"));
    if (fn?.type === "call_expression" && fn.childForFieldName("function")?.text === "require") {
      const raw = literal(args(fn)[0]);
      return raw && !/^[./]/.test(raw) ? { pkg: packageName(raw) ?? raw, path: "default", args: args(x) } : undefined;
    }
    const members: string[] = [];
    let cur = fn;
    while (cur?.type === "member_expression") { members.unshift(cur.childForFieldName("property")?.text ?? ""); cur = unwrap(cur.childForFieldName("object")); }
    if (cur?.type !== "identifier") return undefined;
    const b = imports.get(cur.text);
    if (!b || /^[./]/.test(b.raw)) return undefined;
    const path = [b.imported === "*" || b.imported === "default" ? "" : b.imported, ...members].filter(Boolean).join(".");
    return { pkg: packageName(b.raw) ?? b.raw, path: path || "default", args: args(x) };
  };

  /** Le dernier nom d'une variable ou d'un membre : user.email → email. */
  const lastName = (n: Node | undefined): string | undefined => {
    const x = unwrap(n);
    if (x?.type === "identifier" || x?.type === "shorthand_property_identifier") return x.text;
    if (x?.type === "member_expression") return x.childForFieldName("property")?.text;
    return undefined;
  };

  walkAll(root, (n) => {
    if (n.type === "variable_declarator") {
      const v = n.childForFieldName("name");
      if (v?.type !== "identifier") return;
      const c = creation(n.childForFieldName("value") ?? undefined);
      if (c) {
        out.push(fact("log_make", [file.path, v.text, c.pkg, c.path, line(n)], line(n)));
        const opts = unwrap(c.args[0]);
        if (opts?.type === "object" && opts.namedChildren.some((p) => p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === "redact")) out.push(fact("log_redact", [file.path, v.text], line(n)));
      }
      const x = unwrap(n.childForFieldName("value"));
      const f = x?.type === "call_expression" ? x.childForFieldName("function") : undefined;
      const o = f?.type === "member_expression" ? unwrap(f.childForFieldName("object")) : undefined;
      if (o?.type === "identifier" && f!.childForFieldName("property")?.text === "child") out.push(fact("log_derive", [file.path, v.text, o.text], line(n)));
      return;
    }
    if (n.type !== "call_expression") return;
    const f = n.childForFieldName("function");
    if (f?.type !== "member_expression" || !LEVELS.has(f.childForFieldName("property")?.text ?? "")) return;
    const recv = unwrap(f.childForFieldName("object"));
    if (recv?.type !== "identifier") return;

    // Ce qui est écrit : chaque argument, les clés et valeurs d'un objet, les morceaux d'un gabarit.
    let fn: Node | null = n.parent;
    while (fn && !isFunction(fn)) fn = fn.parent;
    const first = fn?.childForFieldName("parameters")?.namedChildren[0] ?? fn?.childForFieldName("parameter");
    const req = first ? (first.childForFieldName("pattern") ?? first).text : undefined;
    const values: Node[] = [];
    const names: string[] = [];
    for (const a of args(n)) {
      const x = unwrap(a);
      if (x?.type === "object") {
        for (const p of x.namedChildren) {
          if (p.type === "shorthand_property_identifier") { names.push(p.text); continue; }
          if (p.type !== "pair") continue;
          const key = p.childForFieldName("key")?.text.replace(/['"]/g, "");
          if (key) names.push(key);
          const v = p.childForFieldName("value");
          if (v) values.push(v);
        }
      } else if (x?.type === "template_string") {
        for (const c of x.namedChildren) if (c.type === "template_substitution" && c.namedChildren[0]) values.push(c.namedChildren[0]);
      } else if (x) values.push(x);
    }
    for (const v of values) { const nm = lastName(v); if (nm) names.push(nm); }
    const isBody = (v: Node) => { const x = unwrap(v); return x?.type === "member_expression" && x.childForFieldName("property")?.text === "body" && unwrap(x.childForFieldName("object"))?.text === req; };
    if (fn && req && values.some(isBody)) out.push(fact("log_req_body", [file.path, recv.text, line(fn), line(n)], line(n)));
    const p = names.find((nm) => nm !== "body" && personal(nm));
    if (p) out.push(fact("log_personal", [file.path, recv.text, p, line(n)], line(n)));
  });
  return out;
};
export default script;
