import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import type { SystemModel } from "../model/types.js";
import type { InfraModel } from "../infra/types.js";
import { techForInfraComponent } from "./infraTech.js";
import { listProjectFiles, type ProjectFile } from "../scanner/files.js";
import {
  CATALOG,
  LANGUAGE_BY_EXTENSION,
  catalogEntry,
  facetFor,
  packageRank,
  techsForConfig,
  techsForImage,
  techsForPackage,
  techsForSystemPackage,
  type CatalogEntry,
} from "./catalog.js";
import { isManifest, parseDockerfileInstalls, parseManifest, type PackageDecl, type RuntimeDecl } from "./manifests.js";
import type { Ecosystem, LanguageShare, StackModel, StackWarning, TechCategory, TechEvidence, Technology, Workspace } from "./types.js";

const CATEGORY_ORDER: TechCategory[] = ["language", "runtime", "framework", "styling", "data", "backend", "cloud", "database", "ai", "media", "build", "test", "quality", "analytics", "ci", "library"];

const NODE_BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));

interface Acc {
  entry?: CatalogEntry;
  id: string;
  name: string;
  category: TechCategory;
  icon?: string;
  evidence: TechEvidence[];
  facets: Set<string>;
  workspaces: Set<string>;
  versions: Set<string>;
  /** Versions du paquet principal (rang le plus bas dans l'entrée du catalogue). */
  primary: { rank: number; versions: Set<string> };
  importers: Set<string>;
}

/**
 * Inventaire des technologies d'un repository (niveau Technologies).
 * Entrées : les fichiers du projet (git), le modèle (imports externes) et le
 * modèle Infrastructure (composants, images). Déterministe.
 */
export function buildStackModel(root: string, model: SystemModel, infra: InfraModel, files: ProjectFile[] = listProjectFiles(root)): StackModel {
  const techs = new Map<string, Acc>();
  const warnings: StackWarning[] = [];
  const workspaces: Workspace[] = [];

  const acc = (entry: CatalogEntry): Acc => {
    let a = techs.get(entry.id);
    if (!a) {
      a = { entry, id: entry.id, name: entry.name, category: entry.category, evidence: [], facets: new Set(), workspaces: new Set(), versions: new Set(), primary: { rank: Infinity, versions: new Set() }, importers: new Set() };
      if (entry.icon) a.icon = entry.icon;
      techs.set(entry.id, a);
    }
    return a;
  };
  const library = (ecosystem: Ecosystem, name: string): Acc => {
    const id = `${ecosystem}:${name}`;
    let a = techs.get(id);
    if (!a) {
      a = { id, name, category: "library", evidence: [], facets: new Set(), workspaces: new Set(), versions: new Set(), primary: { rank: Infinity, versions: new Set() }, importers: new Set() };
      techs.set(id, a);
    }
    return a;
  };

  // ── Manifestes ──────────────────────────────────────────────
  const decls: (PackageDecl & { workspace: string })[] = [];
  const runtimes: RuntimeDecl[] = [];
  for (const f of files.filter((f) => isManifest(f.path))) {
    try {
      const parsed = parseManifest(f.path, readFileSync(join(root, f.path), "utf-8"));
      const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
      workspaces.push({ name: parsed.name, dir, manifest: f.path, ecosystem: parsed.ecosystem });
      for (const p of parsed.packages) decls.push({ ...p, workspace: parsed.name });
      runtimes.push(...parsed.runtimes);
    } catch (err) {
      warnings.push({ code: "manifest_invalid", message: `manifeste illisible : ${(err as Error).message.split("\n")[0]}`, path: f.path });
    }
  }
  const internal = new Set(workspaces.map((w) => w.name));

  for (const d of decls) {
    if (internal.has(d.name) || /^(workspace|link|file|portal):/.test(d.range)) continue;
    const typesOf = d.ecosystem === "npm" && d.name.startsWith("@types/") ? d.name.slice(7).replace(/^(.+)__(.+)$/, "@$1/$2") : undefined;
    let entries = techsForPackage(d.ecosystem, d.name);
    if (!entries.length && typesOf) entries = techsForPackage("npm", typesOf);
    const viaExtras = (d.extras ?? []).flatMap((x) => techsForPackage(d.ecosystem, `${d.name}[${x}]`).map((e) => ({ e, key: `${d.name}[${x}]` })));
    const installed = d.ecosystem === "npm" ? installedVersion(root, d.manifest, d.name) : undefined;
    const ev: TechEvidence = { kind: "package", ecosystem: d.ecosystem, manifest: d.manifest, package: d.name, range: d.range, dev: d.dev };
    if (d.line) ev.line = d.line;
    if (installed) ev.installed = installed;
    if (d.peer) ev.peer = true;
    const targets = [
      ...(entries.length ? entries.map((e) => ({ a: acc(e), facet: facetFor(e, d.name), rank: packageRank(e, d.ecosystem, d.name) })) : [{ a: library(d.ecosystem, typesOf ?? d.name), facet: undefined, rank: 0 }]),
      ...viaExtras.filter(({ e }) => !entries.includes(e)).map(({ e, key }) => ({ a: acc(e), facet: facetFor(e, key), rank: Infinity })),
    ];
    for (const { a, facet, rank } of targets) {
      a.evidence.push(facet ? { ...ev, facet } : ev);
      if (facet) a.facets.add(facet);
      a.workspaces.add(d.workspace);
      if (!d.name.startsWith("@types/") && !(d.peer && !installed)) notePrimary(a, rank, installed ?? d.range);
    }
  }

  // Version affichée : celle du paquet principal (installée, sinon contrainte déclarée).
  // Seul le paquet qui EST la technologie (motif exact en tête d'entrée) donne sa version :
  // « Google Cloud 5.5.2 » serait la version de @google-cloud/tasks, pas de Google Cloud.
  function notePrimary(a: Acc, rank: number, version: string): void {
    const head = a.entry ? Object.values({ npm: a.entry.npm, pypi: a.entry.pypi, go: a.entry.go, cargo: a.entry.cargo, composer: a.entry.composer, gem: a.entry.gem }).find((l) => l?.length)?.[0] : undefined;
    if (a.entry && (rank !== 0 || !head || head.includes("*"))) return;
    if (rank < a.primary.rank) a.primary = { rank, versions: new Set() };
    if (rank === a.primary.rank && version !== "*") a.primary.versions.add(version);
  }

  // ── Versions d'exécution ────────────────────────────────────
  for (const r of runtimes) addRuntime(r);
  function addRuntime(r: RuntimeDecl): void {
    const entry = catalogEntry(r.tech);
    if (!entry) return;
    const a = acc(entry);
    const ev: TechEvidence = { kind: "runtime", value: r.value, field: r.field, path: r.path };
    if (r.line) ev.line = r.line;
    a.evidence.push(ev);
    if (r.value) a.versions.add(r.value);
  }
  for (const s of infra.sources.filter((s) => s.format === "github-actions")) {
    const lines = readLines(root, s.path);
    lines.forEach((l, i) => {
      const node = l.match(/^\s*node-version:\s*['"]?([\w.x]+)/);
      if (node) addRuntime({ tech: "nodejs", value: node[1]!, field: "actions/setup-node", path: s.path, line: i + 1 });
      const py = l.match(/^\s*python-version:\s*['"]?([\w.x]+)/);
      if (py) addRuntime({ tech: "python", value: py[1]!, field: "actions/setup-python", path: s.path, line: i + 1 });
    });
  }

  // ── Fichiers de configuration ───────────────────────────────
  for (const f of files) {
    for (const e of techsForConfig(f.path)) {
      const facet = facetFor(e, f.path.slice(f.path.lastIndexOf("/") + 1));
      const a = acc(e);
      a.evidence.push(facet ? { kind: "config", path: f.path, facet } : { kind: "config", path: f.path });
      if (facet) a.facets.add(facet);
    }
  }

  // ── Langages (part des fichiers) ────────────────────────────
  const byLang = new Map<string, { files: number; exts: Map<string, number> }>();
  for (const f of files) {
    const dot = f.path.lastIndexOf(".");
    const ext = dot > f.path.lastIndexOf("/") ? f.path.slice(dot).toLowerCase() : "";
    const lang = LANGUAGE_BY_EXTENSION[ext];
    if (!lang) continue;
    const l = byLang.get(lang) ?? { files: 0, exts: new Map() };
    l.files++;
    l.exts.set(ext, (l.exts.get(ext) ?? 0) + 1);
    byLang.set(lang, l);
  }
  const languages: LanguageShare[] = [];
  for (const [lang, l] of byLang) {
    const entry = catalogEntry(lang);
    if (!entry) continue;
    const share: LanguageShare = { id: lang, name: entry.name, files: l.files, extensions: [...l.exts.keys()].sort() };
    if (entry.icon) share.icon = entry.icon;
    languages.push(share);
    const a = acc(entry);
    for (const [ext, count] of [...l.exts].sort()) a.evidence.push({ kind: "files", extension: ext, count });
  }
  languages.sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));

  // ── Infrastructure : composants, images, paquets système ───
  const formatOf = new Map(infra.sources.map((s) => [s.path, s.format]));
  for (const c of infra.components) {
    const path = c.source.path;
    const line = c.source.kind === "extracted" ? c.source.line : undefined;
    const format = c.source.kind === "declared" ? undefined : formatOf.get(path);
    const entry = format === "package-scripts" ? undefined : techForInfraComponent(c, format);
    if (entry) {
      const facet = c.attrs.plateforme ?? facetFor(entry, `infra:${c.kind}`);
      const a = acc(entry);
      const ev: TechEvidence = { kind: "infra", component: c.id, name: c.name, path };
      if (line) ev.line = line;
      a.evidence.push(facet ? { ...ev, facet } : ev);
      if (facet) a.facets.add(facet);
    }
    const images = [c.attrs.image, ...(c.attrs.base ?? "").split(" → "), ...(c.attrs.images ?? "").split(", ")].filter((x): x is string => Boolean(x && x.trim()));
    for (const image of new Set(images)) {
      const tag = image.match(/:([^/:@]+)$/)?.[1];
      for (const e of techsForImage(image)) {
        const a = acc(e);
        const ev: TechEvidence = { kind: "image", image, path };
        if (tag) ev.tag = tag;
        if (line) ev.line = line;
        a.evidence.push(ev);
        if (tag && tag !== "latest") a.versions.add(tag.replace(/-.*$/, ""));
      }
    }
  }
  for (const s of infra.sources.filter((s) => s.format === "dockerfile")) {
    let content: string;
    try {
      content = readFileSync(join(root, s.path), "utf-8");
    } catch {
      continue;
    }
    const { system, packages } = parseDockerfileInstalls(s.path, content);
    for (const p of system) {
      for (const e of techsForSystemPackage(p.name)) acc(e).evidence.push({ kind: "system", package: p.name, path: s.path, line: p.line });
    }
    for (const d of packages) {
      const extras = (d.extras ?? []).flatMap((x) => techsForPackage(d.ecosystem, `${d.name}[${x}]`));
      const entries = [...new Set([...techsForPackage(d.ecosystem, d.name), ...extras])];
      const ev: TechEvidence = { kind: "package", ecosystem: d.ecosystem, manifest: d.manifest, package: d.name, range: d.range, dev: false };
      if (d.line) ev.line = d.line;
      for (const e of entries) {
        const a = acc(e);
        const key = (d.extras ?? []).map((x) => `${d.name}[${x}]`).find((k) => facetFor(e, k)) ?? d.name;
        const facet = facetFor(e, key);
        a.evidence.push(facet ? { ...ev, facet } : ev);
        if (facet) a.facets.add(facet);
      }
      if (!entries.length) library(d.ecosystem, d.name).evidence.push(ev);
    }
  }

  // ── Imports : qui utilise quoi (lien vers le niveau Fichiers) ─
  const declared = new Map<string, Acc[]>();
  for (const a of techs.values()) for (const ev of a.evidence) if (ev.kind === "package" && ev.ecosystem === "npm") declared.set(ev.package, [...(declared.get(ev.package) ?? []), a]);
  const topDirs = new Set(files.map((f) => f.path.split("/")[0]!));
  const undeclared = new Map<string, Set<string>>();
  for (const dep of model.dependencies) {
    if (!dep.external) continue;
    const spec = dep.raw;
    if (spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0]!)) {
      const node = catalogEntry("nodejs");
      if (node) acc(node).importers.add(dep.from);
      continue;
    }
    const pkg = packageName(spec);
    if (!pkg || internal.has(pkg) || topDirs.has(pkg.split("/")[0]!)) continue;
    const owners = declared.get(pkg) ?? techsForPackage("npm", pkg).filter((e) => techs.has(e.id)).map((e) => techs.get(e.id)!);
    if (!owners.length) {
      undeclared.set(pkg, (undeclared.get(pkg) ?? new Set()).add(dep.from));
      continue;
    }
    for (const a of new Set(owners)) {
      a.importers.add(dep.from);
      const facet = a.entry ? facetFor(a.entry, spec) : undefined;
      if (facet && spec !== pkg) a.facets.add(facet);
    }
  }
  for (const [pkg, importers] of [...undeclared].sort(([a], [b]) => a.localeCompare(b))) {
    warnings.push({ code: "undeclared_import", message: `« ${pkg} » est importé par ${importers.size} fichier(s) mais déclaré dans aucun manifeste`, path: [...importers].sort()[0] });
  }

  // ── Versions divergentes d'un même paquet entre manifestes ──
  const rangesByPkg = new Map<string, Map<string, string[]>>();
  for (const d of decls) {
    if (internal.has(d.name) || /^(workspace|link|file|portal):/.test(d.range)) continue;
    // Seules les contraintes qui fixent une majeure se comparent (`^7.2.5`, `~5.8`, `6.0.1`) —
    // une borne basse de pair (`>=18`) accepte la version de l'autre manifeste.
    if (!/^[\^~=v]?\d/.test(d.range.trim())) continue;
    const major = majorOf(d.range);
    if (major === undefined) continue;
    const key = `${d.ecosystem}:${d.name}`;
    const m = rangesByPkg.get(key) ?? new Map<string, string[]>();
    m.set(major, [...(m.get(major) ?? []), `${d.range} (${d.manifest})`]);
    rangesByPkg.set(key, m);
  }
  for (const [key, majors] of [...rangesByPkg].sort(([a], [b]) => a.localeCompare(b))) {
    if (majors.size < 2) continue;
    const name = key.slice(key.indexOf(":") + 1);
    const tech = [...techs.values()].find((a) => a.evidence.some((e) => e.kind === "package" && e.package === name));
    const w: StackWarning = { code: "version_divergence", message: `${name} : versions majeures différentes — ${[...majors.values()].flat().join(" · ")}` };
    if (tech) w.tech = tech.id;
    warnings.push(w);
  }

  // ── Dépendances déclarées qu'aucun fichier scanné n'importe ─
  // Seulement pour les bibliothèques qu'on importe (pas les outils de build,
  // de test, de style ni les types) : un fait à vérifier, pas un verdict — un
  // paquet peut être chargé autrement (CLI, plugin, script).
  const importedPkgs = new Set(model.dependencies.filter((d) => d.external).map((d) => packageName(d.raw)).filter(Boolean));
  const scannedDirs = new Set(model.files.map((f) => f.path.split("/")[0]));
  const IMPORTABLE: TechCategory[] = ["framework", "data", "backend", "cloud", "database", "ai", "media", "analytics", "library"];
  const unused = new Map<string, string[]>();
  for (const d of decls) {
    if (d.ecosystem !== "npm" || d.dev || d.name.startsWith("@types/") || internal.has(d.name) || importedPkgs.has(d.name)) continue;
    const owner = techsForPackage("npm", d.name)[0];
    if (owner && !IMPORTABLE.includes(owner.category)) continue;
    const dir = d.manifest.includes("/") ? d.manifest.split("/")[0] : undefined;
    if (dir && !scannedDirs.has(dir)) continue;
    unused.set(d.name, [...(unused.get(d.name) ?? []), d.manifest]);
  }
  for (const [name, manifests] of [...unused].sort(([a], [b]) => a.localeCompare(b))) {
    const tech = [...techs.values()].find((a) => a.evidence.some((e) => e.kind === "package" && e.package === name));
    const w: StackWarning = { code: "declared_unused", message: `${name} est déclaré (${manifests.join(", ")}) mais aucun fichier scanné ne l'importe`, path: manifests[0] };
    if (tech) w.tech = tech.id;
    warnings.push(w);
  }

  const technologies: Technology[] = [...techs.values()]
    .filter((a) => a.evidence.length > 0 || a.importers.size > 0)
    .map((a) => {
      const t: Technology = {
        id: a.id,
        name: a.name,
        category: a.category,
        versions: [...new Set([...a.primary.versions, ...a.versions])].filter(Boolean).sort(compareVersions),
        workspaces: [...a.workspaces].sort(),
        facets: [...a.facets].sort(),
        evidence: a.evidence,
        importers: [...a.importers].sort(),
      };
      if (a.icon) t.icon = a.icon;
      return t;
    })
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));

  workspaces.sort((a, b) => a.manifest.localeCompare(b.manifest));
  return { version: 1, technologies, workspaces, languages, warnings };
}

function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/** `@scope/pkg/sub` → `@scope/pkg` ; `pkg/sub` → `pkg`. Undefined si ce n'est pas un nom de paquet npm. */
export function packageName(spec: string): string | undefined {
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name) ? name : undefined;
}

/** Majeure d'une contrainte (`^19.0.0` → 19, `~0.16.4` → 0.16). Undefined si non numérique (`*`, `latest`). */
function majorOf(range: string): string | undefined {
  const m = range.match(/(\d+)(?:\.(\d+))?/);
  if (!m) return undefined;
  return m[1] === "0" && m[2] !== undefined ? `0.${m[2]}` : m[1];
}

/** Version installée (node_modules du dossier du manifeste), si présente. */
function installedVersion(root: string, manifest: string, name: string): string | undefined {
  const dir = manifest.includes("/") ? manifest.slice(0, manifest.lastIndexOf("/")) : "";
  const p = join(root, dir, "node_modules", name, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    const v = (JSON.parse(readFileSync(p, "utf-8")) as { version?: unknown }).version;
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

function readLines(root: string, path: string): string[] {
  try {
    return readFileSync(join(root, path), "utf-8").split("\n");
  } catch {
    return [];
  }
}
