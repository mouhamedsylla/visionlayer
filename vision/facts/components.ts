import type { ArchEdge, ArchNode, ComponentFacet, Occurrence, Proof } from "../arch/types.js";
import { fnId, type FnGraph, type Reach } from "./fn-graph.js";

/**
 * Les composants d'un déployable, calculés depuis ce qui s'exécute, jamais
 * depuis les dossiers (docs/fonctionnement/05-le-modele-neutre.md).
 *
 * 1. Chaque fichier du déployable sert les points d'entrée dont la portée
 *    (entry-reach.ts) l'exécute. Un fichier qu'aucun n'exécute n'entre dans
 *    aucun composant.
 * 2. Deux fichiers dont l'un appelle l'autre et qui servent exactement les
 *    mêmes points d'entrée forment un même composant, de proche en proche.
 *    Un fichier appelé aussi d'ailleurs sert plus de points d'entrée : il
 *    reste à part, c'est un composant partagé.
 * 3. Les fichiers d'un composant à contrat (une interface implémentée deux
 *    fois, lue dans le code) gardent leur nœud : un groupe calculé dont tous
 *    les fichiers sont les siens s'y fond.
 * 4. La classe, relative au déployable (E = ses points d'entrée exécutés) :
 *    `base` s'il sert au moins les trois quarts de E (avec E ≥ 4) ; sinon
 *    `own` si tous les points d'entrée qu'il sert ont leur fonction dans un
 *    même composant (le sien ou un autre), `shared` sinon. Un point d'entrée
 *    dont la fonction est dans un composant `base` (un index qui les déclare
 *    toutes) ne forme un groupe qu'avec lui-même.
 *
 * Le nom vient des fichiers : le nom du fichier seul ; le dossier quand le
 * groupe tient dans un dossier et en contient tous les fichiers exécutés,
 * sous-dossiers compris ;
 * sinon le fichier le plus appelé du groupe, suivi du nombre des autres.
 */

/** Fraction des points d'entrée du déployable au-delà de laquelle un composant est le socle commun. */
export const BASE_SHARE = 3 / 4;
/** En dessous, tout composant partagé serait le socle : la classe `base` n'a pas de sens. */
export const BASE_MIN_ENTRIES = 4;
/** Un déployable à un seul point d'entrée n'a rien à partager : pas de composants calculés. */
export const MIN_ENTRIES = 2;
const MAX_PROOF = 5;
const MAX_OCCURRENCES = 60;

export function attributeComponents(nodes: ArchNode[], edges: ArchEdge[], graph: FnGraph, reaches: Map<string, Reach>): ArchEdge[] {
  const out: ArchEdge[] = [];
  const used = new Set(nodes.map((n) => n.id));
  for (const node of nodes.filter((n) => n.level === "deployable" && n.files?.length)) {
    const entries = (node.facets.entrypoints ?? []).filter((e) => reaches.has(e.id));
    if (entries.length < MIN_ENTRIES) continue;
    const own = new Set((node.files ?? []).filter((f) => !graph.tests.has(f)));

    // 1. Qui sert qui.
    const served = new Map<string, Set<string>>();
    for (const e of entries) for (const f of reaches.get(e.id)!.files) if (own.has(f)) (served.get(f) ?? served.set(f, new Set()).get(f)!).add(e.id);
    const key = (f: string) => [...served.get(f)!].sort().join("\n");

    // Les appels entre fichiers servis : le compte et les lignes.
    const calls = new Map<string, Proof[]>();
    for (const f of served.keys()) for (const sp of graph.spans.get(f) ?? []) for (const c of graph.calls.get(fnId(sp)) ?? []) {
      const to = c.file ?? graph.byId.get(c.to!)?.path;
      if (!to || to === f || !served.has(to)) continue;
      const k = `${f}\0${to}`;
      (calls.get(k) ?? calls.set(k, []).get(k)!).push(c.proof);
    }

    // 2. Regrouper : appel dans un sens ou dans l'autre, mêmes points d'entrée servis.
    const parent = new Map([...served.keys()].map((f) => [f, f]));
    const find = (f: string): string => (parent.get(f) === f ? f : find(parent.get(f)!));
    const union = (a: string, b: string) => { const [x, y] = [find(a), find(b)]; if (x !== y) parent.set(x < y ? y : x, x < y ? x : y); };
    for (const k of calls.keys()) {
      const [a, b] = k.split("\0") as [string, string];
      if (key(a) === key(b)) union(a, b);
    }
    const groups = new Map<string, string[]>();
    for (const f of served.keys()) (groups.get(find(f)) ?? groups.set(find(f), []).get(find(f))!).push(f);

    // 3. Les composants à contrat de ce déployable : un groupe tout entier dans leurs fichiers s'y fond.
    const contracts = nodes.filter((n) => n.level === "component" && n.parent === node.id && n.facets.contract?.length);
    const home = new Map<string, string>(); // fichier → id du nœud composant
    const members = new Map<string, { node?: ArchNode; files: string[]; name?: { name: string; head: string } }>();
    for (const files of groups.values()) {
      const c = contracts.find((n) => files.every((f) => n.files?.includes(f)));
      if (c) {
        const m = members.get(c.id) ?? members.set(c.id, { node: c, files: [] }).get(c.id)!;
        m.files.push(...files);
        for (const f of files) home.set(f, c.id);
      }
    }
    const computed = [...groups.values()].filter((files) => !home.has(files[0]!));
    const handlers = new Map<string, number>();
    for (const e of entries) handlers.set(e.handler!.path, (handlers.get(e.handler!.path) ?? 0) + 1);
    const names = nameGroups(computed, served, calls, own, handlers);
    for (const [i, files] of computed.entries()) {
      let id = `${node.id}:${names[i]!.id}`;
      while (used.has(id)) id = `${id}'`;
      used.add(id);
      members.set(id, { files, name: names[i]! });
      for (const f of files) home.set(f, id);
    }

    // 4. Les points d'entrée servis, la classe, ce que le composant touche.
    const servesOf = (m: { files: string[] }) => [...new Set(m.files.flatMap((f) => [...served.get(f)!]))].sort();
    const isBase = (n: number) => entries.length >= BASE_MIN_ENTRIES && n >= BASE_SHARE * entries.length;
    // Le groupe d'un point d'entrée : le composant qui porte sa fonction ; s'il est le socle (un index qui déclare
    // toutes les fonctions), le point d'entrée n'a pas d'autre groupe que lui-même.
    const homeOf = (entry: string) => {
      const h = home.get(entries.find((e) => e.id === entry)!.handler!.path);
      return h && !isBase(servesOf(members.get(h)!).length) ? h : entry;
    };
    for (const [id, m] of members) {
      const files = m.files.sort();
      const serves = servesOf(m);
      const homes = new Set(serves.map(homeOf));
      const reach: ComponentFacet["reach"] = isBase(serves.length) ? "base" : homes.size === 1 ? "own" : "shared";
      const facet: ComponentFacet = {
        grouping: m.node ? "contract" : "calls",
        reach,
        entrypoints: serves,
        functions: files.reduce((n, f) => n + (graph.spans.get(f)?.length ?? 0), 0),
        ...touchesOf(node, edges, new Set(files)),
      };
      if (m.node) { m.node.facets.component = facet; continue; }
      const name = m.name!;
      nodes.push({
        id,
        name: name.name,
        level: "component",
        role: "module",
        parent: node.id,
        subtitle: `${count(files.length, "fichier")} · ${count(facet.functions, "fonction")} · ${serves.length} sur ${entries.length} points d'entrée`,
        status: "proposed",
        proof: [{ path: name.head, line: graph.spans.get(name.head)?.[0]?.start ?? 1, source: "syntax" }],
        files,
        facets: { component: facet },
      });
    }

    // Les appels entre composants : un lien par paire, ses lignes.
    const between = new Map<string, Proof[]>();
    for (const [k, proofs] of calls) {
      const [a, b] = k.split("\0") as [string, string];
      const [x, y] = [home.get(a), home.get(b)];
      if (!x || !y || x === y) continue;
      const kk = `${x}\0${y}`;
      (between.get(kk) ?? between.set(kk, []).get(kk)!).push(...proofs);
    }
    for (const [k, proofs] of [...between].sort(([a], [b]) => a.localeCompare(b))) {
      const [from, to] = k.split("\0") as [string, string];
      const occ = dedupe(proofs);
      out.push({ id: `${from}>call>${to}`, from, to, kind: "call", count: occ.length, occurrences: occ.slice(0, MAX_OCCURRENCES) });
    }
  }
  return out;
}

/** Ce que les fonctions d'un composant lisent, écrivent, publient et appellent : les occurrences des liens du déployable écrites dans ses fichiers. */
function touchesOf(node: ArchNode, edges: ArchEdge[], files: Set<string>): Pick<ComponentFacet, "touches"> {
  const touches: ComponentFacet["touches"] = [];
  for (const e of edges) {
    if (e.from !== node.id) continue;
    const here = e.occurrences.filter((o) => files.has(o.path));
    if (!here.length) continue;
    touches.push({
      kind: e.kind, node: e.to,
      ...(e.target?.entity ? { entity: e.target.entity } : {}),
      ...(e.target?.topic ? { topic: e.target.topic } : {}),
      count: here.length,
      proof: here.slice(0, MAX_PROOF).map(({ entrypoints: _, ...p }: Occurrence) => p),
    });
  }
  return { touches };
}

/**
 * Le nom de chaque groupe, tiré de ses fichiers, et un `id` stable d'une carte
 * à l'autre (un chemin). Deux groupes dont la tête porte le même nom (`get.ts`)
 * gardent chacun autant de dossiers parents qu'il faut pour se distinguer
 * (`bookings/get.ts`).
 */
function nameGroups(groups: string[][], served: Map<string, Set<string>>, calls: Map<string, Proof[]>, own: Set<string>, handlers: Map<string, number>): { id: string; name: string; head: string }[] {
  const dirOf = (f: string) => (f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "");
  const tail = (path: string, depth: number) => path.split("/").slice(-depth).join("/");
  const shapes = groups.map((files) => {
    const set = new Set(files);
    // La tête : le fichier qui porte le plus de fonctions de points d'entrée, puis le plus appelé
    // depuis l'extérieur du groupe, puis le plus servi, puis le premier.
    const inbound = (f: string) => [...calls].filter(([k]) => { const [a, b] = k.split("\0"); return b === f && !set.has(a!); }).reduce((n, [, p]) => n + p.length, 0);
    const head = [...files].sort((a, b) => (handlers.get(b) ?? 0) - (handlers.get(a) ?? 0) || inbound(b) - inbound(a) || served.get(b)!.size - served.get(a)!.size || a.localeCompare(b))[0]!;
    const dirs = new Set(files.map(dirOf));
    const dir = [...dirs][0]!;
    // Le dossier nomme le groupe s'il en contient tous les fichiers exécutés, sous-dossiers compris.
    const whole = files.length > 1 && dirs.size === 1 && !!dir && [...own].filter((f) => f.startsWith(`${dir}/`) && served.has(f)).every((f) => set.has(f));
    // Ce qui nomme le groupe : le dossier entier, ou le fichier de tête ; et ce qui s'ajoute après.
    return whole ? { head, path: dir, suffix: "/", id: `${dir}/` }
      : { head, path: head, suffix: files.length > 1 ? ` +${files.length - 1}` : "", id: files.length > 1 ? `${head}+${files.length - 1}` : head };
  });
  const depth = shapes.map(() => 1);
  const label = (i: number) => `${tail(shapes[i]!.path, depth[i]!)}${shapes[i]!.suffix}`;
  for (let changed = true; changed;) {
    changed = false;
    const seen = new Map<string, number[]>();
    // Le même fichier ou dossier de tête, quel que soit le reste du nom : `stripe.ts` et `stripe.ts +1` se confondent.
    const named = (i: number) => tail(shapes[i]!.path, depth[i]!);
    shapes.forEach((_, i) => seen.set(named(i), [...(seen.get(named(i)) ?? []), i]));
    for (const list of seen.values()) if (list.length > 1) for (const i of list) {
      if (depth[i]! < shapes[i]!.path.split("/").length) { depth[i]!++; changed = true; }
    }
  }
  return shapes.map((x, i) => ({ id: x.id, name: label(i), head: x.head }));
}

function count(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function dedupe(proof: Proof[]): Proof[] {
  const seen = new Set<string>();
  return proof.filter((p) => (seen.has(`${p.path}:${p.line}`) ? false : (seen.add(`${p.path}:${p.line}`), true)));
}
