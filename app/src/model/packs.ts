import type { MapPayload, PackProposal, PacksPayload } from "../api/types";
import type { ArchModelV2, Proof } from "../../../vision/arch/types";
import type { Technology } from "../../../vision/stack/types";
import { FINDING_TONE } from "./words";

/**
 * Ce que la planche 02 (Atelier de pack) montre d'une proposition, lu dans ce que l'écrivain a déposé :
 * l'inventaire des formes (sa page), ses tests, ses règles, l'essai à part sur le projet.
 */

export interface Form { n: string; form: string; example: string; state: string; read: boolean }

/** Le tableau des formes de la page du pack : une ligne par forme de l'API, lue ou non lue avec sa raison. */
export function forms(p: PackProposal): Form[] {
  const rows = p.doc.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l));
  return rows.map((l) => {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    const state = c[3] ?? "";
    return { n: c[0] ?? "", form: c[1] ?? "", example: c[2] ?? "", state, read: /^lu\b/.test(state) };
  });
}

/** Le titre et le premier paragraphe de la page du pack. */
export function intro(p: PackProposal): { title: string; text: string } {
  const lines = p.doc.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) ?? `# ${p.name}`).slice(2);
  const text = lines.find((l, i) => i > 0 && l.trim() && !l.startsWith("#") && !l.startsWith("|")) ?? "";
  return { title, text };
}

export interface Step { n: string; label: string; count: string; done: boolean }

/** Les cinq étapes de la recette, et où en est la proposition. */
export function steps(p: PackProposal): Step[] {
  const f = forms(p);
  const ok = p.preview?.state.status === "active";
  return [
    { n: "1", label: "Inventaire", count: `${f.length} formes`, done: f.length > 0 },
    { n: "2", label: "Tests", count: ok ? `${p.tests.length} sur ${p.tests.length} passent` : "à revoir", done: ok },
    { n: "3", label: "Règles", count: `${p.rules.length} règle${p.rules.length > 1 ? "s" : ""}`, done: true },
    { n: "4", label: "Vérification", count: ok ? "5 sur 5" : p.preview?.state.reason ? "refusé" : "en attente", done: ok },
    { n: "5", label: "Différence", count: "à décider", done: false },
  ];
}

/** Les vérifications que VisionLayer fait avant tout chargement (ADR 0019), et leur résultat. */
export function checks(p: PackProposal): { title: string; note: string; ok: boolean }[] {
  const s = p.preview?.state;
  const reason = s?.reason ?? "";
  const failedAt = (k: RegExp) => s?.status === "failed" && k.test(reason);
  return [
    { title: "Schéma strict du pack", note: "aucun champ inconnu, aucun script", ok: !failedAt(/schéma|script|champ/) },
    { title: `${p.tests.length} tests de forme`, note: "un petit fichier d'exemple par forme, hors du projet", ok: !failedAt(/test/) },
    { title: "Il produit ce qu'il déclare", note: `${p.provides.length} relations déclarées`, ok: !failedAt(/déclarer|provides|arguments/) },
    { title: "Déclarations sans cycle", note: "aucune boucle avec les autres packs du projet", ok: !failedAt(/cycle/) },
    { title: "Chargé à part, la carte acceptée intacte", note: s?.status === "failed" ? reason : "essayé dans un domaine isolé avant la décision", ok: s?.status !== "failed" },
  ];
}

/**
 * La page Packs (planche P2) : une ligne par technologie du projet. Lues : celles dont un pack a mis au moins un fait
 * sur la carte, avec ce qu'il y a mis. Pas encore lues : celles que la couverture dit importées sans pack, avec les
 * fichiers dont la carte ne dit rien. Rien n'est deviné : les comptes viennent des preuves de la carte.
 */
export type TechState = "unread" | "queued" | "writing" | "failed" | "read";
export interface TechRow {
  key: string;
  name: string;
  version?: string;
  family: string;
  where?: Proof;
  files: number;
  state: TechState;
  /** Sur la carte : ce que le pack y a mis, par sorte, ou ce qui manque. */
  gives: string;
  findings: { critical: number; signal: number; first?: string };
  pack?: { id: string; by: "builtin" | "muse" | "project"; at?: string; tests?: number; cost?: number };
  /** Le paquet que l'écrivain lirait. */
  pkg?: string;
  /** Une bibliothèque hors catalogue : importée par le code, sans pack ; elle n'entre pas dans le compte des technologies. */
  lib?: boolean;
  note?: string;
}

const FAMILY: Record<string, string> = {
  language: "Langage", runtime: "Exécution", framework: "Cadre applicatif", styling: "Interface", data: "Données", backend: "Serveur",
  cloud: "Cloud", database: "Base de données", ai: "IA", media: "Médias", build: "Livraison", test: "Tests", quality: "Qualité",
  analytics: "Mesure", ci: "Livraison", library: "Bibliothèque",
};
const LABEL: Record<string, [string, string]> = {
  entrypoints: ["point d'entrée", "points d'entrée"], data: ["donnée", "données"], contract: ["contrat", "contrats"],
  channel: ["file de messages", "files de messages"], config: ["réglage", "réglages"], trust: ["garde", "gardes"],
  functions: ["fonction", "fonctions"], component: ["composant", "composants"], edges: ["lien", "liens"], nodes: ["bloc", "blocs"],
};

/** Par pack : combien d'éléments de la carte il prouve, rangés par sorte, les fichiers cités et la première preuve. */
function byPack(model: ArchModelV2) {
  type Acc = { kinds: Map<string, number>; files: Set<string>; first?: Proof };
  const out = new Map<string, Acc>();
  const proofs = (o: Record<string, unknown>): Proof[] => { const p = o.proof; return Array.isArray(p) ? p as Proof[] : p && typeof p === "object" ? [p as Proof] : []; };
  const walk = (v: unknown, label: string): void => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, label)); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const id of new Set(proofs(o).map((p) => p.pack).filter((x): x is string => !!x))) {
      const e: Acc = out.get(id) ?? { kinds: new Map(), files: new Set<string>() };
      e.kinds.set(label, (e.kinds.get(label) ?? 0) + 1);
      for (const p of proofs(o)) if (p.pack === id) { e.files.add(p.path); e.first ??= p; }
      out.set(id, e);
    }
    for (const [k, x] of Object.entries(o)) if (k !== "proof" && k !== "findings" && k !== "coverage") walk(x, LABEL[k] ? k : label);
  };
  walk(model.nodes, "nodes"); walk(model.edges, "edges");
  return out;
}

export function techRows(map: MapPayload, packs: PacksPayload, techs: Technology[]): TechRow[] {
  const facts = byPack(map.model);
  const techOf = (ids: string[], name: string) => techs.find((t) => ids.includes(t.id)) ?? techs.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const read: TechRow[] = [];
  const all = [...packs.builtins.map((b) => ({ ...b, local: false, meta: undefined as PacksPayload["local"][number]["meta"] })), ...packs.local.map((l) => ({ id: l.id, name: l.name, tech: l.tech, used: l.used, local: true, meta: l.meta }))];
  for (const p of all) {
    const f = facts.get(p.id);
    if (!p.used && !f && !p.meta) continue;
    const t = techOf(p.tech, p.name);
    const kinds = [...(f?.kinds ?? new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const found = map.model.findings.filter((x) => x.proof.some((q) => q.pack === p.id));
    const crit = found.filter((x) => FINDING_TONE[x.code] === "critical");
    read.push({
      key: p.id, name: t?.name ?? p.name, version: t?.versions.at(-1)?.replace(/^[\^~]/, ""), family: FAMILY[t?.category ?? "library"] ?? "Bibliothèque",
      where: f?.first, files: f?.files.size ?? 0, state: "read",
      gives: kinds.length ? kinds.map(([k, n]) => `${n} ${n > 1 ? LABEL[k]![1] : LABEL[k]![0]}`).join(", ") : "aucun élément sur la carte",
      findings: { critical: crit.length, signal: found.length - crit.length, ...(found[0] ? { first: found[0].message } : {}) },
      pack: { id: p.id, by: p.meta ? "muse" : p.local ? "project" : "builtin", ...(p.meta ? { at: p.meta.at, tests: p.meta.tests, ...(p.meta.cost !== undefined ? { cost: p.meta.cost } : {}) } : {}) },
    });
  }
  const gaps = map.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing" || g.kind === "library_not_read");
  const unread: TechRow[] = [];
  for (const g of gaps) {
    if (unread.some((u) => u.key === g.subject)) continue;
    const spec = [g.proof, ...(g.where ?? [])].map((p) => (p?.text ?? "").match(/from\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']/)).find(Boolean);
    const lib = g.kind === "library_not_read";
    const pkg = lib ? g.subject : (spec?.[1] ?? spec?.[2])?.replace(/^(@[^/]+\/[^/]+|[^@/][^/]*).*$/, "$1");
    const t = techOf(pkg ? [`npm:${pkg}`] : [], g.subject) ?? (pkg ? techs.find((x) => x.evidence.some((e) => e.kind === "package" && e.package === pkg)) : undefined);
    const writing = packs.job && !packs.job.done && packs.job.pkg === pkg;
    const state: TechState = writing ? "writing" : pkg && packs.queue.includes(pkg) ? "queued" : pkg && packs.failed[pkg] ? "failed" : "unread";
    unread.push({
      key: g.subject, name: t?.name ?? g.subject, version: t?.versions.at(-1)?.replace(/^[\^~]/, ""), family: FAMILY[t?.category ?? "library"] ?? "Bibliothèque",
      ...(g.proof ? { where: g.proof } : {}), files: g.count, state,
      gives: `${g.count} fichier${g.count > 1 ? "s" : ""} dont la carte ne dit pas ce qu'ils font`,
      findings: { critical: 0, signal: 0 }, ...(pkg ? { pkg } : {}), ...(lib ? { lib: true } : {}),
      ...(state === "writing" ? { note: lastStep(packs.job!.lines) } : state === "queued" ? { note: `en file, ${packs.queue.indexOf(pkg!) + 1}${packs.queue.indexOf(pkg!) ? "e" : "re"}` } : state === "failed" ? { note: packs.failed[pkg!]!.reason } : {}),
    });
  }
  const order = (r: TechRow) => r.findings.critical * 100 + r.findings.signal * 10 + r.files;
  const mine = (r: TechRow) => r.pack?.by === "builtin" ? 0 : 1;
  return [...unread, ...read.sort((a, b) => mine(b) - mine(a) || order(b) - order(a))];
}

/** La dernière étape lisible de l'écrivain, en mots : « lit la documentation », « essaie ses tests »… */
function lastStep(lines: string[]): string {
  const l = [...lines].reverse().find((x) => /\[\d+\]|Fiche|écrit le pack|Pack proposé|Chargé/.test(x)) ?? "";
  if (/Chargé/.test(l)) return "chargé, la carte se recalcule";
  if (/Pack proposé/.test(l)) return "essai à part sur ce projet";
  if (/check_pack|submit_pack/.test(l)) return "essaie ses tests";
  if (/\[\d+\]/.test(l)) return "écrit les formes et leurs tests";
  return "lit la documentation";
}
