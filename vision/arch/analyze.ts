import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemModel } from "../model/types.js";
import { parse, hasSyntaxError } from "../parsers/parser.js";
import { packageName } from "../stack/build.js";
import { techsForPackage } from "../stack/catalog.js";
import {
  args,
  callee,
  enclosingTopLevel,
  importBindings,
  isFunction,
  lineText,
  literal,
  resolveIdentifier,
  returnedExpressions,
  templateParts,
  topLevelFunctions,
  unwrap,
  walkAll,
  type Node,
} from "./ast.js";
import type { EntryKind, Evidence } from "./types.js";

/** Ce qu'un fichier source dit de l'exécution du système. Tout est rattaché à une ligne. */
export interface FileFacts {
  path: string;
  entries: { name: string; kind: EntryKind; line: number; detail?: string; symbolName?: string }[];
  callables: { name: string; ev: Evidence }[];
  firestore: { collection: string; op: "read" | "write"; ev: Evidence }[];
  storage: { op: "read" | "write"; ev: Evidence }[];
  auth: Evidence[];
  ai: { tech: string; ev: Evidence }[];
  models: { name: string; ev: Evidence }[];
  enqueue: { queue: string; target?: string; ev: Evidence }[];
  requests: { target: RequestTarget; ev: Evidence }[];
  dynamicPaths: Evidence[];
}

export type CallEffect =
  | { kind: "callable"; name: string }
  | { kind: "read" | "write"; collection?: string }
  | { kind: "storage"; op: "read" | "write" }
  | { kind: "auth"; name: string }
  | { kind: "enqueue"; queue: string; target?: string }
  | { kind: "request"; target: RequestTarget }
  | { kind: "ai"; method: string };

export type RequestTarget = { kind: "host"; host: string } | { kind: "env"; name: string; fallback?: string } | { kind: "relative" } | { kind: "unknown"; expr: string };

interface Parsed {
  path: string;
  source: string;
  root: Node;
  imports: Map<string, { imported: string; raw: string }>;
  functions: Map<string, Node>;
}

const FS_READ_FN = new Set(["getDoc", "getDocs", "getDocFromServer", "getDocsFromServer", "getDocFromCache", "getCountFromServer", "getAggregateFromServer", "onSnapshot"]);
const FS_WRITE_FN = new Set(["setDoc", "updateDoc", "addDoc", "deleteDoc"]);
const FS_QUERY_METHODS = new Set(["where", "orderBy", "limit", "limitToLast", "startAt", "startAfter", "endAt", "endBefore", "select", "offset", "withConverter"]);
const FS_READ_METHODS = new Set(["get", "onSnapshot", "listDocuments", "count", "stream", "getAll"]);
const FS_WRITE_METHODS = new Set(["set", "update", "add", "create", "delete"]);

const ENTRY_FN: [RegExp, EntryKind][] = [
  [/^onCall$/, "callable"],
  [/^onRequest$/, "http"],
  [/^onSchedule$/, "schedule"],
  [/^onTaskDispatched$/, "task"],
  [/^on(Document|Object)\w+$/, "trigger"],
  [/^(onMessagePublished|onValue\w+|beforeUser\w+|onCustomEventPublished)$/, "trigger"],
];

const AI_HOSTS: Record<string, string> = {
  "api.openai.com": "openai",
  "api.anthropic.com": "anthropic",
  "generativelanguage.googleapis.com": "gemini",
  "api.deepseek.com": "deepseek",
  "api.mistral.ai": "mistral",
  "openrouter.ai": "openrouter",
  "api.groq.com": "groq",
};

const MODEL_RE = /^(gemini|claude|gpt|o[134]|deepseek|mistral|mixtral|llama|codestral|command|grok|sonar|text-embedding|dall-e|whisper|tts)-[\w.@:-]*\d[\w.@:-]*$/i;

export class ArchAnalyzer {
  private parsed = new Map<string, Parsed>();
  private helperMemo = new Map<string, string[] | null>();
  private deps = new Map<string, { to: string; external: boolean }>();

  private languages = new Map<string, SystemModel["files"][number]["language"]>();

  constructor(private root: string, private model: SystemModel) {
    for (const d of model.dependencies) this.deps.set(`${d.from}\u0000${d.raw}`, { to: d.to, external: d.external });
    for (const f of model.files) if (!f.parseError) this.languages.set(f.path, f.language);
  }

  /** Fichier analysé à la demande (et gardé) : l'interface calcule un parcours sans réanalyser tout le repository. */
  get(path: string): Parsed | undefined {
    const cached = this.parsed.get(path);
    if (cached !== undefined) return cached;
    const language = this.languages.get(path);
    if (!language) return undefined;
    let source: string;
    try {
      source = readFileSync(join(this.root, path), "utf-8");
    } catch {
      return undefined;
    }
    const tree = parse(source, language);
    if (hasSyntaxError(tree)) return undefined;
    const p: Parsed = { path, source, root: tree.rootNode, imports: importBindings(tree.rootNode), functions: topLevelFunctions(tree.rootNode) };
    this.parsed.set(path, p);
    return p;
  }

  sourceOf(path: string): string | undefined {
    return this.get(path)?.source;
  }

  treeOf(path: string): Node | undefined {
    return this.get(path)?.root;
  }

  files(): string[] {
    return [...this.languages.keys()].sort();
  }

  private ev(p: Parsed, node: Node): Evidence {
    const line = node.startPosition.row + 1;
    return { path: p.path, line, text: lineText(p.source, line) };
  }

  /** Fichier interne d'où vient un identifiant importé. */
  private importedFile(p: Parsed, local: string): { file: string; name: string } | undefined {
    const b = p.imports.get(local);
    if (!b) return undefined;
    const dep = this.deps.get(`${p.path}\u0000${b.raw}`);
    return dep && !dep.external ? { file: dep.to, name: b.imported } : undefined;
  }

  private externalPackage(p: Parsed, local: string): string | undefined {
    const b = p.imports.get(local);
    if (!b) return undefined;
    const dep = this.deps.get(`${p.path}\u0000${b.raw}`);
    return dep && !dep.external ? undefined : b.raw;
  }

  // ─── Chemins Firestore ──────────────────────────────────────

  /** Segments d'un chemin Firestore construit par l'expression, ou undefined si ce n'en est pas un. */
  pathOf(p: Parsed, node: Node | undefined, depth = 0): string[] | undefined {
    const n = unwrap(node);
    if (!n || depth > 14) return undefined;
    if (n.type === "identifier") {
      const value = resolveIdentifier(n);
      return value ? this.pathOf(p, value, depth + 1) : undefined;
    }
    if (n.type === "ternary_expression") {
      return this.pathOf(p, n.childForFieldName("consequence") ?? undefined, depth + 1) ?? this.pathOf(p, n.childForFieldName("alternative") ?? undefined, depth + 1);
    }
    if (n.type !== "call_expression") return undefined;
    const c = callee(n);
    if (!c) return undefined;
    const a = args(n);

    if (!c.object) {
      if (c.name === "collection" || c.name === "doc" || c.name === "collectionGroup") {
        const base = a[0] ? this.pathOf(p, a[0], depth + 1) : undefined;
        const rest = a.slice(1).flatMap((x) => segments(x));
        if (!base && rest.length === 0) return c.name === "doc" ? undefined : undefined;
        const segs = [...(base ?? []), ...rest];
        if (c.name === "doc" && rest.length === 0) segs.push("{}");
        return segs.length ? segs : undefined;
      }
      if (c.name === "query") return this.pathOf(p, a[0], depth + 1);
      return this.helperPath(p, c.name, depth + 1);
    }

    if (c.name === "collection" || c.name === "doc" || c.name === "collectionGroup") {
      const base = c.name === "collectionGroup" ? [] : this.pathOf(p, c.object, depth + 1);
      const lit = literal(a[0]);
      if (!base) {
        // Base qui n'est pas un chemin : la base de données elle-même (`db.collection('x')`, `getDb().doc('a/b')`).
        if (c.name === "collection" && lit === undefined && a[0]?.type !== "template_string") return undefined;
        if (c.name === "doc" && !(lit ?? "").includes("/") && a[0]?.type !== "template_string") return undefined;
      }
      const segs = a[0] ? segments(a[0]) : ["{}"];
      return [...(base ?? []), ...segs];
    }
    if (FS_QUERY_METHODS.has(c.name)) return this.pathOf(p, c.object, depth + 1);
    return undefined;
  }

  /** `txCol(uid)` : une fonction du fichier (ou importée) qui renvoie un chemin. */
  private helperPath(p: Parsed, name: string, depth: number): string[] | undefined {
    let file = p;
    let fnName = name;
    let fn = p.functions.get(name);
    if (!fn) {
      const imp = this.importedFile(p, name);
      const target = imp ? this.get(imp.file) : undefined;
      if (!target || !imp) return undefined;
      file = target;
      fnName = imp.name;
      fn = target.functions.get(imp.name);
      if (!fn) return undefined;
    }
    const key = `${file.path}#${fnName}`;
    if (this.helperMemo.has(key)) return this.helperMemo.get(key) ?? undefined;
    this.helperMemo.set(key, null); // coupe la récursion
    let result: string[] | undefined;
    for (const expr of returnedExpressions(fn)) {
      result = this.pathOf(file, expr, depth + 1);
      if (result) break;
    }
    this.helperMemo.set(key, result ?? null);
    return result;
  }

  /**
   * Fichiers internes que la déclaration de plus haut niveau contenant
   * `line` utilise vraiment (identifiants importés référencés dans son
   * corps). Un fichier qui réexporte tout (`functions/src/index.ts`) ne fait
   * donc pas croire que chacune de ses fonctions atteint tout le reste.
   */
  referencedImports(path: string, line: number): string[] {
    const p = this.get(path);
    if (!p) return [];
    const stmt = p.root.namedChildren.find((c) => c.startPosition.row + 1 <= line && c.endPosition.row + 1 >= line);
    if (!stmt) return [];
    const used = new Set<string>();
    walkAll(stmt, (n) => {
      if (n.type === "identifier" || n.type === "type_identifier") used.add(n.text);
    });
    const out = new Set<string>();
    for (const name of used) {
      const imp = this.importedFile(p, name);
      if (imp) out.add(imp.file);
    }
    // Fonctions du même fichier utilisées par la déclaration : leurs imports comptent aussi.
    for (const [name, fn] of p.functions) {
      if (!used.has(name) || (fn.startPosition.row <= stmt.startPosition.row && fn.endPosition.row >= stmt.endPosition.row)) continue;
      walkAll(fn, (n) => {
        if (n.type !== "identifier") return;
        const imp = this.importedFile(p, n.text);
        if (imp) out.add(imp.file);
      });
    }
    return [...out];
  }

  /** Lignes (début, fin) de la déclaration qui contient `line` et des fonctions du même fichier qu'elle utilise. */
  ownRanges(path: string, line: number): [number, number][] {
    const p = this.get(path);
    if (!p) return [];
    const stmt = p.root.namedChildren.find((c) => c.startPosition.row + 1 <= line && c.endPosition.row + 1 >= line);
    if (!stmt) return [];
    const out: [number, number][] = [[stmt.startPosition.row + 1, stmt.endPosition.row + 1]];
    // Le binding Node crée un nouvel objet à chaque accès à un nœud : on identifie par la position.
    const seen = new Set<number>([stmt.startIndex]);
    const queue: Node[] = [stmt];
    while (queue.length) {
      const n = queue.pop()!;
      const used = new Set<string>();
      walkAll(n, (x) => {
        if (x.type === "identifier") used.add(x.text);
      });
      for (const [name, fn] of p.functions) {
        if (!used.has(name)) continue;
        const top = p.root.namedChildren.find((c) => c.startIndex <= fn.startIndex && c.endIndex >= fn.endIndex) ?? fn;
        if (seen.has(top.startIndex)) continue;
        seen.add(top.startIndex);
        queue.push(top);
        out.push([top.startPosition.row + 1, top.endPosition.row + 1]);
      }
    }
    return out;
  }

  // ─── Analyse d'un fichier ───────────────────────────────────

  analyze(path: string): FileFacts | undefined {
    const p = this.get(path);
    if (!p) return undefined;
    const facts: FileFacts = { path, entries: [], callables: [], firestore: [], storage: [], auth: [], ai: [], models: [], enqueue: [], requests: [], dynamicPaths: [] };
    const importsFrom = (re: RegExp) => [...p.imports.values()].some((b) => re.test(b.raw));
    const httpServer = importsFrom(/^(node:)?http$|^express$|^fastify$|^hono$|^koa$/);

    walkAll(p.root, (n) => {
      // Points d'entrée : `export const x = onCall(…)`.
      if (n.type === "variable_declarator") {
        const value = unwrap(n.childForFieldName("value"));
        const name = n.childForFieldName("name")?.text;
        if (value?.type === "call_expression" && name) {
          const c = callee(value);
          const kind = c && ENTRY_FN.find(([re]) => re.test(c.name))?.[1];
          if (c && kind && (!c.object || /functions|https|firestore|scheduler|tasks|pubsub|storage/.test(c.object.text))) {
            facts.entries.push({ name, kind, line: n.startPosition.row + 1, symbolName: name, detail: entryDetail(value, c.name) });
          }
        }
      }

      if (n.type === "new_expression") {
        const ctor = unwrap(n.childForFieldName("constructor"));
        const ctorName = ctor?.type === "identifier" ? ctor.text : ctor?.type === "member_expression" ? ctor.childForFieldName("property")?.text : undefined;
        const root = ctor?.type === "member_expression" ? ctor.text.split(".")[0]! : ctorName;
        const pkg = root ? this.externalPackage(p, root) : undefined;
        if (pkg) {
          for (const e of techsForPackage("npm", packageName(pkg) ?? pkg)) if (e.category === "ai") facts.ai.push({ tech: e.id, ev: this.ev(p, n) });
        }
      }

      if (n.type === "string" || n.type === "template_string") {
        const s = literal(n);
        if (s && MODEL_RE.test(s)) facts.models.push({ name: s, ev: this.ev(p, n) });
        const host = s?.match(/^https?:\/\/([^/:?#]+)/)?.[1];
        if (host && AI_HOSTS[host]) facts.ai.push({ tech: AI_HOSTS[host]!, ev: this.ev(p, n) });
      }

      // Routes HTTP d'un serveur Node brut : `req.url === '/render'`.
      if (httpServer && n.type === "binary_expression" && /^(===|==)$/.test(n.childForFieldName("operator")?.text ?? "")) {
        const [l, r] = [n.childForFieldName("left"), n.childForFieldName("right")];
        const route = literal(r ?? undefined) ?? literal(l ?? undefined);
        const other = literal(r ?? undefined) !== undefined ? l : r;
        if (route?.startsWith("/") && other && /\b(url|pathname|path)$/.test(other.text)) facts.entries.push({ name: route, kind: "http", line: n.startPosition.row + 1, detail: "route" });
      }

      if (n.type !== "call_expression") return;
      const c = callee(n);
      if (!c) return;
      const a = args(n);

      // Serveur HTTP : `server.listen(PORT)` / `app.listen(…)`.
      if (httpServer && c.name === "listen" && c.object) facts.entries.push({ name: `écoute ${a[0]?.text ?? ""}`.trim(), kind: "server", line: n.startPosition.row + 1 });
      // Routes Express/Fastify/Hono : `app.post('/x', …)`.
      if (httpServer && c.object && /^(get|post|put|patch|delete|all)$/.test(c.name) && literal(a[0])?.startsWith("/")) {
        facts.entries.push({ name: `${c.name.toUpperCase()} ${literal(a[0])}`, kind: "http", line: n.startPosition.row + 1, detail: "route" });
      }

      const eff = this.effectOf(p, n);
      if (!eff) return;
      const e = this.ev(p, n);
      switch (eff.kind) {
        case "callable":
          facts.callables.push({ name: eff.name, ev: e });
          break;
        case "read":
        case "write":
          if (eff.collection) facts.firestore.push({ collection: eff.collection, op: eff.kind, ev: e });
          else facts.dynamicPaths.push(e);
          break;
        case "storage":
          facts.storage.push({ op: eff.op, ev: e });
          break;
        case "auth":
          facts.auth.push(e);
          break;
        case "enqueue":
          facts.enqueue.push({ queue: eff.queue, target: eff.target, ev: e });
          break;
        case "request":
          facts.requests.push({ target: eff.target, ev: e });
          break;
        case "ai":
          break; // l'usage de l'IA est prouvé par la construction du client (new …), pas par chaque appel
      }
    });

    for (const e of facts.entries) {
      if (!e.symbolName) {
        const top = enclosingTopLevel(p.root, e.line - 1);
        if (top) e.symbolName = top;
      }
    }
    return facts;
  }

  /**
   * Ce que fait un appel, s'il touche un autre bloc : lecture/écriture
   * Firestore (avec sa collection), Storage, authentification, mise en file,
   * requête HTTP, appel d'une Cloud Function, appel à un modèle d'IA.
   * Partagé par la carte (analyze) et le parcours d'une feature (flow).
   */
  effectOf(p: Parsed, n: Node): CallEffect | undefined {
    const c = callee(n);
    if (!c) return undefined;
    const a = args(n);
    const imports = [...p.imports.values()];
    const importsFrom = (re: RegExp) => imports.some((b) => re.test(b.raw));

    if (c.name === "httpsCallable" || c.name === "httpsCallableFromURL") {
      const name = a.map((x) => literal(x)).find((x): x is string => typeof x === "string" && /^[A-Za-z_][\w-]*$/.test(x));
      return name ? { kind: "callable", name } : undefined;
    }

    // Firestore. `ref.set(…)` : le chemin est l'objet ; `tx.set(ref, …)` / `batch.set(ref, …)` : le premier argument.
    let target: Node | undefined;
    let op: "read" | "write" | undefined;
    if (!c.object && FS_READ_FN.has(c.name)) [target, op] = [a[0], "read"];
    else if (!c.object && FS_WRITE_FN.has(c.name)) [target, op] = [a[0], "write"];
    else if (c.object && (FS_READ_METHODS.has(c.name) || FS_WRITE_METHODS.has(c.name))) {
      op = FS_READ_METHODS.has(c.name) ? "read" : "write";
      const onObject = this.pathOf(p, c.object);
      if (onObject) {
        const col = collectionOf(onObject);
        return col ? { kind: op, collection: col } : undefined;
      }
      target = a[0];
    }
    if (op && target) {
      const segs = this.pathOf(p, target);
      const col = segs ? collectionOf(segs) : undefined;
      if (col) return { kind: op, collection: col };
      if (!c.object) return { kind: op };
    }

    if (importsFrom(/^(firebase\/storage|firebase-admin\/storage|@google-cloud\/storage)$/)) {
      if (/^(uploadBytes|uploadBytesResumable|uploadString|deleteObject)$/.test(c.name) && !c.object) return { kind: "storage", op: "write" };
      if (/^(getDownloadURL|getBytes|getBlob|listAll|getMetadata)$/.test(c.name) && !c.object) return { kind: "storage", op: "read" };
      if (c.object && /\.(file|bucket)\(/.test(c.object.type === "identifier" ? (resolveIdentifier(c.object)?.text ?? c.object.text) : c.object.text)) {
        if (/^(save|upload|createWriteStream|delete|setMetadata|makePublic)$/.test(c.name)) return { kind: "storage", op: "write" };
        if (/^(download|getSignedUrl|createReadStream|exists|getMetadata)$/.test(c.name)) return { kind: "storage", op: "read" };
      }
    }

    if (importsFrom(/^(firebase\/auth|firebase-admin\/auth)$/) && /^(signIn\w*|signOut|onAuthStateChanged|onIdTokenChanged|createUserWithEmailAndPassword|verifyIdToken|createCustomToken|getUser\w*|setCustomUserClaims)$/.test(c.name)) {
      return { kind: "auth", name: c.name };
    }

    // Mise en file : Cloud Tasks, file de tâches Firebase, Pub/Sub.
    if (c.name === "createTask" && importsFrom(/^@google-cloud\/tasks$/)) {
      const url = findProperty(a[0], "url");
      return { kind: "enqueue", queue: "cloud-tasks", target: url ? describeTarget(this.targetOf(p, url)) : undefined };
    }
    if (c.name === "enqueue" && c.object && /taskQueue\(/.test(c.object.text)) {
      const q = c.object.type === "call_expression" ? literal(args(c.object)[0]) : undefined;
      return { kind: "enqueue", queue: "cloud-tasks", target: q ? `fonction ${q}` : undefined };
    }
    if ((c.name === "publishMessage" || c.name === "publish") && c.object && /topic\(/.test(c.object.text)) {
      const t = c.object.type === "call_expression" ? literal(args(c.object)[0]) : undefined;
      return { kind: "enqueue", queue: `pubsub${t ? `:${t}` : ""}` };
    }

    if ((!c.object && c.name === "fetch") || (c.object?.text === "axios" && /^(get|post|put|patch|delete|request)$/.test(c.name))) {
      return { kind: "request", target: this.targetOf(p, a[0]) };
    }

    // Appel à un modèle : méthodes des SDK (Gemini, Anthropic, OpenAI).
    if (/^(generateContent|generateContentStream|generateImages|embedContent|countTokens)$/.test(c.name) || (/^(create|stream|parse)$/.test(c.name) && c.object && /\.(messages|completions|responses|embeddings)$/.test(c.object.text))) {
      return { kind: "ai", method: c.object ? `${c.object.text.split(".").slice(-1)[0]}.${c.name}` : c.name };
    }
    return undefined;
  }

  /** Où va une URL : hôte littéral, variable d'environnement (valeur jamais lue), chemin relatif. */
  targetOf(p: Parsed | string, node: Node | undefined, depth = 0): RequestTarget {
    const parsed = typeof p === "string" ? this.get(p)! : p;
    const n = unwrap(node);
    if (!n || depth > 8) return { kind: "unknown", expr: n?.text.slice(0, 60) ?? "?" };
    const lit = literal(n);
    if (lit !== undefined) {
      const host = lit.match(/^https?:\/\/([^/:?#]+)/)?.[1];
      if (host) return { kind: "host", host };
      if (lit.startsWith("/")) return { kind: "relative" };
      return { kind: "unknown", expr: lit.slice(0, 60) };
    }
    if (n.type === "template_string") {
      const first = templateParts(n)[0];
      if (first && "text" in first) {
        const host = first.text.match(/^https?:\/\/([^/:?#]+)/)?.[1];
        if (host) return { kind: "host", host };
        return first.text.startsWith("/") ? { kind: "relative" } : { kind: "unknown", expr: first.text.slice(0, 60) };
      }
      if (first && "expr" in first) return this.targetOf(parsed, first.expr, depth + 1);
    }
    if (n.type === "binary_expression" && /^(\?\?|\|\|)$/.test(n.childForFieldName("operator")?.text ?? "")) {
      const left = this.targetOf(parsed, n.childForFieldName("left") ?? undefined, depth + 1);
      const right = this.targetOf(parsed, n.childForFieldName("right") ?? undefined, depth + 1);
      if (left.kind === "env" && right.kind === "host") return { ...left, fallback: right.host };
      return left.kind !== "unknown" ? left : right;
    }
    const env = n.text.match(/^(?:import\.meta\.env|process\.env)\.([A-Z_][A-Z0-9_]*)$/) ?? n.text.match(/^process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]$/);
    if (env) return { kind: "env", name: env[1]! };
    if (n.type === "identifier") {
      const value = resolveIdentifier(n);
      if (value) return this.targetOf(parsed, value, depth + 1);
      const imp = this.importedFile(parsed, n.text);
      const target = imp ? this.get(imp.file) : undefined;
      if (target && imp) {
        const decl = findTopLevelConst(target.root, imp.name);
        if (decl) return this.targetOf(target, decl, depth + 1);
      }
    }
    if (n.type === "call_expression") {
      const c = callee(n);
      const fn = c && !c.object ? parsed.functions.get(c.name) : undefined;
      if (fn) for (const r of returnedExpressions(fn)) {
        const t = this.targetOf(parsed, r, depth + 1);
        if (t.kind !== "unknown") return t;
      }
    }
    return { kind: "unknown", expr: n.text.slice(0, 60) };
  }

  /** Accès interne pour flow.ts. */
  parsedFile(path: string): Parsed | undefined {
    return this.get(path);
  }
}

export type { Parsed };

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

/** `users/{}/wallet/main` → `users/{}/wallet` ; `users/{}/wallet` → `users/{}/wallet`. Undefined si la racine n'est pas nommée. */
export function collectionOf(segs: string[]): string | undefined {
  const s = segs.length % 2 === 0 ? segs.slice(0, -1) : segs;
  if (!s.length || s[0] === "{}") return undefined;
  return s.map((x, i) => (i % 2 === 1 ? "{}" : x)).join("/");
}

function entryDetail(call: Node, fn: string): string | undefined {
  const first = unwrap(args(call)[0]);
  if (!first) return undefined;
  const lit = literal(first);
  if (lit) return lit;
  if (first.type === "object") {
    const doc = literal(findProperty(first, "document")) ?? literal(findProperty(first, "schedule")) ?? literal(findProperty(first, "bucket"));
    const region = literal(findProperty(first, "region"));
    return [doc, region && !doc ? region : undefined].filter(Boolean).join(" · ") || (fn.startsWith("onDocument") ? "(document dynamique)" : undefined);
  }
  return undefined;
}

/** Propriété `name` d'un objet littéral, cherchée en profondeur (`{ task: { httpRequest: { url } } }`). */
function findProperty(node: Node | undefined, name: string): Node | undefined {
  const n = unwrap(node);
  if (!n) return undefined;
  let found: Node | undefined;
  const visit = (x: Node) => {
    for (const c of x.namedChildren) {
      if (found) return;
      if (c.type === "pair" && c.childForFieldName("key")?.text.replace(/['"]/g, "") === name) found = c.childForFieldName("value") ?? undefined;
      else if (c.type === "shorthand_property_identifier" && c.text === name) found = c;
      else if (!isFunction(c)) visit(c);
    }
  };
  if (n.type === "identifier") {
    const v = resolveIdentifier(n);
    if (v) visit(v);
  } else visit(n);
  return found;
}

function findTopLevelConst(root: Node, name: string): Node | undefined {
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (!decl || (decl.type !== "lexical_declaration" && decl.type !== "variable_declaration")) continue;
    for (const d of decl.namedChildren) if (d.childForFieldName("name")?.text === name) return d.childForFieldName("value") ?? undefined;
  }
  return undefined;
}

export function describeTarget(t: RequestTarget): string {
  switch (t.kind) {
    case "host":
      return t.host;
    case "env":
      return `variable ${t.name}${t.fallback ? ` (défaut ${t.fallback})` : ""}`;
    case "relative":
      return "même origine";
    case "unknown":
      return `inconnu (${t.expr})`;
  }
}
