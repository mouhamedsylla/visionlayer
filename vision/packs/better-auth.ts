import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * Better Auth, d'après son inventaire (docs/fonctionnement/packs/better-auth.md). Better Auth écrit lui-même ses
 * tables (user, session, account, verification) derrière un seul gestionnaire monté sur une route ; le code du projet
 * ne les écrit pas. Ce pack rend ces écritures à la ligne où le gestionnaire est monté.
 *
 * ba_auth(Fichier, Variable)                      const auth = betterAuth({ … })
 * ba_model(Fichier, Modèle, Entité)               le nom de chaque table : user, ou user: { modelName: "users" }
 * ba_field(Fichier, Modèle, Champ, Valeur)        un champ que Better Auth écrit ; Valeur : la valeur par défaut écrite, "" sinon
 * ba_drop(Fichier, Modèle)                        une table dont Better Auth supprime des lignes
 * ba_mount(Fichier, Variable, Ligne)              toNextJsHandler(auth), toNodeHandler(auth), auth.handler
 * ba_get_session(Fichier, Variable, Ligne)        auth.api.getSession({ headers })
 */

/** Les champs du schéma de base, et ceux qu'ajoute le plugin admin (documentation de Better Auth). */
const CORE: Record<string, string[]> = {
  user: ["name", "email", "emailVerified", "image", "createdAt", "updatedAt"],
  session: ["userId", "token", "expiresAt", "ipAddress", "userAgent", "createdAt", "updatedAt"],
  account: ["userId", "accountId", "providerId", "accessToken", "refreshToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "idToken", "password", "createdAt", "updatedAt"],
  verification: ["identifier", "value", "expiresAt", "createdAt", "updatedAt"],
};
const ADMIN: Record<string, string[]> = { user: ["role", "banned", "banReason", "banExpires"], session: ["impersonatedBy"] };
/** Déconnexion, révocation, jeton consommé ; le plugin admin supprime aussi un utilisateur. */
const DROPS = ["session", "verification"];
const MOUNTS: Record<string, string> = { toNextJsHandler: "better-auth/next-js", toNodeHandler: "better-auth/node", toSvelteKitHandler: "better-auth/svelte-kit", toSolidStartHandler: "better-auth/solid-start" };

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function pair(o: Node | undefined, key: string): Node | undefined {
  const n = unwrap(o);
  if (n?.type !== "object") return undefined;
  for (const p of n.namedChildren) if (p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === key) return unwrap(p.childForFieldName("value") ?? undefined);
  return undefined;
}

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const from = (id: string) => { const b = imports.get(id); return b ? { pkg: b.raw, name: b.imported } : undefined; };

  walkAll(root, (n) => {
    if (n.type === "call_expression") {
      const fn = unwrap(n.childForFieldName("function"));
      // betterAuth({ … }) : la configuration.
      if (fn?.type === "identifier" && from(fn.text)?.pkg === "better-auth" && from(fn.text)?.name === "betterAuth") {
        const decl = n.parent?.type === "variable_declarator" ? n.parent.childForFieldName("name") : undefined;
        if (decl?.type === "identifier") out.push(fact("ba_auth", [file.path, decl.text], line(n)));
        const conf = args(n)[0];
        const admin = (pair(conf, "plugins")?.namedChildren ?? []).find((p) => {
          const c = unwrap(p);
          const f = c?.type === "call_expression" ? unwrap(c.childForFieldName("function")) : undefined;
          return f?.type === "identifier" && from(f.text)?.name === "admin" && packageName(from(f.text)!.pkg) === "better-auth";
        });
        const adminConf = admin ? args(unwrap(admin)!)[0] : undefined;
        for (const model of Object.keys(CORE)) {
          const own = pair(conf, model);
          const name = literal(pair(own, "modelName")) ?? model;
          out.push(fact("ba_model", [file.path, model, name], line(n)));
          const fields = [...CORE[model]!, ...(admin ? ADMIN[model] ?? [] : [])];
          // Les champs ajoutés : user: { additionalFields: { phone: { type: "string", defaultValue: "x" } } }.
          const extra = pair(own, "additionalFields");
          const defaults = new Map<string, string>();
          if (extra?.type === "object") for (const p of extra.namedChildren) {
            const k = p.type === "pair" ? p.childForFieldName("key")?.text.replace(/['"]/g, "") : undefined;
            if (!k) continue;
            fields.push(k);
            const d = literal(pair(p.childForFieldName("value") ?? undefined, "defaultValue"));
            if (d !== undefined) defaults.set(k, d);
          }
          const role = model === "user" && admin ? literal(pair(adminConf, "defaultRole")) ?? "user" : undefined;
          if (role !== undefined) defaults.set("role", role);
          // Un champ renommé : user: { fields: { email: "email_address" } }.
          const renamed = pair(own, "fields");
          for (const f of new Set(fields)) {
            const to = literal(pair(renamed, f));
            for (const c of new Set([to ?? f, snake(to ?? f)])) out.push(fact("ba_field", [file.path, model, c, defaults.get(f) ?? ""], line(n)));
          }
        }
        for (const m of [...DROPS, ...(admin ? ["user"] : [])]) out.push(fact("ba_drop", [file.path, m], line(n)));
        return;
      }
      // toNextJsHandler(auth), toNodeHandler(auth) : le gestionnaire monté.
      if (fn?.type === "identifier" && MOUNTS[from(fn.text)?.name ?? ""] === from(fn.text)?.pkg) {
        const a = unwrap(args(n)[0]);
        const v = a?.type === "member_expression" ? unwrap(a.childForFieldName("object")) : a;
        if (v?.type === "identifier") out.push(fact("ba_mount", [file.path, v.text, line(n)], line(n)));
        return;
      }
      // auth.api.getSession({ headers }).
      if (fn?.type === "member_expression" && fn.childForFieldName("property")?.text === "getSession") {
        const api = unwrap(fn.childForFieldName("object"));
        const v = api?.type === "member_expression" && api.childForFieldName("property")?.text === "api" ? unwrap(api.childForFieldName("object")) : undefined;
        if (v?.type === "identifier") out.push(fact("ba_get_session", [file.path, v.text, line(n)], line(n)));
      }
    }
    // auth.handler passé tel quel : app.all("/api/auth/*", auth.handler).
    if (n.type === "member_expression" && n.childForFieldName("property")?.text === "handler" && n.parent?.type === "arguments") {
      const v = unwrap(n.childForFieldName("object"));
      if (v?.type === "identifier") out.push(fact("ba_mount", [file.path, v.text, line(n)], line(n)));
    }
  });
  return out;
};

export default script;
