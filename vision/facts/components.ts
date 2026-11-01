import type { ArchEdge, ArchNode, ComponentFacet, ComponentLayer, Occurrence, Proof } from "../arch/types.js";
import { fnId, type FnGraph, type Reach } from "./fn-graph.js";

/**
 * Les modules d'un déployable (docs/fonctionnement/05-le-modele-neutre.md) : le découpage que l'équipe a
 * rangé dans ses dossiers, et ce que l'exécution en fait. Un ingénieur cherche d'abord « où est le
 * paiement », puis « où est l'accès à la base » : le module répond à la première question, la couche de
 * chaque fichier à la seconde.
 *
 * 1. Chaque fichier du déployable sert les points d'entrée dont la portée (entry-reach.ts) l'exécute. Un
 *    fichier qu'aucun n'exécute n'entre dans aucun module.
 * 2. Le module d'un fichier : son dossier de premier niveau sous la racine du code du déployable
 *    (`src/bookings/create.ts` → `bookings`) ; un fichier posé à la racine forme un module à lui seul,
 *    nommé sans extension (`db`). Un dossier qui porte plus de la moitié des fichiers servis et range
 *    ses fichiers dans des sous-dossiers se découpe un cran plus bas (`api/controllers`, `api/routes`).
 * 3. Un composant à contrat (une interface implémentée deux fois, lue dans le code) garde son nœud : le
 *    module qui contient tous ses fichiers servis s'y fond, et lui donne ses fichiers.
 * 4. Ce qu'il sert, relatif au déployable (E = ses points d'entrée exécutés) : `base` s'il sert au moins
 *    les trois quarts de E (avec E ≥ 4) ; `own` si tous les points d'entrée qu'il sert ont leur fonction
 *    dans un même module, `shared` sinon.
 * 5. La couche de chaque fichier, lue dans les faits : `entry` s'il porte la fonction ou la déclaration
 *    d'un point d'entrée, `data` s'il ouvre, lit ou écrit un stockage, `external` s'il construit le client
 *    d'un service extérieur ou d'une file, l'appelle ou publie un message, `logic` sinon.
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

    // 2. Regrouper par dossier, sous la racine du code du déployable.
    const groups = folderGroups([...served.keys()]);

    // 3. Les composants à contrat de ce déployable : un groupe tout entier dans leurs fichiers s'y fond.
    const contracts = nodes.filter((n) => n.level === "component" && n.parent === node.id && n.facets.contract?.length);
    const home = new Map<string, string>(); // fichier → id du nœud composant
    const members = new Map<string, { node?: ArchNode; files: string[]; name?: { name: string; head: string } }>();
    // Un module se fond dans un contrat quand il en est le dossier : tous les fichiers servis du contrat sont dans ce module.
    for (const files of groups.values()) {
      const c = contracts.find((n) => (n.files ?? []).filter((f) => served.has(f)).length > 0 && (n.files ?? []).filter((f) => served.has(f)).every((f) => files.includes(f)));
      if (c) {
        const m = members.get(c.id) ?? members.set(c.id, { node: c, files: [] }).get(c.id)!;
        m.files.push(...files);
        for (const f of files) home.set(f, c.id);
      }
    }
    const computed = [...groups].filter(([, files]) => !files.every((f) => home.has(f))).map(([name, files]) => ({ name, files: files.filter((f) => !home.has(f)) }));
    const handlers = new Map<string, number>();
    for (const e of entries) handlers.set(e.handler!.path, (handlers.get(e.handler!.path) ?? 0) + 1);
    const names = computed.map(({ name, files }) => ({ id: name, name, head: [...files].sort((a, b) => (handlers.get(b) ?? 0) - (handlers.get(a) ?? 0) || a.localeCompare(b))[0]! }));
    for (const [i, { files }] of computed.entries()) {
      let id = `${node.id}:${names[i]!.id}`;
      while (used.has(id)) id = `${id}'`;
      used.add(id);
      members.set(id, { files, name: names[i]! });
      for (const f of files) home.set(f, id);
    }

    // 5. La couche de chaque fichier : ce qu'il fait, lu dans les faits.
    const entryFiles = new Set(entries.flatMap((e) => [e.handler!.path, e.proof.path]));
    const storeIds = new Set(nodes.filter((n) => n.role === "store").map((n) => n.id));
    // Le fichier qui ouvre la connexion à un stockage, ou construit le client d'un service extérieur ou d'une file.
    const opens = (roles: string[]) => new Set(nodes.filter((n) => roles.includes(n.role) && n.level !== "component").flatMap((n) => n.proof.map((p) => p.path)));
    const dataClients = opens(["store"]), outClients = opens(["external", "channel", "managed"]);
    const touched = (f: string, ok: (e: ArchEdge) => boolean) => edges.some((e) => e.from === node.id && ok(e) && e.occurrences.some((o) => o.path === f));
    const layerOf = (f: string): ComponentLayer => entryFiles.has(f) ? "entry"
      : dataClients.has(f) || touched(f, (e) => (e.kind === "read" || e.kind === "write") && storeIds.has(e.to)) ? "data"
      : outClients.has(f) || touched(f, (e) => e.kind === "request" || e.kind === "use" || e.kind === "message") ? "external"
      : "logic";

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
        grouping: m.node ? "contract" : "folder",
        reach,
        entrypoints: serves,
        functions: files.reduce((n, f) => n + (graph.spans.get(f)?.length ?? 0), 0),
        ...touchesOf(node, edges, new Set(files)),
        layers: Object.fromEntries(files.map((f) => [f, layerOf(f)])),
      };
      if (m.node) { m.node.facets.component = facet; continue; }
      const name = m.name!;
      nodes.push({
        id,
        name: name.name,
        level: "component",
        role: "module",
        parent: node.id,
        subtitle: `${count(files.length, "fichier")}, utilisé par ${serves.length} points d'entrée sur ${entries.length}`,
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
 * Les modules d'un déployable par dossier : le dossier de premier niveau sous la racine commune des fichiers qu'il exécute,
 * découpé un cran plus bas quand il porte plus de la moitié des fichiers et range les siens dans des
 * sous-dossiers ; un fichier à la racine est un module à lui seul, nommé sans extension.
 */
export function folderGroups(files: string[]): Map<string, string[]> {
  const dirs = files.map((f) => f.split("/").slice(0, -1));
  let root = dirs[0] ?? [];
  for (const d of dirs) { let i = 0; while (i < root.length && i < d.length && root[i] === d[i]) i++; root = root.slice(0, i); }
  const rel = (f: string) => f.split("/").slice(root.length);
  const stem = (x: string) => x.replace(/\.[cm]?[jt]sx?$/, "");
  const first = (f: string) => { const r = rel(f); return r.length > 1 ? r[0]! : stem(r[0]!); };
  const byFirst = new Map<string, string[]>();
  for (const f of files) (byFirst.get(first(f)) ?? byFirst.set(first(f), []).get(first(f))!).push(f);
  const out = new Map<string, string[]>();
  for (const [name, list] of [...byFirst].sort(([a], [b]) => a.localeCompare(b))) {
    const deep = list.filter((f) => rel(f).length > 2);
    if (list.length > files.length / 2 && files.length >= 6 && deep.length) {
      for (const f of list) {
        const r = rel(f);
        const k = r.length > 2 ? `${name}/${r[1]}` : name;
        (out.get(k) ?? out.set(k, []).get(k)!).push(f);
      }
    } else out.set(name, list);
  }
  return out;
}

function count(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function dedupe(proof: Proof[]): Proof[] {
  const seen = new Set<string>();
  return proof.filter((p) => (seen.has(`${p.path}:${p.line}`) ? false : (seen.add(`${p.path}:${p.line}`), true)));
}
