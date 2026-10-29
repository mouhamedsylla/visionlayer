import { readFileSync } from "node:fs";
import { join, normalize } from "node:path";

/** Résout un import non relatif vers un fichier du repository, ou undefined (vrai paquet externe). */
export type AliasResolver = (fromPath: string, raw: string) => string | undefined;

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

interface PathsConfig {
  /** Dossier du tsconfig ("" à la racine). */
  dir: string;
  baseUrl: string;
  paths: [pattern: string, targets: string[]][];
}

/**
 * Imports internes écrits comme des paquets : alias `paths` des tsconfig
 * (`@/src/x`, `@/curriculum/y`) et paquets du workspace (`@nafar/firebase`).
 * Sans eux, 340 imports internes de Nafar passaient pour des dépendances
 * externes et tous les niveaux perdaient ces liens (ADR 0012).
 *
 * Déterministe, limité : `paths`/`baseUrl` du tsconfig le plus proche (sans
 * suivre `extends`), et pour un paquet du workspace `exports["."]`, `main`,
 * `types` puis `src/index.*` / `index.*`.
 */
export function createAliasResolver(root: string, knownFiles: Set<string>): AliasResolver {
  const configs: PathsConfig[] = [];
  const packages = new Map<string, { dir: string; entry?: string }>();

  for (const file of knownFilesAndManifests(root, knownFiles)) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
    if (/^tsconfig(\..+)?\.json$/.test(base)) {
      const doc = readJsonc(join(root, file)) as { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } } | undefined;
      const opts = doc?.compilerOptions;
      if (opts?.paths) configs.push({ dir, baseUrl: opts.baseUrl ?? ".", paths: Object.entries(opts.paths) });
    } else if (base === "package.json") {
      const doc = readJsonc(join(root, file)) as { name?: string; main?: string; types?: string; exports?: unknown } | undefined;
      if (!doc?.name) continue;
      const exp = doc.exports;
      const dot = typeof exp === "string" ? exp : exp && typeof exp === "object" ? (exp as Record<string, unknown>)["."] : undefined;
      const dotTarget = typeof dot === "string" ? dot : dot && typeof dot === "object" ? Object.values(dot as Record<string, unknown>).find((v) => typeof v === "string") : undefined;
      const entry = [dotTarget, doc.types, doc.main].find((x): x is string => typeof x === "string");
      packages.set(doc.name, entry ? { dir, entry } : { dir });
    }
  }
  // Le tsconfig le plus profond d'abord : le plus proche du fichier l'emporte.
  configs.sort((a, b) => b.dir.length - a.dir.length);

  const tryFile = (candidate: string): string | undefined => {
    const c = normalize(candidate).replace(/^\.\//, "");
    if (knownFiles.has(c)) return c;
    const stem = c.replace(/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/, "");
    for (const ext of EXTENSIONS) if (knownFiles.has(stem + ext)) return stem + ext;
    for (const ext of EXTENSIONS) if (knownFiles.has(join(stem, "index" + ext))) return join(stem, "index" + ext);
    return undefined;
  };

  return (fromPath, raw) => {
    if (raw.startsWith(".") || raw.startsWith("/")) return undefined;

    for (const cfg of configs) {
      if (cfg.dir && !fromPath.startsWith(cfg.dir + "/")) continue;
      // Motif le plus spécifique d'abord (`@/curriculum/*` avant `@/*`).
      const ordered = [...cfg.paths].sort((a, b) => b[0].length - a[0].length);
      for (const [pattern, targets] of ordered) {
        const star = pattern.indexOf("*");
        const prefix = star === -1 ? pattern : pattern.slice(0, star);
        const suffix = star === -1 ? "" : pattern.slice(star + 1);
        if (star === -1 ? raw !== pattern : !(raw.startsWith(prefix) && raw.endsWith(suffix) && raw.length >= prefix.length + suffix.length)) continue;
        const captured = star === -1 ? "" : raw.slice(prefix.length, raw.length - suffix.length);
        for (const t of targets) {
          const hit = tryFile(join(cfg.dir, cfg.baseUrl, t.replace("*", captured)));
          if (hit) return hit;
        }
      }
      break; // seul le tsconfig le plus proche s'applique
    }

    const name = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0]!;
    const pkg = packages.get(name);
    if (!pkg) return undefined;
    const sub = raw.slice(name.length).replace(/^\//, "");
    if (sub) return tryFile(join(pkg.dir, sub)) ?? tryFile(join(pkg.dir, "src", sub));
    return (pkg.entry ? tryFile(join(pkg.dir, pkg.entry)) : undefined) ?? tryFile(join(pkg.dir, "src", "index")) ?? tryFile(join(pkg.dir, "index"));
  };
}

function knownFilesAndManifests(root: string, knownFiles: Set<string>): string[] {
  // Les tsconfig/package.json ne sont pas des fichiers source : on les cherche à côté des dossiers connus.
  const dirs = new Set<string>([""]);
  for (const f of knownFiles) {
    const parts = f.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const out: string[] = [];
  for (const d of dirs) {
    for (const name of ["tsconfig.json", "tsconfig.app.json", "tsconfig.base.json", "package.json"]) {
      const rel = d ? `${d}/${name}` : name;
      try {
        readFileSync(join(root, rel));
        out.push(rel);
      } catch {
        /* absent */
      }
    }
  }
  return out.sort();
}

/** JSON avec commentaires et virgules finales (tsconfig). */
function readJsonc(path: string): unknown {
  try {
    const raw = readFileSync(path, "utf-8");
    let out = "";
    let inString = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i]!;
      if (inString) {
        out += c;
        if (c === "\\") out += raw[++i] ?? "";
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        out += c;
      } else if (c === "/" && raw[i + 1] === "/") {
        while (i < raw.length && raw[i] !== "\n") i++;
        out += "\n";
      } else if (c === "/" && raw[i + 1] === "*") {
        i += 2;
        while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
        i++;
      } else out += c;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return undefined;
  }
}
