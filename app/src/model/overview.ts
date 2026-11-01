import type { ArchNode, Finding, FindingCode, MapPayload, Proof } from "../api/types";
import { FINDING_TONE, plural } from "./words";

/**
 * Ce que la planche 01 (Vue d'ensemble) montre, calculé depuis la carte. Chaque nombre, chaque case et
 * chaque ligne vient d'un fait du moteur ; rien n'est écrit pour l'exemple.
 */

export const PROGRAM_ROLES = new Set(["app", "service", "function", "worker", "job", "binary"]);
export const RESOURCE_ROLES = new Set(["store", "channel", "managed"]);
export const isUnread = (n: ArchNode) => /non lue?/.test(n.subtitle ?? "");

const programs = (p: MapPayload) => p.model.nodes.filter((n) => n.level === "deployable" && PROGRAM_ROLES.has(n.role));
const entries = (p: MapPayload) => programs(p).flatMap((n) => (n.facets.entrypoints ?? []).filter((e) => e.kind !== "main").map((e) => ({ e, n })));

/** Les compteurs de la barre latérale : blocs de la carte, constats d'accès, tables, tâches planifiées, packs manquants. */
export function sidebarCounts(p: MapPayload): Partial<Record<string, { n: number; tone?: "critical" | "signal" }>> {
  const blocks = p.model.nodes.filter((n) => n.level === "deployable").length;
  const access = p.model.findings.filter((f) => f.code === "unguarded_route").length;
  const tables = p.model.nodes.flatMap((n) => n.facets.data?.entities ?? []).length;
  const schedules = entries(p).filter((x) => x.e.kind === "schedule").length;
  const missing = p.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing").length;
  const twice = p.model.findings.some((f) => f.code === "scheduled_on_every_instance");
  return {
    carte: { n: blocks },
    ...(access ? { acces: { n: access, tone: "critical" as const } } : {}),
    ...(tables ? { donnees: { n: tables } } : {}),
    ...(schedules ? { taches: { n: schedules, ...(twice ? { tone: "signal" as const } : {}) } } : {}),
    ...(missing ? { packs: { n: missing, tone: "signal" as const } } : {}),
  };
}

/** Le salut de la planche : « Bonsoir, Mouhamed ». */
export function greeting(user: string | undefined, now = new Date()): string {
  const h = now.getHours();
  const word = h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
  const first = user?.trim().split(/\s+/)[0];
  return first ? `${word}, ${first}` : word;
}

/** La ligne sous le salut : les technologies principales, et ce qui est à savoir. */
export function headline(p: MapPayload): { techs: string; known: string } {
  // Les technologies du programme principal d'abord : son framework, sa base, puis ce qu'il appelle (le paiement…).
  const PRIORITY = ["backend", "framework", "database", "payments", "cloud", "ai"];
  const lead = [...programs(p)].filter((n) => !isUnread(n)).sort((a, b) => (b.facets.entrypoints?.length ?? 0) - (a.facets.entrypoints?.length ?? 0));
  const ids = [...new Set(lead.flatMap((n) => n.tech ?? []))].filter((t) => !/orm|drizzle|prisma|bullmq|cron/i.test(t));
  const main = ids.map((t) => p.tech[t]).filter((t) => t && PRIORITY.includes(t.category ?? ""))
    .sort((a, b) => PRIORITY.indexOf(a!.category ?? "") - PRIORITY.indexOf(b!.category ?? "")).map((t) => t!.name);
  const all = p.model.findings.length;
  const critical = p.model.findings.filter((f) => FINDING_TONE[f.code] === "critical").length;
  return { techs: main.slice(0, 3).join(", "), known: `${plural(all, "point à savoir", "points à savoir")}, dont ${plural(critical, "constat", "constats")}.` };
}

/* --- La carte noire --------------------------------------------------------------------------- */

export interface Hero {
  kind: "unread" | "finding";
  tag: string;
  /** Le titre : la première ligne peut porter un nom de code, la seconde dit ce qui en dépend. */
  lead: string; code?: string; second?: string;
  text: string;
  side: { title: string; note: string; rows: { idx: string; code: string; what: string; tag: string; proof?: Proof }[]; more?: string };
}

/**
 * Ce qui demande une décision maintenant : une technologie que le code emploie et qu'aucun pack ne lit
 * (l'écrivain de packs peut l'apprendre) ; sinon le constat le plus grave.
 */
export function overviewHero(p: MapPayload): Hero | undefined {
  const gaps = p.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing").sort((a, b) => b.count - a.count);
  const g = gaps[0];
  if (g) {
    const where = g.where ?? (g.proof ? [g.proof] : []);
    const users = programs(p).filter((n) => (n.files ?? []).some((f) => where.some((w) => w.path === f)));
    const blocks = p.model.nodes.filter((n) => isUnread(n) && n.tech?.some((t) => p.tech[t]?.name === g.subject));
    const second = blocks.length
      ? `${blocks.map((b) => b.name).join(" et ")} tourne${blocks.length > 1 ? "nt" : ""} sans que la carte sache ce que ${blocks.length > 1 ? "leur" : "son"} code fait.`
      : users.length ? `${users.map((u) => u.name).join(", ")} l'emploie${users.length > 1 ? "nt" : ""}, et la carte ne dit pas ce qu'il${users.length > 1 ? "s" : ""} en fai${users.length > 1 ? "nt" : "t"}.` : undefined;
    const n = where.length || g.count;
    return {
      kind: "unread", tag: `Non lu${g.proof && g.proof.line > 0 ? `, ${g.proof.path}:${g.proof.line}` : ""}`,
      lead: "VisionLayer ne lit pas ", code: g.subject, ...(second ? { second } : {}),
      text: `Muse peut écrire le pack depuis la documentation de ${g.subject}, jamais depuis ce projet. Ses tests tournent à part ; rien n'est chargé avant qu'ils passent, et le retirer rend la carte d'avant.`,
      side: {
        title: `Où le code emploie ${g.subject}`, note: plural(n, "fichier", "fichiers"),
        rows: where.slice(0, 4).map((w, i) => ({ idx: String(i + 1).padStart(2, "0"), code: w.text?.trim() || w.path, what: w.path, tag: "non lu", ...(w.line > 0 ? { proof: w } : {}) })),
        ...(where.length > 4 ? { more: `Voir les ${where.length - 4} autres ›` } : gaps.length > 1 ? { more: `et ${plural(gaps.length - 1, "autre technologie non lue", "autres technologies non lues")} ›` } : {}),
      },
    };
  }
  const f = byGravity(p.model.findings)[0];
  if (!f) return undefined;
  return {
    kind: "finding", tag: `Constat, ${f.proof[0]!.path}:${f.proof[0]!.line}`,
    lead: sentence(f.message), text: rest(f.message),
    side: {
      title: "Les lignes qui le prouvent", note: plural(f.proof.length, "ligne", "lignes"),
      rows: f.proof.slice(0, 4).map((x, i) => ({ idx: String(i + 1).padStart(2, "0"), code: x.text?.trim() || x.path, what: `${x.path}:${x.line}`, tag: x.pack ?? "lu", proof: x })),
      ...(f.proof.length > 4 ? { more: `Voir les ${f.proof.length - 4} autres ›` } : {}),
    },
  };
}

const ORDER: FindingCode[] = ["unguarded_route", "race_read_then_write", "personal_data_logged", "write_then_enqueue", "scheduled_on_every_instance", "missing_timeout"];
const rank = (f: Finding) => { const i = ORDER.indexOf(f.code); return i < 0 ? ORDER.length + (FINDING_TONE[f.code] === "critical" ? 0 : 1) : i; };
export const byGravity = (list: Finding[]) => [...list].sort((a, b) => rank(a) - rank(b));

/** La première proposition d'un constat fait son titre ; la suite, son explication. */
export function sentence(message: string): string {
  const i = message.indexOf(" : ");
  return (i > 0 ? message.slice(0, i) : message).replace(/^« (.*) »$/, "$1").replace(/^[a-zà-ÿ]/, (c) => c.toUpperCase());
}
export function rest(message: string): string {
  const i = message.indexOf(" : ");
  return i > 0 ? message.slice(i + 3).replace(/^./, (c) => c.toUpperCase()) : "";
}

/* --- Le bandeau de faits ---------------------------------------------------------------------- */

type Cell = "" | "q" | "e" | "s" | "c";
/** Une petite forme : des cases (`vl-mini`) ou des barres (`vl-bars`), chacune avec sa classe d'état. */
export type Mini = { kind: "tiles"; cells: Cell[] } | { kind: "bars"; bars: { cls: "" | "q" | "s" | "c"; height: number }[] };
export interface Stat { label: string; value: string; unit?: string; mini: Mini; note: string }

const pad = (cells: Cell[], to: number): Cell[] => [...cells, ...Array<Cell>(Math.max(0, to - cells.length)).fill("e")];

export function overviewStats(p: MapPayload, claims: { total: number; contradicted: number }): Stat[] {
  const progs = programs(p);
  const deployables = p.model.nodes.filter((n) => n.level === "deployable");
  const many = progs.filter((n) => (n.instances?.min ?? 1) > 1);
  const deployNote = many.length
    ? `${many.map((n) => n.name).join(", ")} sur ${many[0]!.instances!.min} machines`
    : `${plural(progs.length, "programme", "programmes")}, ${plural(deployables.length - progs.length, "ressource", "ressources")}`;
  const routes = entries(p).filter((x) => x.e.kind === "http" || x.e.kind === "rpc");
  const uncalled = p.model.findings.filter((f) => f.code === "uncalled_entry").length;
  const flagged = new Set(p.model.findings.filter((f) => FINDING_TONE[f.code] === "critical").flatMap((f) => f.proof.map((x) => `${x.path}:${x.line}`)));
  const bars = routes.map(({ e }) => {
    const read = /^(GET|HEAD|OPTIONS) /.test(e.key);
    const bad = flagged.has(`${e.proof.path}:${e.proof.line}`);
    return { cls: (bad ? "c" : read ? "q" : "") as "" | "q" | "c", height: read ? 45 : 100, read };
  }).sort((a, b) => Number(b.read) - Number(a.read)).map(({ cls, height }) => ({ cls, height }));
  const entities = p.model.nodes.flatMap((n) => n.facets.data?.entities ?? []);
  const touched = new Set(p.model.edges.filter((e) => e.target?.entity).map((e) => e.target!.entity!));
  const idle = entities.filter((x) => !touched.has(x.name));
  const schedules = progs.flatMap((n) => (n.facets.entrypoints ?? []).filter((e) => e.kind === "schedule").map(() => n.instances?.min ?? 1));
  const times = schedules.length ? Math.max(...schedules) : 1;
  return [
    {
      label: "Déployables", value: String(deployables.length),
      mini: { kind: "tiles", cells: pad(deployables.map((n): Cell => (isUnread(n) ? "s" : RESOURCE_ROLES.has(n.role) ? "q" : "")), 9) },
      note: deployNote,
    },
    {
      label: "Points d'entrée", value: String(routes.length || entries(p).length), unit: routes.length ? "routes" : "entrées",
      mini: { kind: "bars", bars: bars.length ? bars : [{ cls: "q", height: 30 }] },
      note: uncalled ? `${uncalled} qu'aucun code du dépôt n'appelle` : "toutes appelées dans le dépôt",
    },
    {
      label: "Tables", value: String(entities.length),
      mini: { kind: "tiles", cells: pad(entities.map((x): Cell => (touched.has(x.name) ? "" : "s")), 15) },
      note: idle.length ? `${idle.slice(0, 2).map((x) => x.name).join(", ")} : ni lue${idle.length > 1 ? "s" : ""} ni écrite${idle.length > 1 ? "s" : ""}` : entities.length ? "toutes lues ou écrites" : "aucune table lue",
    },
    {
      label: "Tâches planifiées", value: String(schedules.length), ...(times > 1 ? { unit: `× ${times}` } : {}),
      mini: { kind: "tiles", cells: pad(schedules.flatMap((k): Cell[] => ["", ...Array<Cell>(k - 1).fill("s"), "e"]), 9) },
      note: !schedules.length ? "aucune" : times > 1 ? `Chacune tourne ${times} fois` : "Chacune tourne une fois",
    },
    {
      label: "Règles déclarées", value: String(claims.total),
      mini: { kind: "tiles", cells: pad([...Array<Cell>(claims.contradicted).fill("c"), ...Array<Cell>(Math.max(0, claims.total - claims.contradicted)).fill("q")], 12) },
      note: claims.total ? (claims.contradicted ? `${claims.contradicted} contredite${claims.contradicted > 1 ? "s" : ""} par le code` : "toutes tiennent contre le code") : "aucune règle déclarée",
    },
  ];
}

/* --- La grille de couverture ------------------------------------------------------------------ */

export type TileState = "i" | "q" | "s" | "c";
export const TILE_LABEL: Record<TileState, string> = { i: "lu", q: "lu, sans fait", s: "à surveiller", c: "constat" };
export interface Tile { path: string; state: TileState; what: string }
export interface Folder { name: string; tiles: Tile[] }

/**
 * Une colonne par dossier, une case par fichier (S4). Lu : un programme lu l'exécute. Lu, sans fait :
 * analysé, rattaché à aucun programme (un test, une configuration). À surveiller : non lu, ou un point
 * d'hygiène. Constat : une ligne de ce fichier fonde un constat.
 */
export function coverage(p: MapPayload): { folders: Folder[]; understood: number; total: number; biggest?: Folder; first?: Tile } {
  const progs = programs(p).filter((n) => !isUnread(n));
  const owner = new Map<string, string>();
  for (const n of progs) for (const f of n.files ?? []) if (!owner.has(f)) owner.set(f, n.name);
  const findings = new Map<string, Finding>();
  for (const f of byGravity(p.model.findings)) for (const x of f.proof) if (!findings.has(x.path)) findings.set(x.path, f);
  const unread = new Map<string, string>();
  for (const g of p.model.coverage.flatMap((c) => c.gaps)) {
    if (g.kind !== "language_not_read" && g.kind !== "pack_missing") continue;
    for (const w of g.where ?? []) if (!unread.has(w.path)) unread.set(w.path, g.kind === "pack_missing" ? `emploie ${g.subject}, sans pack` : `${g.subject} : langage non lu`);
  }
  const all = [...new Set([...p.files, ...unread.keys()])].filter((f) => !/(^|\/)(node_modules|dist)\//.test(f)).sort();
  const tile = (path: string): Tile => {
    const f = findings.get(path);
    if (f && FINDING_TONE[f.code] === "critical") return { path, state: "c", what: sentence(f.message) };
    if (unread.has(path)) return { path, state: "s", what: unread.get(path)! };
    if (f) return { path, state: "s", what: sentence(f.message) };
    const by = owner.get(path);
    return by ? { path, state: "i", what: `exécuté par ${by}` } : { path, state: "q", what: "analysé, aucun programme lu ne l'exécute" };
  };
  const folders = [...columns(all)].map(([name, files]) => ({ name, tiles: files.map(tile) }));
  const biggest = [...folders].sort((a, b) => b.tiles.length - a.tiles.length)[0];
  const first = folders.flatMap((d) => d.tiles).find((t) => t.state === "c") ?? folders.flatMap((d) => d.tiles).find((t) => t.state === "s");
  return { folders, understood: all.filter((f) => owner.has(f)).length, total: all.length, ...(biggest ? { biggest } : {}), ...(first ? { first } : {}) };
}

/**
 * Les colonnes : le dossier de premier niveau sous la racine commune ; un dossier qui porte plus de la moitié
 * des fichiers et range les siens dans des sous-dossiers se découpe un cran plus bas (`src` donne `auth`,
 * `bookings`…, et `src` pour ses fichiers posés à sa racine) ; au-delà de 14 colonnes, les plus petites se
 * regroupent dans « autres ».
 */
function columns(files: string[]): Map<string, string[]> {
  const root = commonDir(files);
  // Un dossier qui porte plus de la moitié des fichiers se découpe, autant de crans qu'il le faut (`src/app/…`).
  const split = (list: string[], depth: number, prefix: string, out: Map<string, string[]>) => {
    const by = new Map<string, string[]>();
    for (const f of list) {
      const r = f.slice(root.length).split("/");
      const k = r.length > depth + 1 ? r[depth]! : prefix || "autres";
      (by.get(k) ?? by.set(k, []).get(k)!).push(f);
    }
    for (const [k, l] of by) {
      const deeper = l.some((f) => f.slice(root.length).split("/").length > depth + 2);
      if (k !== prefix && k !== "autres" && depth < 4 && l.length > files.length / 2 && deeper) split(l, depth + 1, k, out);
      else (out.get(k) ?? out.set(k, []).get(k)!).push(...l);
    }
  };
  const out = new Map<string, string[]>();
  split(files, 0, "", out);
  const sorted = [...out].sort((a, b) => (a[0] === "autres" ? 1 : b[0] === "autres" ? -1 : 0));
  if (sorted.length <= 12) return new Map(sorted);
  const keep = [...sorted].filter(([k]) => k !== "autres").sort((a, b) => b[1].length - a[1].length).slice(0, 11).map(([k]) => k);
  const res = new Map(sorted.filter(([k]) => keep.includes(k)));
  res.set("autres", sorted.filter(([k]) => !keep.includes(k)).flatMap(([, v]) => v));
  return res;
}

function commonDir(files: string[]): string {
  if (!files.length) return "";
  let parts = files[0]!.split("/").slice(0, -1);
  for (const f of files) {
    const d = f.split("/").slice(0, -1);
    let i = 0;
    while (i < parts.length && i < d.length && parts[i] === d[i]) i++;
    parts = parts.slice(0, i);
  }
  return parts.length ? `${parts.join("/")}/` : "";
}

/** Le nom court d'une colonne, comme sur la planche : `bookings` → `book.`. */
export function shortName(name: string): string {
  return name.length > 6 ? `${name.slice(0, 4)}.` : name;
}

/* --- À savoir --------------------------------------------------------------------------------- */

export interface Attention { tone: "critical" | "signal"; icon: string; title: string; sub: string; proof: Proof; action: string; node?: string }

/** Les icônes de la planche, par famille de constat : un cadenas, une horloge, un document, un journal. */
const ICON: Partial<Record<FindingCode, string>> & { other: string } = {
  unguarded_route: "M4 7.5h8v6H4zM5.8 7.5V5.2a2.2 2.2 0 0 1 4.4 0v2.3",
  race_read_then_write: "M8 2.5v4l2.5 1.5M13.5 8a5.5 5.5 0 1 1-2-4.2",
  scheduled_on_every_instance: "M8 2.5v4l2.5 1.5M13.5 8a5.5 5.5 0 1 1-2-4.2",
  missing_timeout: "M8 2.5v4l2.5 1.5M13.5 8a5.5 5.5 0 1 1-2-4.2",
  doc_contradiction: "M3 4h10M3 8h6M3 12h8",
  personal_data_logged: "M3 3.5h10v9H3zM5.5 6.5h5M5.5 9.5h3",
  write_then_enqueue: "M2.5 5h7l-2-2M13.5 11h-7l2 2",
  other: "M8 4.5v4.5M8 11.5v.01M8 1.8l6.5 11.4H1.5z",
};
const ACTION: Partial<Record<FindingCode, string>> = {
  unguarded_route: "Accès", personal_data_logged: "Données", race_read_then_write: "Rejouer", write_then_enqueue: "Données",
  unused_value: "Données", scheduled_on_every_instance: "Tâches", doc_contradiction: "Comparer",
};

export function attention(p: MapPayload): Attention[] {
  return byGravity(p.model.findings).map((f) => ({
    tone: FINDING_TONE[f.code], icon: ICON[f.code] ?? ICON.other,
    title: sentence(f.message), sub: rest(f.message), proof: f.proof[0]!,
    action: ACTION[f.code] ?? "Carte", ...(f.nodes?.[0] ? { node: f.nodes[0] } : {}),
  }));
}
