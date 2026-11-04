import type { Proof } from "../arch/types.js";

type Row = { readonly args: readonly unknown[]; readonly proof: readonly Proof[] };
const s = (v: unknown) => String(v);

/**
 * Une route écrite dans une fonction exportée (`createServer()` d'un paquet partagé) n'existe que pour les programmes
 * qui emploient cette fonction, même si leurs imports chargent le fichier : `import { createWorker } from "sdk"` charge
 * aussi `createServer.ts` à travers le fichier qui ré-exporte tout, sans lancer le serveur.
 *
 * On suit les noms importés depuis le code du programme, à travers les fichiers qui ne font que ré-exporter. Quand
 * aucun programme n'emploie la fonction par un import lu, on ne sait pas : le point d'entrée reste à tous.
 */
export function uncalledEntries(rows: (name: string) => readonly Row[], reachOf: Map<string, string[]>) {
  const relays = new Set(rows("reexports_only").map((t) => s(t.args[0])));
  const imports = rows("imports").map((t) => ({ from: s(t.args[0]), local: s(t.args[1]), to: s(t.args[2]), name: s(t.args[3]) }));
  const spans = new Map<string, { name: string; start: number; end: number }[]>();
  for (const t of rows("fn_span")) (spans.get(s(t.args[0])) ?? spans.set(s(t.args[0]), []).get(s(t.args[0]))!).push({ name: s(t.args[1]), start: Number(t.args[2]), end: Number(t.args[3]) });
  const exported = new Set(rows("export_fn").map((t) => `${s(t.args[0])}\0${s(t.args[1])}`));
  const usedHere = new Set(rows("used_here").map((t) => `${s(t.args[0])}\0${s(t.args[1])}`));
  const key = (f: string, n: string) => `${f}\0${n}`;

  /** Les noms qu'un ensemble de fichiers emploie, de fichier en fichier à travers les ré-exportations. */
  const wantedBy = (files: string[]) => {
    const inside = new Set(files);
    const wanted = new Set<string>();
    const todo: [string, string][] = [];
    const want = (f: string, n: string) => { if (!wanted.has(key(f, n))) { wanted.add(key(f, n)); todo.push([f, n]); } };
    for (const i of imports) if (inside.has(i.from) && !relays.has(i.from)) want(i.to, i.name);
    for (let at = todo.pop(); at; at = todo.pop()) {
      const [f, n] = at;
      for (const i of imports) if (i.from === f && relays.has(f) && (i.local === n || i.local === "*" || n === "*")) want(i.to, i.name === "*" ? n : i.name);
    }
    return wanted;
  };
  const byUnit = new Map([...reachOf].map(([target, files]) => [target, wantedBy(files)]));
  const anyone = new Set([...byUnit.values()].flatMap((w) => [...w]));

  return (target: string, entry: Row | undefined): boolean => {
    const at = entry?.proof[0];
    if (!at || at.path === target) return false;
    const fn = (spans.get(at.path) ?? []).filter((x) => x.start <= at.line && at.line <= x.end && exported.has(key(at.path, x.name))).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    if (!fn || usedHere.has(key(at.path, fn.name))) return false;
    if (!anyone.has(key(at.path, fn.name)) || anyone.has(key(at.path, "*"))) return false;
    return !byUnit.get(target)?.has(key(at.path, fn.name));
  };
}
