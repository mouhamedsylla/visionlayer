import type { Proof } from "../arch/types.js";

/**
 * Un petit évaluateur à la manière de Datalog (doc 07 §4.4). Les lecteurs
 * produisent des faits ; des règles déclaratives les joignent.
 *
 *   lien(A, B, "message") :- publie(X, T), consomme(Y, T), dans(X, A), dans(Y, B).
 *
 * - Une variable commence par une majuscule ou `_` ; `_` seul ne lie rien.
 * - Une constante est une chaîne entre guillemets, un nombre, ou un mot en minuscules.
 * - `not r(…)` : négation, stratifiée (la relation niée est calculée avant).
 * - `X != Y`, `X = Y` : comparaisons ; `X = "c"` lie X.
 * - `L1 < L2`, `<=`, `>`, `>=` : comparaisons de nombres (une ligne avant une autre).
 * - `P = cat(A, "/", B)` : colle des valeurs liées en une chaîne (comme `cat` de Soufflé) et lie P.
 * - `%` ouvre un commentaire jusqu'à la fin de la ligne.
 *
 * Déterministe : mêmes faits, mêmes règles, même résultat, dans le même ordre.
 * Chaque fait déduit porte les preuves des faits qui l'ont produit.
 */

export type Value = string | number;

export interface Tuple {
  args: Value[];
  proof: Proof[];
}

type Term = { var: string } | { const: Value } | { fn: "cat"; args: Term[] };
type CmpOp = "=" | "!=" | "<" | "<=" | ">" | ">=";

type Literal =
  | { kind: "atom"; rel: string; terms: Term[]; negated: boolean }
  | { kind: "cmp"; op: CmpOp; left: Term; right: Term };

export interface Rule {
  head: { rel: string; terms: Term[] };
  body: Literal[];
  /** Où la règle est écrite, pour les messages d'erreur. */
  origin: string;
}

const MAX_PROOFS = 60;
/** Une chaîne fabriquée par `cat` plus longue est abandonnée : une règle récursive mal bornée s'arrête. */
const MAX_CAT = 1000;

/* ----------------------------------------------------------------------- */
/* Lecture des règles                                                       */
/* ----------------------------------------------------------------------- */

type Token = { t: "id" | "str" | "num" | "punct"; v: string; line: number };

const NUM = /^-?\d+(\.\d+)?/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

function tokenize(src: string, origin: string): Token[] {
  const out: Token[] = [];
  let line = 1;
  for (let i = 0; i < src.length; ) {
    const c = src[i]!;
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"') {
      let j = i + 1, v = "";
      while (j < src.length && src[j] !== '"') { if (src[j] === "\\") j++; v += src[j]; j++; }
      if (j >= src.length) throw new Error(`${origin}:${line} : chaîne non fermée`);
      out.push({ t: "str", v, line }); i = j + 1; continue;
    }
    if (src.startsWith(":-", i) || src.startsWith("!=", i) || src.startsWith("<=", i) || src.startsWith(">=", i)) { out.push({ t: "punct", v: src.slice(i, i + 2), line }); i += 2; continue; }
    if ("(),.=<>".includes(c)) { out.push({ t: "punct", v: c, line }); i++; continue; }
    const rest = src.slice(i);
    const num = rest.match(NUM);
    if (num) { out.push({ t: "num", v: num[0], line }); i += num[0].length; continue; }
    const id = rest.match(IDENT);
    if (id) { out.push({ t: "id", v: id[0], line }); i += id[0].length; continue; }
    throw new Error(`${origin}:${line} : caractère inattendu « ${c} »`);
  }
  return out;
}

export function parseRules(src: string, origin = "règles"): Rule[] {
  const toks = tokenize(src, origin);
  let p = 0;
  const peek = () => toks[p];
  const fail = (msg: string): never => { throw new Error(`${origin}:${peek()?.line ?? "fin"} : ${msg}`); };
  const expect = (v: string) => { if (peek()?.v !== v) fail(`« ${v} » attendu`); p++; };

  const term = (): Term => {
    const tk = toks[p++] ?? fail("terme attendu");
    if (tk.t === "str") return { const: tk.v };
    if (tk.t === "num") return { const: Number(tk.v) };
    if (tk.t === "id" && tk.v === "cat" && peek()?.v === "(") {
      p++;
      const args: Term[] = [];
      for (;;) { args.push(term()); if (peek()?.v === ",") { p++; continue; } break; }
      expect(")");
      return { fn: "cat", args };
    }
    if (tk.t === "id") return /^[A-Z_]/.test(tk.v) ? { var: tk.v } : { const: tk.v };
    return fail(`terme attendu, trouvé « ${tk.v} »`);
  };
  const atom = (): { rel: string; terms: Term[] } => {
    const rel = toks[p++];
    if (rel?.t !== "id" || /^[A-Z_]/.test(rel.v)) fail("nom de relation attendu");
    expect("(");
    const terms: Term[] = [];
    if (peek()?.v !== ")") for (;;) { terms.push(term()); if (peek()?.v === ",") { p++; continue; } break; }
    expect(")");
    return { rel: rel!.v, terms };
  };
  const literal = (): Literal => {
    if (peek()?.v === "not" && toks[p + 1]?.t === "id" && toks[p + 2]?.v === "(") { p++; return { kind: "atom", ...atom(), negated: true }; }
    if (toks[p + 1]?.v === "(") return { kind: "atom", ...atom(), negated: false };
    const left = term();
    const op = toks[p++]?.v;
    if (!["=", "!=", "<", "<=", ">", ">="].includes(op ?? "")) fail("comparaison attendue (=, !=, <, <=, >, >=)");
    return { kind: "cmp", op: op as CmpOp, left, right: term() };
  };

  const rules: Rule[] = [];
  while (p < toks.length) {
    const line = peek()!.line;
    const head = atom();
    const body: Literal[] = [];
    if (peek()?.v === ":-") { p++; for (;;) { body.push(literal()); if (peek()?.v === ",") { p++; continue; } break; } }
    expect(".");
    const rule = { head, body, origin: `${origin}:${line}` };
    checkSafety(rule);
    rules.push(rule);
  }
  return rules;
}

/** Toute variable de la tête, d'une négation ou d'une comparaison doit être liée par un atome positif. */
function checkSafety(rule: Rule): void {
  const bound = new Set<string>();
  for (const l of rule.body) if (l.kind === "atom" && !l.negated) for (const t of l.terms) if ("var" in t) bound.add(t.var);
  // `X = "c"` et `X = cat(…)` lient X, dans l'ordre du corps.
  const vars = (t: Term): string[] => ("var" in t ? [t.var] : "fn" in t ? t.args.flatMap(vars) : []);
  for (const l of rule.body) if (l.kind === "cmp" && l.op === "=") {
    if ("var" in l.left && !("var" in l.right) && vars(l.right).every((v) => bound.has(v))) bound.add(l.left.var);
    if ("var" in l.right && !("var" in l.left) && vars(l.left).every((v) => bound.has(v))) bound.add(l.right.var);
  }
  const need = [
    ...rule.head.terms,
    ...rule.body.flatMap((l) => (l.kind === "cmp" ? [l.left, l.right].flatMap((t) => vars(t).map((v) => ({ var: v }))) : l.negated ? l.terms : [])),
  ];
  for (const t of need) if ("var" in t && t.var !== "_" && !bound.has(t.var)) throw new Error(`${rule.origin} : la variable ${t.var} n'est liée par aucun fait positif`);
  if (rule.head.terms.some((t) => "var" in t && t.var === "_")) throw new Error(`${rule.origin} : « _ » interdit dans la tête`);
  if (rule.head.terms.some((t) => "fn" in t)) throw new Error(`${rule.origin} : cat(…) s'écrit dans le corps : P = cat(…)`);
  for (const l of rule.body) if (l.kind === "atom" && l.terms.some((t) => "fn" in t)) throw new Error(`${rule.origin} : cat(…) s'écrit dans une comparaison : P = cat(…)`);
}

/* ----------------------------------------------------------------------- */
/* Évaluation                                                               */
/* ----------------------------------------------------------------------- */

const keyOf = (args: Value[]) => JSON.stringify(args);

/** Les faits d'une relation, dédoublonnés, avec un index par position calculé à la demande. */
class Relation {
  readonly tuples: Tuple[] = [];
  private readonly byKey = new Map<string, Tuple>();
  private readonly indexes = new Map<number, Map<Value, Tuple[]>>();

  add(args: Value[], proof: Proof[]): boolean {
    const k = keyOf(args);
    const old = this.byKey.get(k);
    if (old) { mergeProofs(old.proof, proof); return false; }
    const t: Tuple = { args, proof: [] };
    mergeProofs(t.proof, proof);
    this.byKey.set(k, t);
    this.tuples.push(t);
    for (const [pos, idx] of this.indexes) push(idx, args[pos]!, t);
    return true;
  }
  lookup(pos: number, value: Value): Tuple[] {
    let idx = this.indexes.get(pos);
    if (!idx) {
      idx = new Map();
      for (const t of this.tuples) push(idx, t.args[pos]!, t);
      this.indexes.set(pos, idx);
    }
    return idx.get(value) ?? [];
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); }

function mergeProofs(into: Proof[], from: Proof[]) {
  for (const p of from) {
    if (into.length >= MAX_PROOFS) return;
    if (!into.some((q) => q.path === p.path && q.line === p.line)) into.push(p);
  }
}

export class Database {
  private readonly rels = new Map<string, Relation>();

  private rel(name: string): Relation {
    let r = this.rels.get(name);
    if (!r) { r = new Relation(); this.rels.set(name, r); }
    return r;
  }

  add(rel: string, args: Value[], proof: Proof[] = []): void { this.rel(rel).add(args, proof); }

  /** Les faits d'une relation, dans l'ordre où ils ont été établis. */
  get(rel: string): readonly Tuple[] { return this.rels.get(rel)?.tuples ?? []; }

  relations(): string[] { return [...this.rels.keys()].sort(); }

  /** Applique les règles jusqu'au point fixe, strate par strate. */
  run(rules: Rule[]): void {
    for (const stratum of stratify(rules)) {
      for (let changed = true; changed; ) {
        changed = false;
        for (const rule of stratum) if (this.apply(rule)) changed = true;
      }
    }
  }

  private apply(rule: Rule): boolean {
    const found: { args: Value[]; proof: Proof[] }[] = [];
    this.solve(rule.body, 0, new Map(), [], (env, proof) => {
      found.push({ args: rule.head.terms.map((t) => ("var" in t ? env.get(t.var)! : (t as { const: Value }).const)), proof });
    });
    let changed = false;
    const head = this.rel(rule.head.rel);
    for (const f of found) if (head.add(f.args, f.proof)) changed = true;
    return changed;
  }

  private solve(body: Literal[], i: number, env: Map<string, Value>, proof: Proof[], emit: (env: Map<string, Value>, proof: Proof[]) => void): void {
    if (i === body.length) { emit(env, proof); return; }
    const lit = body[i]!;
    const val = (t: Term): Value | undefined => {
      if ("var" in t) return t.var === "_" ? undefined : env.get(t.var);
      if ("const" in t) return t.const;
      const parts = t.args.map(val);
      return parts.every((x) => x !== undefined) ? parts.join("") : undefined;
    };

    if (lit.kind === "cmp") {
      const l = val(lit.left), r = val(lit.right);
      if (lit.op === "=" && (l === undefined) !== (r === undefined)) {
        const v = (l ?? r)!;
        if (typeof v === "string" && v.length > MAX_CAT) return;
        const t = (l === undefined ? lit.left : lit.right) as { var: string };
        this.solve(body, i + 1, new Map(env).set(t.var, v), proof, emit);
        return;
      }
      if (l === undefined || r === undefined) return;
      const ok = lit.op === "=" ? l === r : lit.op === "!=" ? l !== r
        : lit.op === "<" ? Number(l) < Number(r) : lit.op === "<=" ? Number(l) <= Number(r)
        : lit.op === ">" ? Number(l) > Number(r) : Number(l) >= Number(r);
      if (ok) this.solve(body, i + 1, env, proof, emit);
      return;
    }

    const rel = this.rels.get(lit.rel);
    if (lit.negated) {
      const args = lit.terms.map(val);
      const hit = rel?.tuples.some((t) => t.args.length === args.length && args.every((a, k) => a === undefined || t.args[k] === a)) ?? false;
      if (!hit) this.solve(body, i + 1, env, proof, emit);
      return;
    }
    if (!rel) return;

    // Joindre par la première position déjà liée, sinon tout parcourir.
    const pos = lit.terms.findIndex((t) => val(t) !== undefined);
    const candidates = pos >= 0 ? rel.lookup(pos, val(lit.terms[pos]!)!) : rel.tuples;
    for (const t of candidates.slice()) {
      if (t.args.length !== lit.terms.length) continue;
      let next: Map<string, Value> | undefined = env;
      for (let k = 0; k < lit.terms.length && next; k++) {
        const term = lit.terms[k]!;
        const a = t.args[k]!;
        if ("const" in term) { if (term.const !== a) next = undefined; continue; }
        if (!("var" in term)) { next = undefined; continue; }
        if (term.var === "_") continue;
        const b = next.get(term.var);
        if (b === undefined) { if (next === env) next = new Map(env); next.set(term.var, a); }
        else if (b !== a) next = undefined;
      }
      if (next) this.solve(body, i + 1, next, t.proof.length ? [...proof, ...t.proof] : proof, emit);
    }
  }
}

/**
 * Range les règles par strates : une relation niée est entièrement calculée
 * avant la règle qui la nie. Une négation dans un cycle est refusée.
 */
export function stratify(rules: Rule[]): Rule[][] {
  const heads = new Set(rules.map((r) => r.head.rel));
  const level = new Map<string, number>([...heads].map((h) => [h, 0]));
  for (let pass = 0; ; pass++) {
    let changed = false;
    for (const r of rules) {
      let need = 0;
      for (const l of r.body) {
        if (l.kind !== "atom" || !heads.has(l.rel)) continue;
        need = Math.max(need, level.get(l.rel)! + (l.negated ? 1 : 0));
      }
      if (need > level.get(r.head.rel)!) { level.set(r.head.rel, need); changed = true; }
    }
    if (!changed) break;
    if (pass > heads.size) throw new Error(`négation dans un cycle de règles (${[...heads].join(", ")})`);
  }
  const strata: Rule[][] = [];
  for (const r of rules) (strata[level.get(r.head.rel)!] ??= []).push(r);
  return strata.filter(Boolean);
}
