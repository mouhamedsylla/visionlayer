import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, callee, literal, resolveIdentifier, returnedExpressions, templateParts, topLevelFunctions, unwrap, walkAll, type Node } from "../arch/ast.js";
import { collectionOf } from "./firestore-path.js";

/**
 * Lectures et écritures Firestore, d'après les deux API documentées
 * (https://firebase.google.com/docs/firestore/query-data/get-data) :
 *
 *   modulaire (web)   getDoc(doc(db, "users", id)), setDoc, updateDoc, addDoc, deleteDoc,
 *                     getDocs(query(collection(db, "x"), where(…))), onSnapshot,
 *                     runTransaction(db, tx => tx.get(ref)), writeBatch(db).set(ref, …)
 *   Admin / Node      db.collection("x").doc(id).get(), .set(), .update(), .add(), .create(),
 *                     .delete(), .where(…).get(), collectionGroup("x"), tx.get(ref), batch.set(ref, …)
 *
 * Le chemin est suivi à travers les variables, les ternaires, les gabarits et
 * les fonctions du fichier qui le renvoient. Une fonction d'un autre fichier
 * est jointe par les règles du pack.
 *
 * fs_access(Fichier, read|write, Collection, Ligne)   un accès dont la collection est connue ici
 * fs_ref_op(Fichier, read|write, Nom, Ligne)          un accès (`getDoc(x)`) sur un chemin fabriqué par `Nom`, importé
 * fs_ref_maybe(Fichier, read|write, Nom, Ligne)       le même sous forme de méthode (`x.get()`) : un accès si `Nom` fabrique un chemin
 * fs_path_fn(Fichier, Nom, Collection)                une fonction ou une constante qui fabrique ce chemin
 * fs_rooted(Fichier, read|write, Collection, Nom, Ligne)  un accès sur `Nom(…).collection(…)` : vrai si `Nom` fabrique la base
 * fs_path_fn_rooted(Fichier, Nom, Collection, Base)    une fonction qui fabrique un chemin sur la base `Base` importée
 * fs_db(Fichier, Nom)                                  une fonction ou une constante qui fabrique la base de données
 * fs_unresolved(Fichier, Ligne)                       un accès dont le chemin n'est pas écrit dans le code
 */
const READ_FN = new Set(["getDoc", "getDocs", "getDocFromServer", "getDocsFromServer", "getDocFromCache", "getDocsFromCache", "getCountFromServer", "getAggregateFromServer", "onSnapshot"]);
const WRITE_FN = new Set(["setDoc", "updateDoc", "addDoc", "deleteDoc"]);
const QUERY_METHODS = new Set(["where", "orderBy", "limit", "limitToLast", "startAt", "startAfter", "endAt", "endBefore", "select", "offset", "withConverter"]);
const READ_METHODS = new Set(["get", "onSnapshot", "listDocuments", "count", "stream", "getAll"]);
const WRITE_METHODS = new Set(["set", "update", "add", "create", "delete"]);

/**
 * Des segments ; ou un nom importé d'un autre fichier, valeur (`usersCol`) ou
 * fonction appelée (`txCol(uid)`) ; ou des segments posés sur un nom importé
 * (`getDb().collection("users")`) : ce sont les règles qui disent si ce nom
 * fabrique la base de données.
 */
type Path = string[] | { ref: string; call: boolean } | { rooted: string[]; via: string };
const isSegs = (p: Path | undefined): p is string[] => Array.isArray(p);

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const functions = topLevelFunctions(root);
  const memo = new Map<string, Path | null>();
  // Un nom importé d'un autre fichier du dépôt ; les règles décident s'il fabrique un chemin.
  const importedName = (n: string) => {
    const b = imports.get(n);
    return b !== undefined && (/^[./]/.test(b.raw) || isAlias(b.raw));
  };
  const fromFirestore = (n: string) => {
    const b = imports.get(n);
    return b !== undefined && /^(firebase\/firestore|firebase\/firestore\/lite|firebase-admin\/firestore|@google-cloud\/firestore)$/.test(b.raw);
  };

  const helper = (name: string, depth: number): Path | undefined => {
    const fn = functions.get(name);
    if (!fn) return importedName(name) ? { ref: name, call: true } : undefined;
    if (memo.has(name)) return memo.get(name) ?? undefined;
    memo.set(name, null);
    let r: Path | undefined;
    for (const e of returnedExpressions(fn)) if ((r = pathOf(e, depth + 1))) break;
    memo.set(name, r ?? null);
    return r;
  };

  function pathOf(node: Node | undefined, depth = 0): Path | undefined {
    const n = unwrap(node);
    if (!n || depth > 14) return undefined;
    if (n.type === "identifier") {
      const value = resolveIdentifier(n);
      if (value) return pathOf(value, depth + 1);
      return importedName(n.text) ? { ref: n.text, call: false } : undefined;
    }
    if (n.type === "ternary_expression") return pathOf(n.childForFieldName("consequence") ?? undefined, depth + 1) ?? pathOf(n.childForFieldName("alternative") ?? undefined, depth + 1);
    if (n.type !== "call_expression") return undefined;
    const c = callee(n);
    if (!c) return undefined;
    const a = args(n);
    if (!c.object) {
      if (c.name === "collection" || c.name === "doc" || c.name === "collectionGroup") {
        const base = a[0] ? pathOf(a[0], depth + 1) : undefined;
        const rest = a.slice(1).flatMap((x) => segments(x));
        if (c.name === "doc" && rest.length === 0) rest.push("{}");
        return onto(base, rest);
      }
      if (c.name === "query") return pathOf(a[0], depth + 1);
      return helper(c.name, depth + 1);
    }
    if (c.name === "collection" || c.name === "doc" || c.name === "collectionGroup") {
      const base = c.name === "collectionGroup" ? [] : pathOf(c.object, depth + 1);
      const lit = literal(a[0]);
      if (base && !isSegs(base)) return onto(base, a[0] ? segments(a[0]) : ["{}"]);
      if (!base) {
        // La base n'est pas un chemin : c'est la base de données elle-même (`db.collection("x")`, `getDb().doc("a/b")`).
        if (c.name === "collection" && lit === undefined && a[0]?.type !== "template_string") return undefined;
        if (c.name === "doc" && !(lit ?? "").includes("/") && a[0]?.type !== "template_string") return undefined;
      }
      return [...(base ?? []), ...(a[0] ? segments(a[0]) : ["{}"])];
    }
    if (QUERY_METHODS.has(c.name)) return pathOf(c.object, depth + 1);
    return undefined;
  }

  /** Des segments posés sur une base : connue, importée, ou la base de données elle-même. */
  function onto(base: Path | undefined, rest: string[]): Path | undefined {
    if (!base) return rest.length ? rest : undefined;
    if (isSegs(base)) return [...base, ...rest];
    if ("rooted" in base) return { rooted: [...base.rooted, ...rest], via: base.via };
    return rest.length ? { rooted: rest, via: base.ref } : base;
  }

  /** Une expression qui fabrique la base de données : getFirestore(), admin.firestore(), new Firestore(). */
  function isDb(node: Node | undefined, depth = 0): boolean {
    const n = unwrap(node);
    if (!n || depth > 6) return false;
    if (n.type === "identifier") {
      const v = resolveIdentifier(n);
      if (v) return isDb(v, depth + 1);
      // Singleton paresseux : `let _db; … _db = getFirestore(); return _db;`.
      return assigned(n.text).some((x) => isDb(x, depth + 1));
    }
    if (n.type === "await_expression") return isDb(n.namedChildren[0], depth + 1);
    if (n.type === "new_expression") return n.childForFieldName("constructor")?.text === "Firestore";
    if (n.type !== "call_expression") return false;
    const c = callee(n);
    if (!c) return false;
    if (!c.object && (c.name === "getFirestore" || c.name === "initializeFirestore")) return fromFirestore(c.name);
    if (c.object && c.name === "firestore") return true;
    const fn = !c.object ? functions.get(c.name) : undefined;
    return fn ? fnIsDb(fn, depth + 1) : false;
  }

  /** Une fonction qui renvoie la base, ou dont le type de retour déclaré est `Firestore`. */
  function fnIsDb(fn: Node, depth = 0): boolean {
    const ret = fn.childForFieldName("return_type")?.text.replace(/^:\s*/, "").replace(/^Promise<(.*)>$/, "$1");
    if (ret === "Firestore" && fromFirestore("Firestore")) return true;
    return returnedExpressions(fn).some((e) => isDb(e, depth));
  }

  /** Les valeurs affectées à un nom dans le fichier (`x = …`). */
  function assigned(name: string): Node[] {
    const out: Node[] = [];
    walkAll(root!, (x) => {
      if (x.type === "assignment_expression" && x.childForFieldName("left")?.text === name) {
        const r = x.childForFieldName("right");
        if (r) out.push(r);
      }
    });
    return out;
  }

  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const emit = (op: "read" | "write", p: Path | undefined, n: Node, fnForm: boolean) => {
    // `getDoc(x)` est forcément un accès Firestore ; `x.get()` peut être une Map : seul le premier compte comme « non lu » s'il reste sans chemin.
    if (p && !isSegs(p) && "rooted" in p) {
      const col = collectionOf(p.rooted);
      if (col) out.push(fact("fs_rooted", [file.path, op, col, p.via, line(n)], line(n)));
      else if (fnForm) out.push(fact("fs_unresolved", [file.path, line(n)], line(n)));
      return true;
    }
    if (p && !isSegs(p)) { out.push(fact(fnForm ? "fs_ref_op" : "fs_ref_maybe", [file.path, op, p.ref, line(n)], line(n))); return true; }
    const col = p ? collectionOf(p) : undefined;
    if (col) { out.push(fact("fs_access", [file.path, op, col, line(n)], line(n))); return true; }
    if (fnForm) out.push(fact("fs_unresolved", [file.path, line(n)], line(n)));
    return fnForm;
  };

  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const c = callee(n);
    if (!c) return;
    const a = args(n);
    // getDoc(ref), setDoc(ref, …) : fonctions de l'API modulaire.
    if (!c.object && (READ_FN.has(c.name) || WRITE_FN.has(c.name)) && fromFirestore(c.name)) {
      emit(READ_FN.has(c.name) ? "read" : "write", pathOf(a[0]), n, true);
      return;
    }
    if (!c.object || !(READ_METHODS.has(c.name) || WRITE_METHODS.has(c.name))) return;
    const op = READ_METHODS.has(c.name) ? "read" : "write";
    // ref.get(), db.collection("x").add(…) : le chemin est l'objet.
    const onObject = pathOf(c.object);
    if (onObject) { emit(op, onObject, n, false); return; }
    // tx.get(ref), batch.set(ref, …) : le chemin est le premier argument.
    const onArg = pathOf(a[0]);
    if (onArg) emit(op, onArg, n, false);
  });

  // Les fonctions et constantes du fichier qui fabriquent un chemin : d'autres fichiers les importent.
  const pathFact = (name: string, p: Path | undefined, at: Node) => {
    if (isSegs(p)) { const col = collectionOf(p); if (col) out.push(fact("fs_path_fn", [file.path, name, col], line(at))); return !!col; }
    if (p && "rooted" in p) { const col = collectionOf(p.rooted); if (col) out.push(fact("fs_path_fn_rooted", [file.path, name, col, p.via], line(at))); return !!col; }
    return false;
  };
  for (const [name, fn] of functions) {
    if (fnIsDb(fn)) { out.push(fact("fs_db", [file.path, name], line(fn))); continue; }
    for (const e of returnedExpressions(fn)) if (pathFact(name, pathOf(e), fn)) break;
  }
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") : stmt;
    if (!decl || (decl.type !== "lexical_declaration" && decl.type !== "variable_declaration")) continue;
    for (const d of decl.namedChildren) {
      const name = d.childForFieldName("name")?.text;
      const value = d.childForFieldName("value");
      if (!name || !value || functions.has(name)) continue;
      if (isDb(value)) { out.push(fact("fs_db", [file.path, name], line(d))); continue; }
      pathFact(name, pathOf(value), d);
    }
  }
  return out;
};

/** Un alias de chemin du tsconfig (`@/lib/db`, `~/db`) : pas un paquet. */
function isAlias(raw: string): boolean {
  return /^(@\/|~\/|#)/.test(raw);
}

function segments(node: Node): string[] {
  const n = unwrap(node);
  if (!n) return ["{}"];
  const lit = literal(n);
  if (lit !== undefined) return lit.split("/").filter(Boolean);
  if (n.type === "template_string") {
    let s = "";
    for (const part of templateParts(n)) s += "text" in part ? part.text : "{}";
    return s.split("/").filter(Boolean).map((x) => (x.includes("{}") ? "{}" : x));
  }
  return ["{}"];
}
export default script;
