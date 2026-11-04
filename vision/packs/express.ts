import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, isFunction, literal, returnedExpressions, topLevelFunctions, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * Express, d'après son inventaire (docs/fonctionnement/packs/express.md).
 * Le script ne décide pas qu'un objet est Express quand il vient d'un autre
 * fichier : il émet ce qu'il voit, les règles du pack joignent.
 *
 * express_obj(Fichier, Nom, app|router, Ligne)        const app = express() ; Router() ; export default router
 * http_on(Fichier, Objet, MÉTHODE, Chemin, Code, LigneCode, Ligne)
 *                                                     obj.get("/x", …, h), obj.route("/x").get(h), plusieurs chemins
 * handler_member(Fichier, Objet, MÉTHODE, Chemin, Module, Membre)
 *                                                     le code est `orders.list` : membre d'un module importé
 * route_mw(Fichier, Objet, MÉTHODE, Chemin, Intermédiaire, Ligne)
 * mount_on(Fichier, Parent, Préfixe, Nom, Ligne)      parent.use("/api", nom) : un routeur, une sous-app ou un intermédiaire
 * static_on(Fichier, Objet, Préfixe, Ligne)           obj.use("/static", express.static("public"))
 * use_covers(Fichier, Objet, MÉTHODE, Chemin, Intermédiaire, Ligne)
 *                                                     obj.use([préfixe], mw) placé avant la route, dont le préfixe couvre son chemin
 * ex_returns(Fichier, Fonction, Nom)                 une fonction de premier niveau qui rend un objet : `return router` (un routeur fabriqué)
 * ex_call_bind(Fichier, Nom, Fonction)               const nom = fonction(…) : la valeur d'un appel, gardée dans une variable
 * admin_word(Fichier, Chemin)                         un chemin ou un préfixe dont un morceau commence par « admin »
 * first_status(Fichier, LigneFonction, 401|403)       le premier statut que répond la fonction : elle garde ce qu'elle fait ensuite
 * status_in(Fichier, LigneFonction, 401|403)          une fonction qui répond 401 ou 403 : throw new HttpError(403), res.status(403)…
 * calls_in(Fichier, LigneFonction, Appelé, Ligne)     une fonction (de premier niveau, ou écrite en argument) qui appelle `Appelé(…)`
 */
const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "all",
  "checkout", "copy", "lock", "merge", "mkactivity", "mkcol", "move", "m-search", "notify", "purge", "report", "search", "subscribe", "trace", "unlock", "unsubscribe"]);

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const fromExpress = (id: string) => { const b = imports.get(id); return b !== undefined && packageName(b.raw) === "express"; };
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const fileImportsExpress = [...imports.values()].some((b) => packageName(b.raw) === "express");

  /** express(), express.Router(), Router() : app ou router ; undefined sinon. */
  const kindOf = (n: Node | undefined): "app" | "router" | undefined => {
    const v = unwrap(n);
    if (v?.type !== "call_expression") return undefined;
    const fn = v.childForFieldName("function");
    if (fn?.type === "identifier" && fromExpress(fn.text)) return imports.get(fn.text)!.imported === "Router" ? "router" : "app";
    if (fn?.type === "member_expression" && fn.childForFieldName("property")?.text === "Router") {
      const obj = fn.childForFieldName("object");
      return obj?.type === "identifier" && fromExpress(obj.text) ? "router" : undefined;
    }
    return undefined;
  };

  if (fileImportsExpress) {
    walkAll(root, (n) => {
      if (n.type === "variable_declarator") {
        const name = n.childForFieldName("name");
        const k = kindOf(n.childForFieldName("value") ?? undefined);
        if (name?.type === "identifier" && k) out.push(fact("express_obj", [file.path, name.text, k, line(n)], line(n)));
      }
      if (n.type === "export_statement" && n.text.startsWith("export default")) {
        const v = n.namedChildren.at(-1);
        const k = kindOf(v);
        if (k) out.push(fact("express_obj", [file.path, "default", k, line(n)], line(n)));
      }
    });
  }
  // Un routeur fabriqué par une fonction : `export const createRouter = (c) => { const router = Router(); …; return router; }`.
  if (fileImportsExpress) for (const [name, fn] of topLevelFunctions(root)) {
    for (const r of returnedExpressions(fn)) {
      const v = unwrap(r);
      if (v?.type === "identifier") out.push(fact("ex_returns", [file.path, name, v.text], line(v)));
    }
  }
  // const archivedEmailRouter = createArchivedEmailRouter(…) : la variable vaut ce que rend la fonction.
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (decl?.type !== "lexical_declaration" && decl?.type !== "variable_declaration") continue;
    for (const d of decl.namedChildren) {
      const name = d.childForFieldName("name"), value = unwrap(d.childForFieldName("value") ?? undefined);
      const callee = value?.type === "call_expression" ? value.childForFieldName("function") : undefined;
      if (name?.type === "identifier" && callee?.type === "identifier") out.push(fact("ex_call_bind", [file.path, name.text, callee.text], line(d)));
    }
  }

  // export default router : le nom par défaut désigne le même objet.
  for (const stmt of root.namedChildren) {
    if (stmt.type !== "export_statement" || !stmt.text.startsWith("export default")) continue;
    const v = stmt.namedChildren.at(-1);
    if (v?.type === "identifier") out.push(fact("export_default", [file.path, v.text], line(stmt)));
  }

  const uses: { obj: string; prefix: string; mw: string; line: number }[] = [];
  const routes: { obj: string; method: string; path: string; line: number }[] = [];
  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression") return;
    const method = fn.childForFieldName("property")?.text ?? "";
    const a = args(n);

    // obj.use([préfixe], a, b, …)
    if (method === "use") {
      const obj = rootIdent(fn.childForFieldName("object"));
      if (!obj) return;
      const paths = pathsOf(a[0]);
      const prefix = paths ? paths : [""];
      for (const arg of paths ? a.slice(1) : a) {
        const x = unwrap(arg);
        if (!x) continue;
        if (x.type === "identifier") for (const p of prefix) out.push(fact("mount_on", [file.path, obj, p, x.text, line(n)], line(n)));
        // Un intermédiaire fabriqué sur place : requireRole("admin").
        const made = x.type === "call_expression" ? x.childForFieldName("function") : undefined;
        if (made?.type === "identifier") for (const p of prefix) out.push(fact("mount_on", [file.path, obj, p, made.text, line(n)], line(n)));
        if (x.type === "identifier" || made?.type === "identifier") for (const p of prefix) uses.push({ obj, prefix: p, mw: x.type === "identifier" ? x.text : made!.text, line: line(n) });
        for (const p of prefix) if (isAdmin(p)) out.push(fact("admin_word", [file.path, p], line(n)));
        if (x.type === "call_expression" && x.childForFieldName("function")?.text.endsWith(".static")) {
          const root0 = x.childForFieldName("function")?.childForFieldName("object");
          if (root0?.type === "identifier" && fromExpress(root0.text)) for (const p of prefix) out.push(fact("static_on", [file.path, obj, p, line(n)], line(n)));
        }
      }
      return;
    }
    if (!METHODS.has(method)) return;
    const object = fn.childForFieldName("object");
    // obj.route("/x").get(h).post(h2) : le chemin est sur l'appel route() de la chaîne.
    let paths: string[] | undefined;
    let obj: string | undefined;
    let rest = a;
    const routeCall = routeOf(object);
    if (routeCall) {
      paths = pathsOf(args(routeCall)[0]);
      obj = rootIdent(routeCall.childForFieldName("function")?.childForFieldName("object"));
    } else {
      paths = pathsOf(a[0]);
      obj = object?.type === "identifier" ? object.text : undefined;
      rest = a.slice(1);
    }
    if (!paths || !obj || rest.length === 0) return;
    const M = method === "all" ? "ANY" : method.toUpperCase();
    const handler = rest.at(-1)!;
    const target = innermost(handler);
    const sym = target.type === "identifier" || target.type === "member_expression" ? target.text : "";
    const hline = line(target);
    const mws = rest.slice(0, -1).flatMap((m) => { const x = unwrap(m); return x?.type === "array" ? x.namedChildren : x ? [x] : []; });
    for (const p of paths) {
      out.push(fact("http_on", [file.path, obj, M, p, sym, hline, line(n)], line(n)));
      if (ENTRANCE.test(p)) out.push(fact("entrance_route", [file.path, line(n)], line(n)));
      if (target.type === "member_expression") {
        const o = target.childForFieldName("object");
        const prop = target.childForFieldName("property")?.text;
        if (o?.type === "identifier" && prop) out.push(fact("handler_member", [file.path, obj, M, p, o.text, prop], line(n)));
      }
      for (const m of mws) {
        const x = unwrap(m);
        const made = x?.type === "call_expression" ? x.childForFieldName("function") : undefined;
        const name = made?.type === "identifier" ? made : innermost(m);
        if (name.type === "identifier") out.push(fact("route_mw", [file.path, obj, M, p, name.text, line(m)], line(n)));
      }
      routes.push({ obj, method: M, path: p, line: line(n) });
      if (isAdmin(p)) out.push(fact("admin_word", [file.path, p], line(n)));
    }
  });

  // Un intermédiaire posé avant une route du même objet, sous un préfixe qui couvre son chemin.
  const covers = (pre: string, path: string) => pre === "" || pre === "/" || path === pre || path.startsWith(pre.endsWith("/") ? pre : `${pre}/`);
  for (const r of routes) for (const u of uses) {
    if (u.obj === r.obj && u.line < r.line && covers(u.prefix, r.path)) out.push(fact("use_covers", [file.path, r.obj, r.method, r.path, u.mw, u.line], r.line));
  }

  // Les fonctions : ce qu'elles appellent, et si elles répondent 401 ou 403.
  const fnBodies: [number, Node][] = [];
  for (const [, decl] of topLevelFunctions(root)) fnBodies.push([line(decl), decl]);
  walkAll(root, (n) => { if (isFunction(n) && n.parent?.type === "arguments") fnBodies.push([line(n), n]); });
  for (const [at, body] of fnBodies) {
    const seen = new Set<string>();
    // Le premier statut qu'elle répond : un 401 ou un 403 écrit d'abord est une garde ; après une validation (400), un refus de connexion.
    let first: Node | undefined;
    walkAll(body, (x) => { if (x.type === "number" && /^[1-5]\d\d$/.test(x.text) && x.parent?.type === "arguments" && (!first || x.startIndex < first.startIndex)) first = x; });
    // Un 403 ne garde une identité que si la fonction parle d'elle : un jeton anti-CSRF ou une limite refusent une requête, pas une personne.
    const aboutWho = IDENTITY.test(body.text);
    if (first && (first.text === "401" || (first.text === "403" && aboutWho))) out.push(fact("first_status", [file.path, at, first.text], line(first)));
    walkAll(body, (x) => {
      if (x.type === "call_expression") {
        const f = x.childForFieldName("function");
        if (f?.type === "identifier" && !seen.has(f.text)) { seen.add(f.text); out.push(fact("calls_in", [file.path, at, f.text, line(x)], line(x))); }
      }
      if (x.type === "number" && (x.text === "401" || x.text === "403") && (x.text === "401" || aboutWho) && (x.parent?.type === "arguments" || x.parent?.type === "assignment_expression") && !seen.has(x.text)) {
        seen.add(x.text);
        out.push(fact("status_in", [file.path, at, x.text], line(x)));
      }
    });
  }
  return out;
};

/** Ce qui dit qu'une fonction juge une personne : son compte, sa session, son rôle, ses droits. */
const IDENTITY = /user|session|role|permission|admin|account|owner|\bauth|scope|tenant/i;

/** Une route dont le chemin dit qu'elle est l'entrée : on y arrive sans être connecté. */
const ENTRANCE = /(^|\/)[^/]*(login|signin|sign-in|signup|sign-up|register|token|oauth|callback|reset)[^/]*(\/|$)/i;

/** Un morceau du chemin commence par « admin » : /admin, /admin-api, /api/administration. */
function isAdmin(path: string): boolean {
  return path.split("/").some((s) => /^admin/i.test(s));
}

/** L'appel `x.route("/p")` au bout d'une chaîne `x.route("/p").get(h).post(h)`. */
function routeOf(object: Node | null | undefined): Node | undefined {
  let cur = unwrap(object);
  for (let i = 0; cur && i < 12; i++) {
    if (cur.type !== "call_expression") return undefined;
    const fn = cur.childForFieldName("function");
    if (fn?.type !== "member_expression") return undefined;
    if (fn.childForFieldName("property")?.text === "route") return cur;
    cur = unwrap(fn.childForFieldName("object"));
  }
  return undefined;
}

function rootIdent(n: Node | null | undefined): string | undefined {
  const x = unwrap(n);
  return x?.type === "identifier" ? x.text : undefined;
}

/** "/x", ["/a", "/b"], /regex/ : les chemins ; undefined si ce n'est pas un chemin. */
function pathsOf(n: Node | undefined): string[] | undefined {
  const x = unwrap(n);
  if (!x) return undefined;
  const lit = literal(x);
  if (lit !== undefined) return lit.startsWith("/") || lit === "*" ? [lit] : undefined;
  if (x.type === "regex") return [x.text];
  // `/${config.api.version}/auth` : le morceau calculé reste écrit entre accolades, le préfixe n'est pas perdu.
  if (x.type === "template_string") {
    const text = x.namedChildren.length
      ? x.text.slice(1, -1).replace(/\$\{\s*([^}]*?)\s*\}/g, "{$1}")
      : x.text.slice(1, -1);
    return text.startsWith("/") ? [text] : undefined;
  }
  if (x.type === "array") {
    const all = x.namedChildren.map((c) => pathsOf(c));
    return all.every((p) => p) ? all.flat() as string[] : undefined;
  }
  return undefined;
}

/** Ce qu'une enveloppe appelle : `route(h)` → `h`, `asyncHandler(async () => …)` → la fonction. */
function innermost(n: Node): Node {
  let cur = unwrap(n) ?? n;
  for (let i = 0; i < 5 && cur.type === "call_expression"; i++) {
    const last = cur.childForFieldName("arguments")?.namedChildren.at(-1);
    if (!last) break;
    cur = unwrap(last) ?? last;
  }
  return cur;
}
export default script;
