import { posix } from "node:path";
import { args, literal, templateParts, unwrap, type Node } from "../arch/ast.js";

/** Les fichiers du dépôt qu'une commande lance : `pnpm exec tsx src/server.ts` → `src/server.ts`, relatif au dossier du manifeste. */
export function runTargets(command: string, dir: string): string[] {
  const out: string[] = [];
  for (const raw of command.split(/[\s,\[\]"']+/)) {
    if (!/\.(m?[jt]sx?|c[jt]s|py|go|rb|php|java|rs)$/.test(raw) || raw.includes("://")) continue;
    const p = posix.normalize(posix.join(dir, raw.replace(/^\.\//, "")));
    if (!p.startsWith("..")) out.push(p);
  }
  return out;
}

export function dirOf(path: string): string {
  const d = posix.dirname(path);
  return d === "." ? "" : d;
}

/** path.join(__dirname, "a.js"), `${__dirname}/a.js`, new URL("./a.js", import.meta.url), "./a.js" → "a.js". */
export function codeFilePath(h: Node): string | undefined {
  const lit = literal(h);
  if (lit !== undefined) return /\.(m|c)?[jt]s$/.test(lit) ? posix.normalize(lit) : undefined;
  if (h.type === "template_string") {
    const parts = templateParts(h);
    const head = parts[0];
    const tail = parts.slice(1).map((p) => ("text" in p ? p.text : "")).join("");
    if (head && "expr" in head && head.expr?.text === "__dirname" && /\.(m|c)?[jt]s$/.test(tail)) return posix.normalize(tail.replace(/^\//, ""));
    return undefined;
  }
  if (h.type === "call_expression" || h.type === "new_expression") {
    const a = args(h).map((x) => unwrap(x));
    const fnText = (h.childForFieldName("function") ?? h.childForFieldName("constructor"))?.text ?? "";
    if (/(^|\.)(join|resolve)$/.test(fnText) && a[0]?.text === "__dirname") {
      const rest = a.slice(1).map((x) => literal(x));
      if (rest.every((r) => r !== undefined) && /\.(m|c)?[jt]s$/.test(rest.at(-1)!)) return posix.normalize(posix.join(...(rest as string[])));
    }
    if (fnText === "URL" && a[1]?.text === "import.meta.url") { const r = literal(a[0]); if (r && /\.(m|c)?[jt]s$/.test(r)) return posix.normalize(r); }
  }
  return undefined;
}

/** Le fichier écrit, et sa source TypeScript à la même place. */
export function codeFileCandidates(p: string): string[] {
  const stem = p.replace(/\.(m|c)?[jt]s$/, "");
  return [...new Set([p, `${stem}.ts`, `${stem}.mts`, `${stem}.js`, `${stem}.mjs`])];
}

/** Le code compilé et sa source possible : `dist/server.js` → `src/server.ts`, `src/server.tsx`… (les règles gardent ce qui existe). */
export function sourceCandidates(rel: string): string[] {
  const out = new Set<string>();
  const bases = [rel];
  const m = rel.match(/^(?:(.*)\/)?(lib|dist|build|out)\/(.*)$/);
  if (m) bases.push(`${m[1] ? `${m[1]}/` : ""}src/${m[3]}`);
  for (const b of bases) {
    const stem = b.replace(/\.(c|m)?js$/, "");
    if (stem === b) continue;
    for (const ext of [".ts", ".tsx", ".mts", ".cts", ".js"]) if (stem + ext !== rel) out.add(stem + ext);
  }
  return [...out];
}
