import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf, runTargets, sourceCandidates } from "./runs.js";

/**
 * Dockerfile, d'après son inventaire (docs/fonctionnement/packs/docker.md).
 *
 * unit(Fichier, Nom, "image", Ligne)       une image construite
 * dockerfile_pre(Fichier, Préfixe)         le dossier du Dockerfile (`api/`, ou rien à la racine) : le contexte deviné
 * docker_rel(Fichier, Nom, Chemin)          le fichier que lance l'image, relatif au contexte de build (et sa source, si c'est du compilé)
 * docker_pkg(Fichier, Nom, PackageJson, Script)  `npm start` : le script de ce package.json, relatif au contexte
 * unit_base(Fichier, Nom, Image)            l'image de départ de la dernière étape
 *
 * Le chemin lancé est un chemin de l'image : il part du WORKDIR, et les COPY disent de quel
 * chemin du contexte il vient ; un COPY --from remonte à ce qu'a copié l'autre étape.
 */
interface Copy { dest: string; src: string; dirCopy: boolean; from?: string }
interface Stage { name?: string; base: string; workdir: string; copies: Copy[]; vars: Map<string, string>; entrypoint?: string[]; cmd?: string[]; line: number }

const script: PackScript = ({ file, fact }) => {
  const dir = dirOf(file.path);
  const name = unitName(file.path);
  const out: FileFact[] = [fact("unit", [file.path, name, "image"], 1), fact("dockerfile_pre", [file.path, dir ? `${dir}/` : ""], 1)];
  const stages: Stage[] = [];
  let global = new Map<string, string>();
  let st: Stage | undefined;

  for (const { text, line } of instructions(file.source)) {
    const m = text.match(/^(\w+)\s+([\s\S]*)$/);
    if (!m) continue;
    const op = m[1]!.toUpperCase();
    const vars = st?.vars ?? global;
    const rest = m[2]!.trim();
    if (op === "FROM") {
      const parts = expand(rest, global).split(/\s+/).filter((p) => !p.startsWith("--"));
      const ref = parts[0] ?? "";
      const alias = /^as$/i.test(parts[1] ?? "") ? parts[2] : undefined;
      const parent = stages.find((s) => s.name?.toLowerCase() === ref.toLowerCase());
      st = parent
        ? { ...parent, name: alias, copies: [...parent.copies], vars: new Map(parent.vars), line }
        : { name: alias, base: ref.split("@")[0]!.split(":")[0]!.split("/").pop()!, workdir: "/", copies: [], vars: new Map(global), line };
      stages.push(st);
      continue;
    }
    if (op === "ARG" || op === "ENV") {
      for (const [k, v] of assignments(rest, op)) vars.set(k, expand(v, vars));
      if (!st) global = vars;
      continue;
    }
    if (!st) continue;
    if (op === "WORKDIR") { st.workdir = posix.resolve(st.workdir, unquote(expand(rest, vars))); continue; }
    if (op === "COPY" || op === "ADD") {
      const parts = parseArgs(expand(rest, vars));
      const from = parts.find((p) => p.startsWith("--from="))?.slice(7);
      const paths = parts.filter((p) => !p.startsWith("--"));
      if (paths.length < 2) continue;
      const dest = posix.resolve(st.workdir, paths.at(-1)!);
      for (const src of paths.slice(0, -1)) {
        if (/[*?]/.test(src) || src.includes("://")) continue;
        // Un dossier : `.`, `src/`, ou un nom sans extension (`COPY src ./src`).
        const dirCopy = src === "." || src.endsWith("/") || !/\.\w+$/.test(posix.basename(src));
        st.copies.push({ dest, src: from ? posix.resolve("/", src) : posix.normalize(src), dirCopy, ...(from ? { from } : {}) });
      }
      continue;
    }
    if (op === "CMD" || op === "ENTRYPOINT") {
      const args = parseArgs(expand(rest, vars));
      if (op === "CMD") st.cmd = args; else st.entrypoint = args;
    }
  }

  // Seule la dernière étape est l'image ; sa commande est son point d'entrée suivi de ses arguments.
  const last = stages.at(-1);
  if (!last) return out;
  out.push(fact("unit_base", [file.path, name, last.base], last.line));
  const command = [...(last.entrypoint ?? []), ...(last.cmd ?? [])];
  if (!command.length) return out;
  const text = command.join(" ");
  const ctxOf = (inImage: string) => contextPath(inImage, last, stages);
  for (const t of runTargets(text, "")) {
    const rel = ctxOf(posix.resolve(last.workdir, t)) ?? t;
    for (const c of [rel, ...sourceCandidates(rel)]) if (!c.startsWith("..")) out.push(fact("docker_rel", [file.path, name, c], last.line));
  }
  const scriptName = packageScript(command);
  if (scriptName) {
    const pkg = ctxOf(posix.join(last.workdir, "package.json")) ?? "package.json";
    if (!pkg.startsWith("..")) out.push(fact("docker_pkg", [file.path, name, pkg, scriptName], last.line));
  }
  return out;
};

/** `Dockerfile` → le nom du dossier (ou `image` à la racine) ; `Dockerfile.worker`, `worker.Dockerfile` → `worker`. */
function unitName(path: string): string {
  const base = posix.basename(path);
  const m = base.match(/^Dockerfile\.(.+)$/i) ?? base.match(/^(.+)\.Dockerfile$/i);
  if (m) return m[1]!;
  const d = dirOf(path);
  return d ? d.split("/").pop()! : "image";
}

/** Les instructions, une par entrée : les lignes terminées par `\` sont jointes, les commentaires retirés. */
function instructions(source: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let buf = "";
  let start = 0;
  source.split("\n").forEach((raw, i) => {
    const l = raw.replace(/\r$/, "");
    if (!buf && (/^\s*#/.test(l) || !l.trim())) return;
    if (!buf) start = i + 1;
    if (/\\\s*$/.test(l)) { buf += l.replace(/\\\s*$/, " "); return; }
    out.push({ text: (buf + l).trim(), line: start });
    buf = "";
  });
  if (buf) out.push({ text: buf.trim(), line: start });
  return out;
}

/** `ENV A=1 B=2`, `ENV A 1`, `ARG A=1`, `ARG A`. */
function assignments(rest: string, op: string): [string, string][] {
  if (!rest.includes("=")) {
    const [k, ...v] = rest.split(/\s+/);
    return k ? [[k, op === "ENV" ? unquote(v.join(" ")) : ""]] : [];
  }
  return [...rest.matchAll(/([A-Za-z_][\w]*)=("[^"]*"|'[^']*'|\S*)/g)].map((m) => [m[1]!, unquote(m[2]!)]);
}

/** `$A`, `${A}`, `${A:-défaut}` : la valeur écrite dans le Dockerfile ; une variable sans valeur reste telle quelle. */
function expand(s: string, vars: Map<string, string>): string {
  return s.replace(/\$\{(\w+)(?::?-([^}]*))?\}|\$(\w+)/g, (all, a: string | undefined, def: string | undefined, b: string | undefined) => {
    const v = vars.get((a ?? b)!);
    return v !== undefined && v !== "" ? v : def ?? all;
  });
}

function unquote(s: string): string { return s.trim().replace(/^["']|["']$/g, ""); }

/** Le chemin du contexte de build d'où vient un fichier de l'image : le dernier COPY qui le couvre, d'étape en étape. */
function contextPath(inImage: string, st: Stage, stages: Stage[], depth = 0): string | undefined {
  for (const c of [...st.copies].reverse()) {
    let inSrc: string | undefined;
    if (c.dirCopy && (inImage === c.dest || inImage.startsWith(`${c.dest}/`))) inSrc = posix.join(c.src, posix.relative(c.dest, inImage));
    else if (!c.dirCopy && (inImage === c.dest || inImage === posix.join(c.dest, posix.basename(c.src)))) inSrc = c.src;
    if (inSrc === undefined) continue;
    if (!c.from) return inSrc;
    const other = stages.find((s) => s.name?.toLowerCase() === c.from!.toLowerCase()) ?? stages[Number(c.from)];
    return other && depth < 5 ? contextPath(inSrc, other, stages, depth + 1) : undefined;
  }
  return undefined;
}

/** `npm start`, `npm run serve`, `pnpm start`, `yarn serve`, `bun run x` → le nom du script. */
function packageScript(cmd: string[]): string | undefined {
  const i = cmd.findIndex((c) => /^(npm|pnpm|yarn|bun)$/.test(c));
  if (i < 0) return undefined;
  const [a, b] = [cmd[i + 1], cmd[i + 2]];
  if (a === "run" || a === "run-script") return b;
  if (a === "start" || a === "test") return a;
  if (cmd[i] !== "npm" && a && !/^(exec|dlx|x|install|add|i|-)/.test(a)) return a;
  return undefined;
}

/** `["a", "b"]` ou `a b`. */
function parseArgs(rest: string): string[] {
  if (rest.startsWith("[")) {
    try { return (JSON.parse(rest) as unknown[]).map(String); } catch { /* forme shell */ }
  }
  return rest.split(/\s+/).filter(Boolean);
}
export default script;
