import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { literal, walkAll, type Node } from "../arch/ast.js";

/**
 * Un serveur `http.createServer` route à la main
 * (https://nodejs.org/api/http.html#class-httpincomingmessage) : en comparant
 * `req.url` ou un `pathname` à un chemin, et `req.method` à une méthode.
 *
 *   if (req.method === "POST" && req.url === "/render")   → POST /render
 *   if (url.pathname === "/healthz")                       → ANY /healthz (méthode non écrite)
 *   switch (req.url) { case "/a": … }                      → ANY /a
 *
 * entrypoint(Fichier, http, "MÉTHODE /chemin", "", Ligne)
 */
const URL_SIDE = /(^|\.)(url|pathname|path)$/;
const METHOD_SIDE = /(^|\.)method$/;

const script: PackScript = ({ file, root, fact }) => {
  if (!root) return [];
  const out: FileFact[] = [];
  const seen = new Set<string>();
  const emit = (method: string | undefined, path: string, n: Node) => {
    const key = `${method ?? "ANY"} ${path.split("?")[0]}`;
    const line = n.startPosition.row + 1;
    if (seen.has(`${key}:${line}`)) return;
    seen.add(`${key}:${line}`);
    out.push(fact("entrypoint", [file.path, "http", key, "", line], line));
  };
  walkAll(root, (n) => {
    if (n.type === "binary_expression" && /^={2,3}$/.test(n.childForFieldName("operator")?.text ?? "")) {
      const c = compared(n, URL_SIDE);
      if (c?.startsWith("/")) emit(methodNear(n), c, n);
    }
    if (n.type === "switch_statement") {
      const disc = n.childForFieldName("value")?.text.replace(/^\(|\)$/g, "") ?? "";
      if (!URL_SIDE.test(disc)) return;
      walkAll(n, (c) => {
        if (c.type !== "switch_case") return;
        const v = literal(c.childForFieldName("value") ?? undefined);
        if (v?.startsWith("/")) emit(undefined, v, c);
      });
    }
  });
  return out;
};

/** La chaîne comparée à un côté dont le texte correspond à `side`. */
function compared(n: Node, side: RegExp): string | undefined {
  const l = n.childForFieldName("left");
  const r = n.childForFieldName("right");
  if (!l || !r) return undefined;
  const [lv, rv] = [literal(l), literal(r)];
  if (rv !== undefined && side.test(l.text)) return rv;
  if (lv !== undefined && side.test(r.text)) return lv;
  return undefined;
}

/** La méthode comparée dans la même condition `a && b`. */
function methodNear(n: Node): string | undefined {
  let top = n;
  while (top.parent?.type === "binary_expression" && top.parent.childForFieldName("operator")?.text === "&&") top = top.parent;
  let found: string | undefined;
  walkAll(top, (x) => {
    if (found || x.type !== "binary_expression") return;
    const m = compared(x, METHOD_SIDE);
    if (m && /^[A-Za-z]+$/.test(m)) found = m.toUpperCase();
  });
  return found;
}
export default script;
