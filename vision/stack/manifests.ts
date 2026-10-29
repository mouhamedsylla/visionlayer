import type { Ecosystem } from "./types.js";

/** Une dépendance telle qu'écrite dans un manifeste. */
export interface PackageDecl {
  ecosystem: Ecosystem;
  manifest: string;
  line?: number;
  name: string;
  range: string;
  dev: boolean;
  /** Extras pip (`manim-voiceover[azure]` → ["azure"]). */
  extras?: string[];
  /** peerDependencies : une contrainte sur l'hôte, pas une version utilisée. */
  peer?: boolean;
}

/** Une version d'exécution écrite dans un fichier (`engines.node`, `packageManager`, `requires-python`). */
export interface RuntimeDecl {
  tech: string;
  value: string;
  field: string;
  path: string;
  line?: number;
}

export interface ParsedManifest {
  ecosystem: Ecosystem;
  name: string;
  packages: PackageDecl[];
  runtimes: RuntimeDecl[];
}

const MANIFEST_NAMES: Record<string, Ecosystem> = {
  "package.json": "npm",
  "pyproject.toml": "pypi",
  "go.mod": "go",
  "Cargo.toml": "cargo",
  "composer.json": "composer",
  Gemfile: "gem",
};

export function isManifest(path: string): boolean {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base in MANIFEST_NAMES || /^requirements[^/]*\.txt$/.test(base);
}

function dirName(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function lineOf(lines: string[], re: RegExp, from = 0): number | undefined {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i]!)) return i + 1;
  return undefined;
}

const unquoted = (s: string) => s.replace(/"[^"]*"|'[^']*'/g, "");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Nom PyPI normalisé (PEP 503) : `Python_Dotenv` → `python-dotenv`. */
export function normalizePypi(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** `manim-voiceover[azure]>=0.3 ; python_version<"3.13"` → nom + contrainte. */
function parsePep508(spec: string): { name: string; range: string; extras: string[] } | undefined {
  const m = spec.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*([^;]*)/);
  if (!m) return undefined;
  const extras = m[2] ? m[2].slice(1, -1).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) : [];
  return { name: normalizePypi(m[1]!), range: m[3]!.trim() || "*", extras };
}

export function parseManifest(path: string, content: string): ParsedManifest {
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (/^requirements[^/]*\.txt$/.test(base)) return parseRequirements(path, content);
  switch (MANIFEST_NAMES[base]) {
    case "npm":
      return parsePackageJson(path, content);
    case "pypi":
      return parsePyproject(path, content);
    case "go":
      return parseGoMod(path, content);
    case "cargo":
      return parseCargo(path, content);
    case "composer":
      return parseComposer(path, content);
    case "gem":
      return parseGemfile(path, content);
    default:
      throw new Error(`manifeste non reconnu : ${path}`);
  }
}

function parsePackageJson(path: string, content: string): ParsedManifest {
  const doc = JSON.parse(content) as Record<string, unknown>;
  const lines = content.split("\n");
  const packages: PackageDecl[] = [];
  const sections: [string, boolean][] = [
    ["dependencies", false],
    ["devDependencies", true],
    ["peerDependencies", false],
    ["optionalDependencies", false],
  ];
  for (const [section, dev] of sections) {
    const peer = section === "peerDependencies";
    const deps = doc[section];
    if (!deps || typeof deps !== "object") continue;
    const start = (lineOf(lines, new RegExp(`^\\s*"${section}"\\s*:`)) ?? 1) - 1;
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof range !== "string") continue;
      packages.push({ ecosystem: "npm", manifest: path, line: lineOf(lines, new RegExp(`^\\s*"${escapeRe(name)}"\\s*:`), start), name, range, dev, ...(peer ? { peer } : {}) });
    }
  }
  const runtimes: RuntimeDecl[] = [];
  const engines = (doc.engines ?? {}) as Record<string, unknown>;
  for (const [engine, value] of Object.entries(engines)) {
    const tech = engine === "node" ? "nodejs" : engine;
    if (typeof value === "string") runtimes.push({ tech, value, field: `engines.${engine}`, path, line: lineOf(lines, new RegExp(`^\\s*"${escapeRe(engine)}"\\s*:`, "")) });
  }
  if (typeof doc.packageManager === "string") {
    const [pm, version] = doc.packageManager.split("@");
    if (pm) runtimes.push({ tech: pm, value: (version ?? "").split("+")[0]!, field: "packageManager", path, line: lineOf(lines, /"packageManager"\s*:/) });
  }
  const dir = dirName(path);
  return { ecosystem: "npm", name: typeof doc.name === "string" ? doc.name : dir || "(racine)", packages, runtimes };
}

/**
 * pyproject.toml : `[project]` (PEP 621 : dependencies, optional-dependencies,
 * requires-python), `[build-system].requires`, `[tool.poetry.*dependencies]`.
 * Lecteur TOML minimal : tables, chaînes, tableaux de chaînes sur plusieurs lignes.
 */
function parsePyproject(path: string, content: string): ParsedManifest {
  const lines = content.split("\n");
  const packages: PackageDecl[] = [];
  const runtimes: RuntimeDecl[] = [];
  let table = "";
  let name = dirName(path) || "(racine)";
  let arrayKey: string | null = null;

  const addSpec = (spec: string, line: number, dev: boolean) => {
    const p = parsePep508(spec);
    if (p) packages.push({ ecosystem: "pypi", manifest: path, line, name: p.name, range: p.range, dev, ...(p.extras.length ? { extras: p.extras } : {}) });
  };
  const arrayIsDev = (key: string) => table === "project.optional-dependencies" ? /^(dev|test|tests|lint|docs)$/.test(key) : table === "build-system";

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (arrayKey !== null) {
      for (const m of line.matchAll(/"([^"]+)"|'([^']+)'/g)) addSpec(m[1] ?? m[2]!, i + 1, arrayIsDev(arrayKey));
      // Le `]` d'un extra (`"x[azure]"`) est dans une chaîne : seul un `]` hors guillemets ferme le tableau.
      if (unquoted(line).includes("]")) arrayKey = null;
      return;
    }
    const t = line.match(/^\[([^\]]+)\]$/);
    if (t) {
      table = t[1]!.trim();
      return;
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!kv) return;
    const [, key, value] = kv as unknown as [string, string, string];
    if (table === "project" && key === "name") name = value.replace(/^["']|["']$/g, "");
    if (table === "project" && key === "requires-python") runtimes.push({ tech: "python", value: value.replace(/^["']|["']$/g, ""), field: "requires-python", path, line: i + 1 });
    const isDepArray = (table === "project" && key === "dependencies") || table === "project.optional-dependencies" || (table === "build-system" && key === "requires");
    if (isDepArray && value.startsWith("[")) {
      for (const m of value.matchAll(/"([^"]+)"|'([^']+)'/g)) addSpec(m[1] ?? m[2]!, i + 1, arrayIsDev(key));
      if (!unquoted(value).includes("]")) arrayKey = key;
      return;
    }
    const poetry = table.match(/^tool\.poetry\.(?:group\.([^.]+)\.)?(dev-)?dependencies$/);
    if (poetry) {
      if (key === "python") {
        runtimes.push({ tech: "python", value: value.replace(/^["']|["']$/g, ""), field: "tool.poetry.dependencies.python", path, line: i + 1 });
        return;
      }
      const version = value.match(/^["']([^"']*)["']/)?.[1] ?? value.match(/version\s*=\s*["']([^"']*)["']/)?.[1] ?? "*";
      packages.push({ ecosystem: "pypi", manifest: path, line: i + 1, name: normalizePypi(key), range: version, dev: Boolean(poetry[2]) || (poetry[1] !== undefined && poetry[1] !== "main") });
    }
  });
  return { ecosystem: "pypi", name, packages, runtimes };
}

function parseRequirements(path: string, content: string): ParsedManifest {
  const packages: PackageDecl[] = [];
  const dev = /dev|test|lint/i.test(path.slice(path.lastIndexOf("/") + 1));
  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) return;
    const p = parsePep508(line);
    if (p) packages.push({ ecosystem: "pypi", manifest: path, line: i + 1, name: p.name, range: p.range, dev, ...(p.extras.length ? { extras: p.extras } : {}) });
  });
  return { ecosystem: "pypi", name: dirName(path) || "(racine)", packages, runtimes: [] };
}

function parseGoMod(path: string, content: string): ParsedManifest {
  const packages: PackageDecl[] = [];
  const runtimes: RuntimeDecl[] = [];
  let name = dirName(path) || "(racine)";
  let inRequire = false;
  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, "").trim();
    const mod = line.match(/^module\s+(\S+)/);
    if (mod) name = mod[1]!;
    const go = line.match(/^go\s+(\S+)/);
    if (go) runtimes.push({ tech: "go", value: go[1]!, field: "go", path, line: i + 1 });
    if (/^require\s*\($/.test(line)) return void (inRequire = true);
    if (inRequire && line === ")") return void (inRequire = false);
    const req = inRequire ? line.match(/^(\S+)\s+(\S+)/) : line.match(/^require\s+(\S+)\s+(\S+)/);
    if (req) packages.push({ ecosystem: "go", manifest: path, line: i + 1, name: req[1]!, range: req[2]!, dev: false });
  });
  return { ecosystem: "go", name, packages, runtimes };
}

function parseCargo(path: string, content: string): ParsedManifest {
  const packages: PackageDecl[] = [];
  let table = "";
  let name = dirName(path) || "(racine)";
  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "").trim();
    const t = line.match(/^\[([^\]]+)\]$/);
    if (t) return void (table = t[1]!.trim());
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!kv) return;
    if (table === "package" && kv[1] === "name") name = kv[2]!.replace(/^["']|["']$/g, "");
    if (/(^|\.)(dev-|build-)?dependencies$/.test(table)) {
      const version = kv[2]!.match(/^["']([^"']*)["']/)?.[1] ?? kv[2]!.match(/version\s*=\s*["']([^"']*)["']/)?.[1] ?? "*";
      packages.push({ ecosystem: "cargo", manifest: path, line: i + 1, name: kv[1]!, range: version, dev: /dev-/.test(table) });
    }
  });
  return { ecosystem: "cargo", name, packages, runtimes: [] };
}

function parseComposer(path: string, content: string): ParsedManifest {
  const doc = JSON.parse(content) as Record<string, unknown>;
  const lines = content.split("\n");
  const packages: PackageDecl[] = [];
  const runtimes: RuntimeDecl[] = [];
  for (const [section, dev] of [["require", false], ["require-dev", true]] as const) {
    for (const [name, range] of Object.entries((doc[section] ?? {}) as Record<string, string>)) {
      const line = lineOf(lines, new RegExp(`^\\s*"${escapeRe(name)}"\\s*:`));
      if (name === "php") runtimes.push({ tech: "php", value: range, field: `${section}.php`, path, line });
      else if (!name.startsWith("ext-")) packages.push({ ecosystem: "composer", manifest: path, line, name, range, dev });
    }
  }
  return { ecosystem: "composer", name: typeof doc.name === "string" ? doc.name : dirName(path) || "(racine)", packages, runtimes };
}

function parseGemfile(path: string, content: string): ParsedManifest {
  const packages: PackageDecl[] = [];
  const runtimes: RuntimeDecl[] = [];
  let group = false;
  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/#.*$/, "").trim();
    if (/^group\b.*(:development|:test)/.test(line)) group = true;
    if (line === "end") group = false;
    const ruby = line.match(/^ruby\s+["']([^"']+)["']/);
    if (ruby) runtimes.push({ tech: "ruby", value: ruby[1]!, field: "ruby", path, line: i + 1 });
    const gem = line.match(/^gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/);
    if (gem) packages.push({ ecosystem: "gem", manifest: path, line: i + 1, name: gem[1]!, range: gem[2] ?? "*", dev: group });
  });
  return { ecosystem: "gem", name: dirName(path) || "(racine)", packages, runtimes };
}

/**
 * Dockerfile : paquets système (`apt-get install`, `apk add`), paquets Python
 * (`pip install`) et npm globaux (`npm install -g`) installés dans l'image.
 */
export function parseDockerfileInstalls(path: string, content: string): { system: { name: string; line: number }[]; packages: PackageDecl[] } {
  const system: { name: string; line: number }[] = [];
  const packages: PackageDecl[] = [];
  // Instructions logiques : les lignes terminées par une barre oblique inverse sont jointes.
  const logical: { text: string; line: number }[] = [];
  let cur: { text: string; line: number } | null = null;
  content.split("\n").forEach((raw, i) => {
    if (cur && raw.trim().startsWith("#")) return;
    const cont = /\\\s*$/.test(raw);
    const piece = raw.replace(/\\\s*$/, " ");
    if (cur) cur.text += ` ${piece.trim()}`;
    else cur = { text: piece.trim(), line: i + 1 };
    if (!cont) {
      logical.push(cur);
      cur = null;
    }
  });
  if (cur) logical.push(cur);

  for (const { text, line } of logical) {
    if (!/^RUN\s/i.test(text)) continue;
    for (const cmd of text.replace(/^RUN\s+/i, "").split(/&&|;|\|\|/)) {
      const words = cmd.trim().split(/\s+/);
      const apt = words.findIndex((w, k) => (w === "install" && /apt(-get)?$/.test(words[k - 1] ?? "")) || (w === "add" && words[k - 1] === "apk"));
      if (apt >= 0) {
        for (const w of words.slice(apt + 1)) if (!w.startsWith("-") && /^[a-z0-9][a-z0-9.+-]*$/.test(w)) system.push({ name: w.replace(/=.*$/, ""), line });
        continue;
      }
      const pip = words.findIndex((w, k) => w === "install" && /^pip3?$/.test(words[k - 1] ?? ""));
      if (pip >= 0) {
        for (const w of words.slice(pip + 1)) {
          const spec = w.replace(/^["']|["']$/g, "");
          if (spec.startsWith("-") || spec.includes("/") || !/^[A-Za-z0-9]/.test(spec)) continue;
          const p = parsePep508(spec);
          if (p) packages.push({ ecosystem: "pypi", manifest: path, line, name: p.name, range: p.range, dev: false, ...(p.extras.length ? { extras: p.extras } : {}) });
        }
        continue;
      }
      const npmG = words.findIndex((w, k) => (w === "install" || w === "i") && words[k - 1] === "npm") ;
      if (npmG >= 0 && words.includes("-g")) {
        for (const w of words.slice(npmG + 1)) if (!w.startsWith("-")) {
          const at = w.lastIndexOf("@");
          const name = at > 0 ? w.slice(0, at) : w;
          packages.push({ ecosystem: "npm", manifest: path, line, name, range: at > 0 ? w.slice(at + 1) : "*", dev: false });
        }
      }
    }
  }
  return { system, packages };
}
