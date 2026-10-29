import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemModel } from "../model/types.js";
import type { InfraModel } from "../infra/types.js";
import { listProjectFiles } from "../scanner/files.js";
import { catalogEntry } from "../stack/catalog.js";
import { ArchAnalyzer, collectionOf, describeTarget, type FileFacts, type RequestTarget } from "./analyze.js";
import { lineText } from "./ast.js";
import type { Access, ArchBlock, ArchLink, ArchModel, ArchWarning, CollectionFact, EntryPoint, Evidence, LinkKind } from "./types.js";

const MAX_EVIDENCE = 60;

/**
 * Carte d'exécution d'un repository (niveau Architecture, ADR 0012).
 *
 * 1. Blocs qui s'exécutent : une app par page HTML qui charge un module
 *    (`<script type="module" src>`), les Cloud Functions (dossier source de
 *    firebase.json), un service par image Docker dont le `CMD` lance un
 *    fichier du repository, un serveur Node pour tout autre `listen()`.
 * 2. Le code d'un bloc = fermeture des imports depuis ses points d'entrée.
 * 3. Services managés et externes : Firestore, Storage, Authentification,
 *    IA, files, backends — créés seulement quand le code les utilise.
 * 4. Liens agrégés par (source, cible, nature), chacun avec ses lignes.
 */
export function buildArchModel(root: string, model: SystemModel, infra: InfraModel): ArchModel {
  const an = new ArchAnalyzer(root, model);
  const facts = new Map<string, FileFacts>();
  for (const f of an.files()) {
    const x = an.analyze(f);
    if (x) facts.set(f, x);
  }

  const internalDeps = new Map<string, string[]>();
  // Un import relatif non résolu (dossier absent du repository, généré au build) garde son chemin brut : ce n'est pas un fichier.
  const known = new Set(model.files.map((f) => f.path));
  for (const d of model.dependencies) if (!d.external && known.has(d.to)) internalDeps.set(d.from, [...(internalDeps.get(d.from) ?? []), d.to]);
  const closureMemo = new Map<string, Set<string>>();
  const closure = (start: string): Set<string> => {
    const memo = closureMemo.get(start);
    if (memo) return memo;
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length) for (const to of internalDeps.get(stack.pop()!) ?? []) if (!seen.has(to)) (seen.add(to), stack.push(to));
    closureMemo.set(start, seen);
    return seen;
  };

  const blocks = new Map<string, ArchBlock>();
  const entries: EntryPoint[] = [];
  const warnings: ArchWarning[] = [];
  const entryClosure = new Map<string, Set<string>>();

  const addBlock = (b: ArchBlock): ArchBlock => {
    const existing = blocks.get(b.id);
    if (existing) return existing;
    blocks.set(b.id, b);
    return b;
  };
  const addEntry = (e: EntryPoint): void => {
    entries.push(e);
    blocks.get(e.block)!.entries.push(e.id);
    if (e.kind === "app" || e.kind === "server" || (e.kind === "http" && e.detail === "route")) {
      entryClosure.set(e.id, closure(e.path));
      if (e.kind === "http") e.files = [...closure(e.path)].sort();
      return;
    }
    // Une fonction : son fichier + ce que SA déclaration importe, transitivement.
    const reach = new Set<string>([e.path]);
    for (const f of an.referencedImports(e.path, e.line)) for (const x of closure(f)) reach.add(x);
    entryClosure.set(e.id, reach);
    e.ranges = an.ownRanges(e.path, e.line);
    e.files = [...reach].sort();
  };
  const ev = (path: string, line: number): Evidence => ({ path, line, text: lineText(an.sourceOf(path) ?? safeRead(root, path), line) });

  // ── 1a. Apps clientes : pages HTML qui chargent un module du repository ──
  const projectFiles = listProjectFiles(root);
  const hostings = infra.components.filter((c) => c.kind === "host");
  for (const html of projectFiles.filter((f) => f.path.endsWith(".html") && !/(^|\/)(docs?|examples?|test|tests|fixtures|public)\//.test(f.path))) {
    const content = safeRead(root, html.path);
    const m = content.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/);
    if (!m) continue;
    const dir = html.path.includes("/") ? html.path.slice(0, html.path.lastIndexOf("/") + 1) : "";
    const entryFile = normalizePath(m[1]!.startsWith("/") ? m[1]!.slice(1) : dir + m[1]!);
    if (!facts.has(entryFile) && !model.files.some((f) => f.path === entryFile)) continue;
    // Nom de l'app : son dossier (`apps/prep` → prep), sauf dossier générique (`src`) → le nom du projet.
    const dirName = entryFile.split("/").slice(-2, -1)[0];
    const appName = dirName && !/^(src|app|client|web|frontend|www)$/.test(dirName) ? dirName : projectName(root);
    const hosting = hostings.find((h) => h.name.toLowerCase().endsWith(`· ${appName.toLowerCase()}`) || h.name.toLowerCase().endsWith(appName.toLowerCase()));
    const files = [...closure(entryFile)].sort();
    const usesReact = files.some((f) => /\.(tsx|jsx)$/.test(f));
    const b = addBlock({
      id: `client:${appName}`,
      name: `App ${appName}`,
      kind: "client",
      tech: usesReact ? "react" : undefined,
      subtitle: hosting ? hosting.name : `${html.path} · ${files.length} fichiers`,
      origin: ev(html.path, lineNumber(content, m[0])),
      files,
      entries: [],
    });
    addEntry({ id: `entry:${b.id}:${html.path}`, block: b.id, name: html.path, kind: "app", path: entryFile, line: 1, detail: hosting?.name });
  }

  // ── 1b. Cloud Functions : dossier source de firebase.json (sinon : là où sont les fonctions) ──
  const fnSources = infra.components.filter((c) => c.id.startsWith("service:firebase-functions") && c.attrs.source).map((c) => ({ dir: c.attrs.source!, component: c }));
  const functionEntries = [...facts.values()].flatMap((f) => f.entries.filter((e) => e.kind !== "server" && !(e.kind === "http" && e.detail === "route")).map((e) => ({ file: f.path, e })));
  for (const { file, e } of functionEntries) {
    const src = fnSources.find((s) => file === s.dir || file.startsWith(`${s.dir}/`));
    const blockId = src ? src.component.id : `service:functions-${file.split("/")[0]}`;
    if (!blocks.has(blockId)) {
      addBlock({
        id: blockId,
        name: src ? src.component.name : `Fonctions (${file.split("/")[0]})`,
        kind: "service",
        tech: "firebase",
        subtitle: "",
        origin: src && src.component.source.kind === "extracted" ? ev(src.component.source.path, src.component.source.line ?? 1) : ev(file, e.line),
        files: [],
        entries: [],
      });
    }
    addEntry({ id: `entry:${e.name}`, block: blockId, name: e.name, kind: e.kind, path: file, line: e.line, symbol: e.symbolName ? `${file}#${e.symbolName}` : undefined, detail: e.detail });
  }

  // ── 1c. Services conteneurisés : `CMD` d'un Dockerfile qui lance un fichier du repository ──
  const serverFacts = [...facts.values()].filter((f) => f.entries.some((e) => e.kind === "server"));
  const claimedServers = new Set<string>();
  for (const img of infra.components.filter((c) => c.kind === "image")) {
    const cmd = img.attrs.cmd ?? img.attrs.entrypoint ?? "";
    const target = cmd.match(/[\w./-]+\.(ts|js|mjs|cjs|py)\b/)?.[0];
    if (!target) continue;
    const suffix = target.replace(/^\.\//, "");
    const file = [...facts.keys()].find((f) => f === suffix || f.endsWith(`/${suffix}`));
    const dockerDir = img.name.includes("/") ? img.name.slice(0, img.name.lastIndexOf("/")) : ".";
    const name = dockerDir.split("/").pop() ?? "service";
    const id = `service:container-${name}`;
    const b = addBlock({
      id,
      name: `Service ${name}`,
      kind: "service",
      tech: img.attrs.base?.startsWith("python") ? "python" : "docker",
      subtitle: `conteneur · ${dockerDir}`,
      origin: img.source.kind === "extracted" ? ev(img.source.path, img.source.line ?? 1) : ev(img.name, 1),
      files: file ? [...closure(file)].sort() : [],
      entries: [],
    });
    if (!file) {
      warnings.push({ code: "unresolved_target", message: `${img.name} lance « ${target} », introuvable parmi les fichiers analysés (langage non analysé ?)` });
      continue;
    }
    claimedServers.add(file);
    for (const e of facts.get(file)!.entries) {
      addEntry({ id: `entry:${id}:${e.name}`, block: id, name: e.name, kind: e.kind, path: file, line: e.line, symbol: e.symbolName ? `${file}#${e.symbolName}` : undefined, detail: e.detail });
    }
  }
  for (const f of serverFacts) {
    if (claimedServers.has(f.path)) continue;
    const id = `service:server-${f.path}`;
    const b = addBlock({ id, name: `Serveur ${f.path.split("/").pop()}`, kind: "service", tech: "nodejs", subtitle: f.path, origin: ev(f.path, f.entries[0]!.line), files: [...closure(f.path)].sort(), entries: [] });
    for (const e of f.entries) addEntry({ id: `entry:${b.id}:${e.name}`, block: b.id, name: e.name, kind: e.kind, path: f.path, line: e.line, detail: e.detail });
  }

  // Code des blocs de fonctions : fermeture depuis les fichiers qui définissent les fonctions.
  for (const b of blocks.values()) {
    if (b.kind !== "service" || b.files.length) continue;
    const files = new Set<string>();
    for (const id of b.entries) for (const f of entryClosure.get(id) ?? []) files.add(f);
    b.files = [...files].sort();
    b.subtitle = b.subtitle || `${b.entries.length} fonctions`;
  }

  // Fichier → blocs qui l'exécutent ; fichier → points d'entrée qui l'atteignent.
  const blocksOfFile = new Map<string, string[]>();
  for (const b of blocks.values()) for (const f of b.files) blocksOfFile.set(f, [...(blocksOfFile.get(f) ?? []), b.id]);
  // Dans le fichier même d'une fonction, seules ses lignes (et celles des fonctions locales qu'elle utilise) comptent.
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const entriesOfFile = (file: string, block: string, line: number): string[] =>
    blocks.get(block)!.entries.filter((id) => {
      if (!entryClosure.get(id)?.has(file)) return false;
      const e = entryById.get(id)!;
      if (e.path !== file || e.kind === "app" || e.kind === "server" || e.kind === "http") return true;
      return (e.ranges ?? []).some(([a, b]) => line >= a && line <= b);
    });

  // ── 2. Liens ──
  const links = new Map<string, ArchLink>();
  const link = (from: string, to: string, kind: LinkKind, e: Evidence, target?: string): void => {
    const key = `${from}|${to}|${kind}`;
    const l = links.get(key) ?? { id: key, from, to, kind, count: 0, evidence: [], targets: [] };
    l.count++;
    if (l.evidence.length < MAX_EVIDENCE) l.evidence.push(target ? { ...e, target } : e);
    if (target && !l.targets.includes(target)) l.targets.push(target);
    links.set(key, l);
  };
  const managed = (id: string, name: string, kind: ArchBlock["kind"], tech: string | undefined, subtitle: string, origin: Evidence): ArchBlock =>
    addBlock({ id, name, kind, tech, subtitle, origin, files: [], entries: [] });

  const entryByName = new Map(entries.filter((e) => e.kind === "callable" || e.kind === "http" || e.kind === "task").map((e) => [e.name, e]));
  const collections = new Map<string, CollectionFact>();
  const aiProviders = new Map<string, Evidence[]>();
  const aiModels = new Map<string, Evidence[]>();
  const aiFiles = new Set<string>();
  const queueTargets: { label: string; evidence: Evidence }[] = [];
  const externals = new Map<string, Evidence[]>();

  for (const f of facts.values()) {
    const owners = blocksOfFile.get(f.path) ?? [];
    if (!owners.length) continue; // code qui n'est lancé par aucun bloc (scripts, docs, tests)

    for (const owner of owners) {
      const access = (op: string, e: Evidence): Access => ({ block: owner, op, path: e.path, line: e.line, text: e.text, entries: entriesOfFile(f.path, owner, e.line) });

      for (const c of f.callables) {
        const target = entryByName.get(c.name);
        if (target) link(owner, target.block, "calls", c.ev, target.id);
        else warnings.push({ code: "unknown_callable", message: `appel de la fonction « ${c.name} », qu'aucun fichier ne définit`, evidence: c.ev });
      }

      if (f.firestore.length) {
        const fs = managed("datastore:firestore", "Firestore", "datastore", "firebase", "", f.firestore[0]!.ev);
        for (const x of f.firestore) {
          link(owner, fs.id, x.op === "read" ? "reads" : "writes", x.ev);
          const col = collections.get(x.collection) ?? { path: x.collection, reads: [], writes: [], triggers: [] };
          (x.op === "read" ? col.reads : col.writes).push(access(x.op, x.ev));
          collections.set(x.collection, col);
        }
      }

      if (f.storage.length) {
        const st = managed("datastore:storage", "Cloud Storage", "datastore", "firebase", "fichiers", f.storage[0]!.ev);
        for (const x of f.storage) link(owner, st.id, x.op === "read" ? "reads" : "writes", x.ev);
      }

      if (f.auth.length) {
        const au = managed("capability:auth", "Authentification", "capability", "firebase", "Firebase Authentication", f.auth[0]!);
        for (const e of f.auth) link(owner, au.id, "uses", e);
      }

      if (f.ai.length) {
        const ai = managed("capability:ai", "Couche IA", "capability", undefined, "", f.ai[0]!.ev);
        aiFiles.add(f.path);
        for (const x of f.ai) {
          link(owner, ai.id, "uses", x.ev);
          aiProviders.set(x.tech, [...(aiProviders.get(x.tech) ?? []), x.ev]);
        }
      }
      for (const m of f.models) aiModels.set(m.name, [...(aiModels.get(m.name) ?? []), m.ev]);

      for (const q of f.enqueue) {
        const [kind, topic] = q.queue.split(":");
        const qb = kind === "cloud-tasks" ? managed("queue:cloud-tasks", "Cloud Tasks", "queue", "googlecloud", "file de tâches", q.ev) : managed(`queue:pubsub-${topic ?? "topic"}`, `Pub/Sub ${topic ?? ""}`.trim(), "queue", "googlecloud", "topic", q.ev);
        link(owner, qb.id, "enqueues", q.ev);
        if (q.target) queueTargets.push({ label: q.target, evidence: q.ev });
        // File de tâches Firebase : la cible est la fonction onTaskDispatched du même nom.
        const fnName = q.target?.startsWith("fonction ") ? q.target.slice(9) : undefined;
        const fn = fnName ? entryByName.get(fnName) : undefined;
        if (fn) link(qb.id, fn.block, "triggers", q.ev, fn.id);
      }

      for (const r of f.requests) {
        const ext = externalFor(r.target);
        if (!ext) continue;
        const b = managed(ext.id, ext.name, ext.kind, ext.tech, ext.subtitle, r.ev);
        link(owner, b.id, ext.kind === "capability" ? "uses" : "requests", r.ev);
        externals.set(b.id, [...(externals.get(b.id) ?? []), r.ev]);
      }
    }
  }

  // Déclencheurs Firestore → fonction.
  for (const e of entries.filter((x) => x.kind === "trigger" && x.detail)) {
    const segs = e.detail!.split(" · ")[0]!.split("/").filter(Boolean).map((s) => (s.startsWith("{") ? "{}" : s));
    const col = collectionOf(segs);
    if (!col) continue;
    const fs = managed("datastore:firestore", "Firestore", "datastore", "firebase", "", ev(e.path, e.line));
    link(fs.id, e.block, "triggers", ev(e.path, e.line), e.id);
    const c = collections.get(col) ?? { path: col, reads: [], writes: [], triggers: [] };
    c.triggers.push(e.id);
    collections.set(col, c);
  }

  // Règles Firestore : chaque `match /col/{id}` est une collection, avec sa ligne.
  const rulesFile = projectFiles.find((f) => /(^|\/)firestore\.rules$/.test(f.path));
  if (rulesFile && blocks.has("datastore:firestore")) {
    for (const r of parseRules(safeRead(root, rulesFile.path))) {
      const c = collections.get(r.path) ?? { path: r.path, reads: [], writes: [], triggers: [] };
      c.rules = { path: rulesFile.path, line: r.line, text: r.text };
      collections.set(r.path, c);
    }
  }

  // ── 3. Intérieurs ──
  const fs = blocks.get("datastore:firestore");
  if (fs) {
    const list = [...collections.values()].sort((a, b) => a.path.localeCompare(b.path));
    fs.interior = { kind: "datastore", collections: list };
    fs.subtitle = `${list.length} collections`;
  }
  const ai = blocks.get("capability:ai");
  if (ai) {
    const providers = [...aiProviders].map(([tech, evidence]) => ({ tech, name: catalogEntry(tech)?.name ?? tech, evidence: dedupe(evidence) })).sort((a, b) => a.name.localeCompare(b.name));
    // Points d'entrée dont le code atteint la couche IA, par imports.
    const aiDirs = aiLayerDirs([...aiFiles], model.files.map((f) => f.path));
    const inLayer = (f: string) => aiFiles.has(f) || aiDirs.includes(f.slice(0, f.lastIndexOf("/")));
    const usedBy = entries.filter((e) => [...(entryClosure.get(e.id) ?? [])].some(inLayer)).map((e) => e.id);
    ai.interior = { kind: "ai", providers, models: [...aiModels].map(([name, evidence]) => ({ name, evidence: dedupe(evidence) })).sort((a, b) => a.name.localeCompare(b.name)), files: [...aiFiles].sort(), usedBy, dirs: aiDirs };
    ai.subtitle = providers.map((p) => p.name.replace(/^Google |^Anthropic /, "")).join(", ");
  }
  const tasks = blocks.get("queue:cloud-tasks");
  if (tasks) {
    tasks.interior = { kind: "queue", targets: queueTargets };
    for (const t of queueTargets) {
      if (!t.label.startsWith("variable ")) continue;
      warnings.push({ code: "unresolved_target", message: `la file Cloud Tasks envoie vers l'URL lue dans ${t.label.slice(9).split(" ")[0]} : le service visé n'est écrit nulle part dans le code (à déclarer)`, evidence: t.evidence });
    }
  }
  for (const [id, urls] of externals) {
    const b = blocks.get(id)!;
    if (b.kind === "external") b.interior = { kind: "external", urls: dedupe(urls) };
  }
  for (const f of facts.values()) for (const d of f.dynamicPaths) if (blocksOfFile.has(f.path)) warnings.push({ code: "dynamic_path", message: "accès Firestore dont le chemin n'est pas écrit dans le code (calculé à l'exécution)", evidence: d });

  // Fonction appelable qu'aucun client du repository n'appelle : code mort, ou appelant hors du repository.
  const called = new Set([...links.values()].flatMap((l) => l.targets));
  for (const e of entries) {
    if (e.kind !== "callable" || called.has(e.id)) continue;
    warnings.push({ code: "uncalled_entry", message: `« ${e.name} » est une fonction appelable qu'aucun client du repository n'appelle`, evidence: ev(e.path, e.line) });
  }

  const order: ArchBlock["kind"][] = ["client", "service", "capability", "queue", "datastore", "external"];
  return {
    version: 1,
    blocks: [...blocks.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name)),
    entries: entries.sort((a, b) => a.block.localeCompare(b.block) || a.name.localeCompare(b.name)),
    links: [...links.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind)),
    warnings,
  };
}

/**
 * Dossiers qui forment un module IA (Nafar : `functions/src/ai/`) : au moins
 * deux fichiers y construisent un client d'IA, et ils pèsent au moins un
 * quart du dossier. Un dossier partagé (`functions/src/`) n'en est pas un :
 * seul le fichier qui construit le client compte alors.
 */
export function aiLayerDirs(aiFiles: string[], allFiles: string[]): string[] {
  const dirOf = (f: string) => f.slice(0, f.lastIndexOf("/"));
  const count = new Map<string, number>();
  for (const f of aiFiles) count.set(dirOf(f), (count.get(dirOf(f)) ?? 0) + 1);
  return [...count]
    .filter(([dir, n]) => n >= 2 && n / Math.max(1, allFiles.filter((f) => dirOf(f) === dir).length) >= 0.25)
    .map(([dir]) => dir)
    .sort();
}

function externalFor(t: RequestTarget): { id: string; name: string; kind: ArchBlock["kind"]; tech?: string; subtitle: string } | undefined {
  if (t.kind === "relative" || t.kind === "unknown") return undefined;
  if (t.kind === "env") return { id: `external:env-${t.name}`, name: backendName(t.name), kind: "external", subtitle: `URL lue dans ${t.name}` };
  if (/localhost|127\.0\.0\.1/.test(t.host)) return undefined;
  const ai = { "api.anthropic.com": "anthropic", "api.openai.com": "openai", "generativelanguage.googleapis.com": "gemini", "api.deepseek.com": "deepseek" }[t.host];
  if (ai) return { id: "capability:ai", name: "Couche IA", kind: "capability", subtitle: "" };
  return { id: `external:${t.host}`, name: t.host, kind: "external", subtitle: "hôte externe" };
}

/** `VITE_BACKEND_URL` → « Backend (VITE_BACKEND_URL) » : on nomme par la variable, on ne lit jamais la valeur. */
function backendName(env: string): string {
  const core = env.replace(/^(VITE_|NEXT_PUBLIC_|REACT_APP_)/, "").replace(/_(URL|BASE_URL|ENDPOINT|HOST|API)$/, "").replace(/_/g, " ").toLowerCase();
  return `${core ? core.charAt(0).toUpperCase() + core.slice(1) : "Backend"} (${env})`;
}

/** `match /users/{userId} { match /wallet/{docId}` → `users/{}/wallet`, avec la ligne. */
export function parseRules(content: string): { path: string; line: number; text: string }[] {
  const out: { path: string; line: number; text: string }[] = [];
  const stack: { depth: number; segs: string[] }[] = [];
  let depth = 0;
  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, "");
    // `match /users/{userId} {` : le chemin contient ses propres accolades, seule la dernière ouvre le bloc.
    const m = line.match(/match\s+(\/\S+?)\s*\{\s*$/);
    if (m) {
      while (stack.length && stack[stack.length - 1]!.depth >= depth) stack.pop();
      const parent = stack[stack.length - 1]?.segs ?? [];
      const segs = m[1]!.split("/").filter(Boolean).map((s) => (s.startsWith("{") ? "{}" : s));
      const full = [...parent, ...segs];
      stack.push({ depth, segs: full });
      const clean = full.filter((s, k) => !(k < 3 && (s === "databases" || (k === 1 && s === "{}") || s === "documents")));
      const col = clean.includes("{}=**") || clean.some((s) => s.includes("=**")) ? undefined : collectionOf(clean);
      if (col && clean.length % 2 === 0) out.push({ path: col, line: i + 1, text: raw.trim() });
    }
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  });
  return out;
}

function dedupe(evs: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evs.filter((e) => (seen.has(`${e.path}:${e.line}`) ? false : (seen.add(`${e.path}:${e.line}`), true))).slice(0, MAX_EVIDENCE);
}

function projectName(root: string): string {
  try {
    const name = (JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { name?: string }).name;
    if (name) return name.replace(/^@[^/]+\//, "");
  } catch {
    /* pas de package.json */
  }
  return root.replace(/\/+$/, "").split("/").pop() ?? "app";
}

function safeRead(root: string, path: string): string {
  try {
    return readFileSync(join(root, path), "utf-8");
  } catch {
    return "";
  }
}

function lineNumber(content: string, needle: string): number {
  const i = content.indexOf(needle);
  return i < 0 ? 1 : content.slice(0, i).split("\n").length;
}

function normalizePath(p: string): string {
  const out: string[] = [];
  for (const s of p.split("/")) {
    if (s === "." || s === "") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return out.join("/");
}

export { describeTarget };
