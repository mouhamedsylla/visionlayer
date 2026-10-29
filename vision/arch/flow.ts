import type { SymbolFact, SystemModel } from "../model/types.js";
import { ArchAnalyzer, describeTarget, type CallEffect, type Parsed } from "./analyze.js";
import { args, callee, isFunction, lineText, resolveIdentifier, unwrap, type Node } from "./ast.js";
import type { ArchModel, EntryPoint } from "./types.js";

/**
 * Parcours d'une feature (ADR 0012) : ce que fait un point d'entrée, dans
 * l'ordre du code — conditions de refus, branches, boucles, lectures et
 * écritures, appels IA, mises en file, requêtes, appels internes (dépliables
 * un par un). Chaque étape est une ligne du code : l'algorithme se lit sans
 * ouvrir quinze fichiers, et se vérifie en un clic.
 *
 * Extrait, jamais résumé par un modèle : l'étiquette d'une étape est son
 * code condensé (`si !uid → HttpsError('unauthenticated')`), pas une
 * paraphrase. Le « pourquoi » viendra des fiches rédigées (phase 2).
 */

export type StepKind = "guard" | "branch" | "loop" | "call" | "read" | "write" | "ai" | "enqueue" | "request" | "storage" | "auth" | "callable" | "return" | "throw" | "callback";

export interface FlowStep {
  kind: StepKind;
  label: string;
  path: string;
  line: number;
  /** Fonction interne appelée : se déplie à la demande. */
  target?: { symbol: string; name: string; path: string; line: number };
  /**
   * Ce que la fonction appelée fait en profondeur (jusqu'à 5 appels) :
   * « écrit videoJobs », « IA », « file Cloud Tasks ». Vide = simple calcul.
   */
  effects?: string[];
  children?: FlowStep[];
}

export interface FlowCaller {
  block: string;
  path: string;
  line: number;
  text: string;
  /** Fonction du client qui fait l'appel (`createVideo`). */
  via?: string;
  /** Fichiers qui importent cette fonction (écrans, composants). */
  usedBy: string[];
}

/**
 * Un passage de l'algorithme : les instructions qui suivent un commentaire
 * écrit par le développeur, jusqu'au commentaire suivant. Le commentaire
 * donne le titre (provenance « commentaire du code ») ; sans commentaire, le
 * titre se lit dans le code du passage.
 */
export interface FlowChapter {
  comment?: { line: number; text: string };
  /** Première et dernière ligne du passage (commentaire compris). */
  line: number;
  endLine: number;
  /** Étapes de premier niveau du passage, dans l'ordre. */
  steps: FlowStep[];
}

export interface Flow {
  symbol: { id: string; name: string; path: string; line: number; endLine: number };
  entry?: EntryPoint;
  callers: FlowCaller[];
  steps: FlowStep[];
  chapters: FlowChapter[];
  /** Ce que la feature enclenche ailleurs : déclencheurs sur les collections écrites, files. */
  next: { label: string; entry?: string; path: string; line: number }[];
}

/** Résumé d'une feature pour la liste (écran Features). */
export interface FeatureSummary {
  id: string;
  /** Conditions qui arrêtent la feature avant la fin : refus, erreurs levées, réponses anticipées. */
  refusals: number;
  /** Écrans et composants qui appellent la feature (fichiers qui importent la fonction cliente). */
  usedBy: string[];
}

const MAX_STEPS = 400;

export function buildFlow(root: string, model: SystemModel, arch: ArchModel, ref: { entry?: string; symbol?: string }, an = new ArchAnalyzer(root, model)): Flow | undefined {
  const entry = ref.entry ? arch.entries.find((e) => e.id === ref.entry) : undefined;
  const symbolId = ref.symbol ?? entry?.symbol;
  const symbol = symbolId ? model.files.flatMap((f) => f.symbols).find((s) => s.id === symbolId) : undefined;
  if (!symbol) return undefined;
  const p = an.parsedFile(symbol.location.path);
  if (!p) return undefined;
  const decl = declarationOf(p, symbol);
  if (!decl) return undefined;

  // Une Cloud Function : la logique est dans le gestionnaire passé à onCall(…) / onDocumentWritten(…).
  const handler = handlerOf(decl);
  const aiInterior = arch.blocks.find((b) => b.id === "capability:ai")?.interior;
  const aiDirs = new Set(aiInterior?.kind === "ai" ? aiInterior.dirs ?? [] : []);
  const aiFiles = new Set(aiInterior?.kind === "ai" ? aiInterior.files : []);
  const ctx: Ctx = { an, model, p, count: 0, memo: new Map(), aiDirs, aiFiles };
  const steps = stepsOf(ctx, handler);

  const flow: Flow = {
    symbol: { id: symbol.id, name: symbol.name, path: symbol.location.path, line: symbol.location.startLine, endLine: symbol.location.endLine },
    callers: entry ? callersOf(an, model, arch, entry) : [],
    steps,
    chapters: chaptersOf(handler, steps),
    next: [],
  };
  if (entry) flow.entry = entry;

  // En aval : une collection écrite par cette feature qui déclenche une autre fonction.
  const written = new Set<string>();
  const enqueued = new Set<string>();
  collect(steps, (s) => {
    const m = s.kind === "write" ? s.label.match(/^écrit (\S+)/) : undefined;
    if (m) written.add(m[1]!);
    if (s.kind === "enqueue" && !enqueued.has(s.label)) (enqueued.add(s.label), flow.next.push({ label: s.label, path: s.path, line: s.line }));
    for (const e of s.effects ?? []) {
      const w = e.match(/^écrit (\S+)/);
      if (w) written.add(w[1]!);
      if (e.startsWith("file ") && !enqueued.has(e)) (enqueued.add(e), flow.next.push({ label: `met en ${e} (via ${s.target?.name ?? "appel"})`, path: s.path, line: s.line }));
    }
  });
  const fsInterior = arch.blocks.find((b) => b.id === "datastore:firestore")?.interior;
  if (fsInterior?.kind === "datastore") {
    for (const c of fsInterior.collections) {
      if (!written.has(c.path)) continue;
      for (const t of c.triggers) {
        const te = arch.entries.find((e) => e.id === t);
        if (te) flow.next.push({ label: `l'écriture dans ${c.path} déclenche ${te.name}`, entry: te.id, path: te.path, line: te.line });
      }
    }
  }
  return flow;
}

interface Ctx {
  an: ArchAnalyzer;
  model: SystemModel;
  p: Parsed;
  count: number;
  /** Résumés d'effets par symbole, partagés entre fichiers. */
  memo: Map<string, Set<string>>;
  /** Couche IA : fichiers qui construisent un client, et dossiers dédiés (aiLayerDirs) — toute fonction qui y est définie compte comme « IA ». */
  aiDirs: Set<string>;
  aiFiles: Set<string>;
}

function declarationOf(p: Parsed, symbol: SymbolFact): Node | undefined {
  let found: Node | undefined;
  const visit = (n: Node) => {
    for (const c of n.namedChildren) {
      if (found) return;
      if (c.startPosition.row + 1 === symbol.location.startLine || (c.startPosition.row + 1 >= symbol.location.startLine && c.startPosition.row < symbol.location.endLine)) {
        const name = c.childForFieldName("name")?.text;
        if (name === symbol.name && (c.type === "function_declaration" || c.type === "variable_declarator" || c.type === "method_definition" || c.type === "class_declaration")) {
          found = c.type === "variable_declarator" ? c.childForFieldName("value") ?? c : c;
          return;
        }
      }
      if (c.startPosition.row + 1 <= symbol.location.endLine && c.endPosition.row + 1 >= symbol.location.startLine) visit(c);
    }
  };
  visit(p.root);
  return found;
}

/** `onCall({…}, async (req) => {…})` → le gestionnaire ; sinon la fonction elle-même. */
function handlerOf(decl: Node): Node {
  const n = unwrap(decl);
  if (n?.type === "call_expression") {
    const fnArg = [...args(n)].reverse().find((a) => isFunction(a));
    if (fnArg) return fnArg;
  }
  return n ?? decl;
}

function bodyOf(fn: Node): Node {
  return fn.childForFieldName("body") ?? fn;
}

function cond(n: Node | null | undefined): string {
  return (n?.text ?? "").replace(/^\(|\)$/g, "").replace(/\s+/g, " ").trim();
}

/** Texte condensé, coupé entre deux mots ou deux éléments, jamais au milieu d'un mot. */
function short(t: string, max = 110): string {
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = Math.max(s.lastIndexOf(" ", max), s.lastIndexOf(",", max));
  return `${s.slice(0, cut > max / 2 ? cut : max).replace(/[\s,]+$/, "")} …`;
}

/** Arguments d'un appel : entiers tant qu'ils tiennent, puis « … » (jamais un argument coupé). */
function argList(call: Node, max = 50): string {
  const xs = args(call).map((a) => a.text.replace(/\s+/g, " ").trim());
  const all = xs.join(", ");
  if (all.length <= max) return all;
  const kept: string[] = [];
  for (const x of xs) {
    if ([...kept, x].join(", ").length > max) break;
    kept.push(x);
  }
  return [...kept, "…"].join(", ");
}

/** Une branche qui ne fait que sortir (throw / return) : une condition de refus. */
function exitOf(block: Node | null | undefined): Node | undefined {
  const b = unwrap(block);
  if (!b) return undefined;
  if (b.type === "throw_statement" || b.type === "return_statement") return b;
  if (b.type === "statement_block") {
    const stmts = b.namedChildren.filter((c) => c.type !== "comment");
    const last = stmts[stmts.length - 1];
    if (stmts.length <= 3 && last && (last.type === "throw_statement" || last.type === "return_statement")) return last;
  }
  return undefined;
}

function stepsOf(ctx: Ctx, fnOrBlock: Node): FlowStep[] {
  const body = isFunction(fnOrBlock) ? bodyOf(fnOrBlock) : fnOrBlock;
  // Flèche à corps expression : `(x) => doSomething(x)`.
  if (body.type !== "statement_block") return effectsIn(ctx, body);
  const out: FlowStep[] = [];
  for (const stmt of body.namedChildren) {
    if (ctx.count > MAX_STEPS) break;
    out.push(...stepsOfStatement(ctx, stmt));
  }
  return out;
}

function stepsOfStatement(ctx: Ctx, stmt: Node): FlowStep[] {
  const at = (n: Node) => ({ path: ctx.p.path, line: n.startPosition.row + 1 });
  switch (stmt.type) {
    case "comment":
      return [];
    case "if_statement": {
      const c = cond(stmt.childForFieldName("condition"));
      const cons = stmt.childForFieldName("consequence");
      const alt = stmt.childForFieldName("alternative");
      const exit = exitOf(cons);
      const out: FlowStep[] = [];
      if (exit && !alt) {
        ctx.count++;
        const what = exit.type === "throw_statement" ? `refuse : ${short(exit.namedChildren[0]?.text ?? "throw", 80)}` : `s'arrête${exit.namedChildren[0] ? ` : renvoie ${short(exit.namedChildren[0].text, 70)}` : ""}`;
        const inner = cons ? stepsOfBlock(ctx, cons).filter((s) => s.kind !== "throw" && s.kind !== "return") : [];
        out.push({ kind: "guard", label: `si ${c} → ${what}`, ...at(stmt), ...(inner.length ? { children: inner } : {}) });
        return out;
      }
      ctx.count++;
      out.push({ kind: "branch", label: `si ${c}`, ...at(stmt), children: cons ? stepsOfBlock(ctx, cons) : [] });
      if (alt) {
        const elseBody = alt.namedChildren[0];
        if (elseBody?.type === "if_statement") {
          const nested = stepsOfStatement(ctx, elseBody);
          // Seule la première condition de la chaîne devient « sinon si … » ; son propre « sinon » reste tel quel.
          if (nested[0] && (nested[0].kind === "branch" || nested[0].kind === "guard")) nested[0].label = `sinon ${nested[0].label}`;
          out.push(...nested);
        } else if (elseBody) out.push({ kind: "branch", label: "sinon", ...at(alt), children: stepsOfBlock(ctx, elseBody) });
      }
      return out;
    }
    case "for_statement":
    case "for_in_statement":
    case "while_statement":
    case "do_statement": {
      ctx.count++;
      const head = stmt.type === "for_in_statement" ? `pour chaque ${cond(stmt.childForFieldName("left"))} de ${cond(stmt.childForFieldName("right"))}` : stmt.type === "for_statement" ? `boucle ${short(stmt.text.split("{")[0] ?? "", 90)}` : `tant que ${cond(stmt.childForFieldName("condition"))}`;
      return [{ kind: "loop", label: head, ...at(stmt), children: stepsOfBlock(ctx, stmt.childForFieldName("body") ?? stmt) }];
    }
    case "try_statement": {
      const out = stepsOfBlock(ctx, stmt.childForFieldName("body") ?? stmt);
      const handler = stmt.childForFieldName("handler");
      const caught = handler ? stepsOfBlock(ctx, handler.childForFieldName("body") ?? handler) : [];
      if (caught.length) out.push({ kind: "branch", label: "en cas d'erreur", ...at(handler!), children: caught });
      return out;
    }
    case "switch_statement": {
      ctx.count++;
      const cases = (stmt.childForFieldName("body")?.namedChildren ?? []).filter((c) => c.type === "switch_case" || c.type === "switch_default");
      return [{
        kind: "branch",
        label: `selon ${cond(stmt.childForFieldName("value"))}`,
        ...at(stmt),
        children: cases.map((c) => ({ kind: "branch" as const, label: c.type === "switch_default" ? "par défaut" : `cas ${short(c.childForFieldName("value")?.text ?? "", 60)}`, ...at(c), children: c.namedChildren.filter((x) => x !== c.childForFieldName("value")).flatMap((x) => stepsOfStatement(ctx, x)) })),
      }];
    }
    case "return_statement": {
      const effects = stmt.namedChildren[0] ? effectsIn(ctx, stmt.namedChildren[0]) : [];
      ctx.count++;
      return [...effects, { kind: "return", label: stmt.namedChildren[0] ? `renvoie ${short(stmt.namedChildren[0].text, 90)}` : "termine", ...at(stmt) }];
    }
    case "throw_statement":
      ctx.count++;
      return [{ kind: "throw", label: `échoue : ${short(stmt.namedChildren[0]?.text ?? "", 90)}`, ...at(stmt) }];
    case "statement_block":
      return stepsOfBlock(ctx, stmt);
    default:
      return effectsIn(ctx, stmt);
  }
}

/**
 * Découpe le corps d'une fonction en passages : un commentaire sur sa propre
 * ligne, juste avant une instruction de premier niveau (ou en tête du bloc
 * d'un `if`/`try` de premier niveau), ouvre un passage. Les commentaires en
 * fin de ligne et les directives (eslint, @ts-…) n'en ouvrent pas ; un
 * marqueur de connaissance (`// @k identifiant`) est transparent.
 */
function chaptersOf(fn: Node, steps: FlowStep[]): FlowChapter[] {
  const body = isFunction(fn) ? bodyOf(fn) : fn;
  if (body.type !== "statement_block") return steps.length ? [{ line: fn.startPosition.row + 1, endLine: fn.endPosition.row + 1, steps }] : [];
  const starts: { line: number; stmt: number; comment?: { line: number; text: string } }[] = [];
  let run: Node[] = [];
  let prevEnd = -1;
  for (const c of body.namedChildren) {
    if (c.type === "comment") {
      if (isMarker(c)) continue;
      if (c.startPosition.row === prevEnd) continue; // en fin de ligne : commente l'instruction, n'ouvre rien
      if (run.length && c.startPosition.row > run[run.length - 1]!.endPosition.row + 1) run = [];
      run.push(c);
      continue;
    }
    const line = c.startPosition.row + 1;
    const lead = commentText(run);
    const comment = lead ? { line: run[0]!.startPosition.row + 1, text: lead } : innerLead(c);
    if (comment) starts.push({ line: comment.line, stmt: line, comment });
    else if (!starts.length) starts.push({ line, stmt: line });
    run = [];
    prevEnd = c.endPosition.row;
  }
  const end = body.endPosition.row + 1;
  return starts
    .map((s, i) => {
      const next = starts[i + 1];
      const stop = next ? next.stmt : Infinity;
      const own = steps.filter((x) => x.line >= s.stmt && x.line < stop);
      const chapter: FlowChapter = { line: s.line, endLine: next ? next.line - 1 : end - 1, steps: own };
      if (s.comment) chapter.comment = s.comment;
      return chapter;
    })
    .filter((c) => c.steps.length);
}

/** `if (x) {` suivi d'un commentaire sur sa propre ligne : ce commentaire dit ce que fait la branche. */
function innerLead(stmt: Node): { line: number; text: string } | undefined {
  const block = stmt.type === "if_statement" ? stmt.childForFieldName("consequence") : stmt.type === "try_statement" ? stmt.childForFieldName("body") : undefined;
  if (block?.type !== "statement_block") return undefined;
  const run: Node[] = [];
  for (const c of block.namedChildren) {
    if (c.type !== "comment") break;
    if (isMarker(c)) continue;
    if (c.startPosition.row === stmt.startPosition.row) return undefined;
    run.push(c);
  }
  const text = commentText(run);
  return text ? { line: run[0]!.startPosition.row + 1, text } : undefined;
}

/** `// @k video.dedup-once` : ancre une affirmation de .vision/knowledge sur l'instruction suivante ; ce n'est pas un commentaire du développeur. */
const isMarker = (c: Node) => /^(?:\/\/|\/\*)\s*@k\s+[\w.-]+\s*(?:\*\/)?$/.test(c.text);

function commentText(run: Node[]): string | undefined {
  const text = run
    .map((c) => c.text.replace(/^\/\*+|\*+\/$/g, "").split("\n").map((l) => l.replace(/^\s*(\/\/+|\*)\s?/, "").trim()).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\p{L}{3}/u.test(text) || /^(eslint|@ts-|prettier|istanbul|TODO\b|FIXME\b)/i.test(text)) return undefined;
  return text;
}

function stepsOfBlock(ctx: Ctx, n: Node): FlowStep[] {
  if (n.type === "statement_block") return stepsOf(ctx, n);
  if (n.type === "else_clause") return n.namedChildren[0] ? stepsOfStatement(ctx, n.namedChildren[0]) : [];
  return stepsOfStatement(ctx, n);
}

/**
 * Appels qui comptent dans une instruction, dans l'ordre : effets sur
 * d'autres blocs (classés par l'analyseur) et appels de fonctions internes.
 * Les rappels (`runTransaction(async (tx) => …)`) sont dépliés s'ils
 * contiennent eux-mêmes des étapes.
 */
function effectsIn(ctx: Ctx, node: Node): FlowStep[] {
  const out: FlowStep[] = [];
  const visit = (n: Node) => {
    for (const c of n.namedChildren) {
      if (ctx.count > MAX_STEPS) return;
      if (isFunction(c)) {
        if (c.parent?.type === "arguments") {
          const call = c.parent.parent;
          const inner = stepsOf(ctx, c);
          if (hasSubstance(inner)) {
            const name = call ? callee(call)?.name : undefined;
            out.push({ kind: "callback", label: name === "runTransaction" ? "dans une transaction" : `dans ${name ?? "un rappel"}(…)`, path: ctx.p.path, line: c.startPosition.row + 1, children: inner });
          }
        }
        continue;
      }
      if (c.type === "call_expression") {
        visit(c); // les arguments d'abord : `setDoc(doc(…), await compute())`
        const step = stepForCall(ctx, c);
        if (step) {
          ctx.count++;
          out.push(step);
        }
        continue;
      }
      visit(c);
    }
  };
  if (node.type === "call_expression") {
    visit(node);
    const step = stepForCall(ctx, node);
    if (step) (ctx.count++, out.push(step));
  } else visit(node);
  return out;
}

function stepForCall(ctx: Ctx, call: Node): FlowStep | undefined {
  const line = call.startPosition.row + 1;
  const base = { path: ctx.p.path, line };
  const eff: CallEffect | undefined = ctx.an.effectOf(ctx.p, call);
  if (eff) {
    switch (eff.kind) {
      case "read":
        return { kind: "read", label: `lit ${eff.collection ?? "(chemin calculé)"}`, ...base };
      case "write":
        return { kind: "write", label: `écrit ${eff.collection ?? "(chemin calculé)"}`, ...base };
      case "storage":
        return { kind: "storage", label: eff.op === "read" ? "lit un fichier (Storage)" : "écrit un fichier (Storage)", ...base };
      case "auth":
        return { kind: "auth", label: `authentification : ${eff.name}`, ...base };
      case "enqueue":
        return { kind: "enqueue", label: `met en file (${eff.queue.replace("cloud-tasks", "Cloud Tasks")})${eff.target ? ` → ${eff.target}` : ""}`, ...base };
      case "request":
        return { kind: "request", label: `requête HTTP → ${describeTarget(eff.target)}`, ...base };
      case "callable":
        return { kind: "callable", label: `appelle la fonction ${eff.name}`, ...base };
      case "ai":
        return { kind: "ai", label: `appel au modèle (${eff.method})`, ...base };
    }
  }
  // Fonction interne : locale au fichier, ou importée d'un fichier du repository.
  const c = callee(call);
  if (!c || c.object) return undefined;
  // `const call = (x) => generate(…)` puis `call(…)` : la fonction locale est dépliée sur place.
  const fnNode = call.childForFieldName("function");
  const localFn = fnNode?.type === "identifier" ? unwrap(resolveIdentifier(fnNode)) : undefined;
  if (localFn && isFunction(localFn) && !ctx.memo.has(`local:${ctx.p.path}:${localFn.startIndex}`)) {
    ctx.memo.set(`local:${ctx.p.path}:${localFn.startIndex}`, new Set());
    const inner = stepsOf(ctx, localFn);
    ctx.memo.delete(`local:${ctx.p.path}:${localFn.startIndex}`);
    return inner.length ? { kind: "callback", label: `${c.name}(${argList(call)}) — fonction locale`, ...base, children: inner } : undefined;
  }
  const target = resolveFunction(ctx, c.name, call);
  if (!target) return undefined;
  const effects = new Set(effectSummary(ctx, target.symbol, 0));
  // `generateVideoScript({ provider: getProvider(…) })` : la fonction reçoit un fournisseur d'IA, elle l'utilise.
  const argCalls: Node[] = [];
  const findCalls = (n: Node) => n.namedChildren.forEach((x) => (x.type === "call_expression" ? (argCalls.push(x), findCalls(x)) : isFunction(x) ? undefined : findCalls(x)));
  for (const a of args(call)) findCalls(a);
  for (const ac of argCalls) {
    const k = callee(ac);
    const t = k && !k.object ? resolveFunction(ctx, k.name, ac) : undefined;
    if (t && effectSummary(ctx, t.symbol, 0).has("IA")) effects.add("IA");
  }
  return { kind: "call", label: `${c.name}(${argList(call)})`, ...base, target, effects: [...effects].sort() };
}

function effectLabel(eff: CallEffect): string | undefined {
  switch (eff.kind) {
    case "read":
      return eff.collection ? `lit ${eff.collection}` : undefined;
    case "write":
      return eff.collection ? `écrit ${eff.collection}` : undefined;
    case "storage":
      return eff.op === "read" ? "lit Storage" : "écrit Storage";
    case "ai":
      return "IA";
    case "enqueue":
      return `file ${eff.queue.replace("cloud-tasks", "Cloud Tasks")}${eff.target ? ` → ${eff.target}` : ""}`;
    case "request":
      return `HTTP → ${describeTarget(eff.target)}`;
    case "callable":
      return `fonction ${eff.name}`;
    case "auth":
      return "authentification";
  }
}

/** Effets atteints par une fonction interne, en suivant ses appels internes (profondeur 5, mémoïsé). */
function effectSummary(ctx: Ctx, symbolId: string, depth: number): Set<string> {
  const memo = ctx.memo.get(symbolId);
  if (memo) return memo;
  const out = new Set<string>();
  ctx.memo.set(symbolId, out); // coupe les cycles
  if (depth > 5) return out;
  const symbol = ctx.model.files.flatMap((f) => f.symbols).find((s) => s.id === symbolId);
  const p = symbol ? ctx.an.parsedFile(symbol.location.path) : undefined;
  const decl = p && symbol ? declarationOf(p, symbol) : undefined;
  if (!p || !decl) return out;
  const sp = symbol!.location.path;
  if (ctx.aiFiles.has(sp) || ctx.aiDirs.has(sp.slice(0, sp.lastIndexOf("/")))) out.add("IA");
  const sub: Ctx = { ...ctx, p };
  const visit = (n: Node) => {
    for (const c of n.namedChildren) {
      if (isFunction(c) && c.parent?.type !== "arguments") continue;
      if (c.type === "call_expression") {
        const eff = ctx.an.effectOf(p, c);
        const label = eff ? effectLabel(eff) : undefined;
        if (label) out.add(label);
        else if (!eff) {
          const k = callee(c);
          const t = k && !k.object ? resolveFunction(sub, k.name, c) : undefined;
          if (t && t.symbol !== symbolId) for (const x of effectSummary(sub, t.symbol, depth + 1)) out.add(x);
        }
      }
      visit(c);
    }
  };
  visit(handlerOf(decl));
  return out;
}

function resolveFunction(ctx: Ctx, name: string, at: Node): FlowStep["target"] | undefined {
  const local = ctx.p.functions.get(name);
  const fileFact = (path: string) => ctx.model.files.find((f) => f.path === path);
  if (local) {
    const s = fileFact(ctx.p.path)?.symbols.find((x) => x.name === name);
    if (s) return { symbol: s.id, name, path: s.location.path, line: s.location.startLine };
  }
  // Variable locale qui porte une fonction : ignorée (pas un symbole du modèle).
  if (resolveIdentifier(at.childForFieldName("function") ?? at)) return undefined;
  const b = ctx.p.imports.get(name);
  if (!b) return undefined;
  const dep = ctx.model.dependencies.find((d) => d.from === ctx.p.path && d.raw === b.raw && !d.external);
  if (!dep) return undefined;
  const wanted = b.imported === "default" ? undefined : b.imported;
  const s = resolveExported(ctx.model, dep.to, wanted ?? name, 0);
  return s ? { symbol: s.id, name, path: s.location.path, line: s.location.startLine } : undefined;
}

/** Suit les ré-exports (`export { x } from './y'`) jusqu'à la déclaration. */
function resolveExported(model: SystemModel, file: string, name: string, depth: number): SymbolFact | undefined {
  if (depth > 6) return undefined;
  const f = model.files.find((x) => x.path === file);
  const direct = f?.symbols.find((s) => s.name === name && s.exported) ?? f?.symbols.find((s) => s.name === name);
  if (direct) return direct;
  const re = model.reExports.find((r) => r.file === file && r.exportedName === name && !r.external);
  return re ? resolveExported(model, re.sourceFile, re.originalName, depth + 1) : undefined;
}

/**
 * Qui appelle ce point d'entrée : les lignes `httpsCallable(…, 'nom')` des
 * clients, la fonction qui les contient, et les fichiers qui importent
 * cette fonction (les écrans).
 */
function callersOf(an: ArchAnalyzer, model: SystemModel, arch: ArchModel, entry: EntryPoint): FlowCaller[] {
  const out: FlowCaller[] = [];
  for (const l of arch.links.filter((x) => x.targets.includes(entry.id) && x.kind === "calls")) {
    for (const e of l.evidence) {
      const p = an.parsedFile(e.path);
      if (!p) continue;
      // La preuve d'un lien « calls » vers ce bloc peut viser une autre fonction : on ne garde que les bonnes lignes.
      if (!new RegExp(`['"\`]${entry.name}['"\`]`).test(p.source.split("\n").slice(e.line - 1, e.line + 3).join("\n"))) continue;
      const via = enclosingName(p.root, e.line - 1);
      const usedBy = via ? model.dependencies.filter((d) => d.to === e.path && !d.external).map((d) => d.from) : [];
      out.push({ block: l.from, path: e.path, line: e.line, text: lineText(p.source, e.line), via, usedBy: [...new Set(usedBy)].sort() });
    }
  }
  return out;
}

function enclosingName(root: Node, row: number): string | undefined {
  for (const stmt of root.namedChildren) {
    if (stmt.startPosition.row > row || stmt.endPosition.row < row) continue;
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (decl?.type === "function_declaration") return decl.childForFieldName("name")?.text;
    if (decl?.type === "lexical_declaration") return decl.namedChildren[0]?.childForFieldName("name")?.text;
  }
  return undefined;
}

/** Un rappel ne mérite une étape que s'il fait quelque chose au-delà de calculer une valeur. */
function hasSubstance(steps: FlowStep[]): boolean {
  return steps.some((s) => (s.kind !== "return" && s.kind !== "branch" && s.kind !== "loop" && s.kind !== "call") || (s.kind === "call" && (s.effects?.length ?? 0) > 0) || (s.children ? hasSubstance(s.children) : false));
}

function collect(steps: FlowStep[], visit: (s: FlowStep) => void): void {
  for (const s of steps) {
    visit(s);
    if (s.children) collect(s.children, visit);
  }
}

