import { CATALOG, techsForImage, techsForPackage, type CatalogEntry } from "../stack/catalog.js";
import type { ArchNode, Coverage, EdgeKind, Occurrence, Proof } from "../arch/types.js";
import type { Database, Value } from "./datalog.js";

/**
 * Ce que le dépôt contient mais qu'aucun pack ne lit, mis sur la carte au lieu
 * d'en disparaître : la carte dit « non lu », jamais « rien ».
 *
 *   - une app faite avec un framework sans pack (Next.js, SvelteKit, Nuxt…) :
 *     un paquet dont le code importe ce framework et dont aucun programme lu ne
 *     lance le code ;
 *   - une image de conteneur que le dépôt fait tourner sans la construire, et
 *     qu'aucun pack ne reconnaît (un moteur de recherche, un proxy) ;
 *   - un service qu'on appelle par sa bibliothèque (cloud, IA, serveur de
 *     données qui a sa propre image) sans pack pour le lire.
 *
 * Chaque élément porte sa technologie et la ligne qui le prouve ; il n'a ni
 * point d'entrée ni lien inventé. Un lien vers lui ne vient que d'un import
 * lu dans le code d'un programme (`use`).
 */

const CODE = /\.(m?[jt]sx?|cjs|cts|svelte|vue|astro)$/;
/** Une bibliothèque qui parle à un service : on l'appelle, elle n'est pas le service. */
const SERVICE_CATEGORIES = new Set(["cloud", "ai"]);

export interface UnreadInput {
  db: Database;
  present: Set<string>;
  /** Les fichiers que les programmes lus exécutent : leur code est compris. */
  reached: Set<string>;
  /** Les technologies que les packs chargés lisent. */
  packTech: Set<string>;
  nodes: ArchNode[];
  usedIds: Set<string>;
  /** Les programmes lus dont le code contient ce fichier. */
  deployablesOf: (file: string) => string[];
  edge: (from: string, to: string, kind: EdgeKind, target: undefined, occ: Occurrence) => void;
}

export function addUnread(input: UnreadInput): Coverage["gaps"] {
  const { db, present, reached, packTech, nodes, usedIds } = input;
  const rows = (rel: string) => db.get(rel);
  const s = (v: Value | undefined) => String(v);
  const gaps: Coverage["gaps"] = [];
  const freeId = (base: string) => {
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}:${i}`;
    usedIds.add(id);
    return id;
  };
  const unread = (e: CatalogEntry) => !packTech.has(e.id);
  // Les technologies qui sont déjà un élément de la carte (un stockage, un service extérieur), pas celles qu'un programme emploie.
  const owned = new Set(nodes.filter((n) => n.level === "system" || ["store", "channel", "managed"].includes(n.role)).flatMap((n) => n.tech ?? []));

  /* --- Les apps d'un framework sans pack ------------------------------------- */
  const packages = rows("pkg_name").map((t) => ({ manifest: s(t.args[0]), name: s(t.args[1]), proof: t.proof[0]! }))
    .map((p) => ({ ...p, dir: p.manifest.includes("/") ? p.manifest.slice(0, p.manifest.lastIndexOf("/") + 1) : "" }));
  const ownerOf = (file: string) => packages.filter((p) => file.startsWith(p.dir)).sort((a, b) => b.dir.length - a.dir.length)[0];
  const imports = rows("imports_pkg");
  for (const pkg of [...packages].sort((a, b) => a.dir.localeCompare(b.dir))) {
    const files = [...present].filter((f) => CODE.test(f) && ownerOf(f) === pkg).sort();
    if (!files.length || files.some((f) => reached.has(f))) continue;
    const mine = new Set(files);
    const frameworks = new Map<string, { entry: CatalogEntry; proof: Proof }>();
    for (const t of imports) {
      if (!mine.has(s(t.args[0]))) continue;
      for (const e of techsForPackage("npm", s(t.args[2]))) if (e.category === "framework" && unread(e) && !frameworks.has(e.id)) frameworks.set(e.id, { entry: e, proof: t.proof[0]! });
    }
    if (!frameworks.size) continue;
    const names = [...frameworks.values()].map((f) => f.entry.name);
    const id = freeId(serviceBuilding(rows, pkg.dir) ?? shortName(pkg.name));
    nodes.push({
      id, name: id, level: "deployable", role: "app", tech: [...frameworks.keys()].sort(),
      subtitle: `${names.join(", ")} : non lu`, status: "extracted", proof: [pkg.proof], files, facets: {},
    });
    for (const f of frameworks.values()) gaps.push({ kind: "pack_missing", subject: f.entry.name, count: files.length, proof: f.proof, where: files.map((path) => ({ path, line: 0, source: "syntax" as const })) });
  }

  /* --- Les images lancées sans être construites, qu'aucun pack ne reconnaît ---- */
  const built = new Set(rows("unit_build").map((t) => `${s(t.args[0])}\0${s(t.args[1])}`));
  const known = new Set(rows("image_store").map((t) => s(t.args[0])));
  // L'image que le dépôt publie lui-même (`open-archiver`) : ses programmes sont déjà sur la carte.
  const own = new Set(packages.map((p) => shortName(p.name)));
  const images = new Map<string, { svc: string; image: string; entry?: CatalogEntry; proof: Proof }>();
  for (const t of rows("unit_image")) {
    const [file, svc, image] = t.args.map(s) as [string, string, string];
    if (built.has(`${file}\0${svc}`) || known.has(image) || own.has(image) || /^(node|bun|deno|python|alpine|debian|ubuntu|busybox)$/.test(image)) continue;
    const entry = techsForImage(image)[0] ?? CATALOG.find((e) => e.images?.some((p) => p.split("/").pop() === image));
    if (entry && (!unread(entry) || owned.has(entry.id))) continue;
    const key = entry?.id ?? image;
    if (!images.has(key)) images.set(key, { svc, image, ...(entry ? { entry } : {}), proof: t.proof[0]! });
  }
  const byTech = new Map<string, string>();
  for (const [key, img] of [...images].sort(([a], [b]) => a.localeCompare(b))) {
    const id = freeId(img.svc);
    nodes.push({
      id, name: img.svc, level: "deployable", role: img.entry?.category === "database" ? "store" : "service",
      ...(img.entry ? { tech: [img.entry.id] } : {}),
      subtitle: `image ${img.image} : non lue`, status: "extracted", proof: [img.proof], facets: {},
    });
    byTech.set(key, id);
  }

  /* --- Les services appelés par leur bibliothèque, sans pack ------------------- */
  const calls = new Map<string, { entry: CatalogEntry; occ: { from: string; proof: Proof }[] }>();
  for (const t of imports) {
    const file = s(t.args[0]);
    for (const e of techsForPackage("npm", s(t.args[2]))) {
      const service = SERVICE_CATEGORIES.has(e.category) || (e.category === "database" && (e.images?.length ?? 0) > 0);
      if (!service || !unread(e) || owned.has(e.id)) continue;
      const c = calls.get(e.id) ?? calls.set(e.id, { entry: e, occ: [] }).get(e.id)!;
      for (const from of input.deployablesOf(file)) c.occ.push({ from, proof: t.proof[0]! });
    }
  }
  for (const [tech, c] of [...calls].sort(([a], [b]) => a.localeCompare(b))) {
    if (!c.occ.length) continue;
    let to = byTech.get(tech);
    if (!to) {
      to = freeId(tech);
      nodes.push({ id: to, name: c.entry.name, level: "system", role: "external", tech: [tech], subtitle: "non lu : aucun pack", status: "extracted", proof: [c.occ[0]!.proof], facets: {} });
    }
    for (const o of c.occ) input.edge(o.from, to, "use", undefined, { ...o.proof });
  }
  return gaps;
}

/** Le service d'un manifeste qui construit l'image depuis ce dossier : son nom est celui qu'emploie l'équipe. */
function serviceBuilding(rows: (rel: string) => readonly { args: readonly Value[] }[], dir: string): string | undefined {
  const ctx = rows("unit_ctx").find((t) => normDir(String(t.args[2])) === dir);
  return ctx ? String(ctx.args[1]) : undefined;
}

function normDir(p: string): string {
  const d = p.replace(/^\.\/?/, "").replace(/\/?$/, "/");
  return d === "/" ? "" : d;
}

/** `@open-archiver/backend` → `backend`. */
export function shortName(pkg: string): string {
  return pkg.replace(/^@[^/]+\//, "");
}
