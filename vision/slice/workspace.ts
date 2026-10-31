import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Comment on travaille dans ce dépôt, lu dans ses fichiers : les commandes
 * déclarées, où sont les tests et comment ils sont lancés, où sont les
 * migrations. Un agent le cherche à chaque tâche (ls, cat package.json,
 * find -name "*.spec.ts") et chaque recherche est un appel de plus, où il
 * relit tout son contexte. Rien n'est deviné : seulement ce qui est écrit.
 */
export function workspaceLines(root: string): string[] {
  const files = tracked(root);
  if (!files.length) return [];
  const out: string[] = [];

  const lock = [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lockb", "bun"], ["package-lock.json", "npm"]].find(([f]) => files.includes(f!))?.[1];
  for (const pkg of files.filter((f) => f.endsWith("package.json") && f.split("/").length <= 3)) {
    let scripts: Record<string, string> = {};
    try { scripts = JSON.parse(readFileSync(join(root, pkg), "utf8")).scripts ?? {}; } catch { continue; }
    const names = Object.keys(scripts);
    if (!names.length) continue;
    const run = lock ? `${lock} ${lock === "npm" ? "run " : ""}` : "npm run ";
    const where = dirname(pkg) === "." ? "" : ` (dans ${dirname(pkg)})`;
    out.push(`  commandes${where}, à lancer avec « ${run}<nom> » : ${names.map((n) => `${n} = ${scripts[n]}`).join(" ; ")}`);
  }

  const tests = files.filter((f) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(f));
  const configs = files.filter((f) => /(^|\/)(vitest|jest|playwright|cypress)\.config\.[cm]?[jt]s$/.test(f));
  if (tests.length || configs.length) {
    const kinds = [...new Set(tests.map((f) => f.match(/\.(spec|test)\./)![1]))].map((k) => `*.${k}.*`).join(", ");
    out.push(`  tests : ${tests.length} fichier${tests.length > 1 ? "s" : ""}${kinds ? ` ${kinds}` : ""}${tests.length ? `, par exemple ${tests.slice(0, 3).join(", ")}` : ""}${configs.length ? ` ; configuration ${configs.join(", ")}` : ""}`);
  }

  const sqlDirs = new Map<string, string[]>();
  for (const f of files.filter((f) => f.endsWith(".sql"))) sqlDirs.set(dirname(f), [...(sqlDirs.get(dirname(f)) ?? []), f]);
  for (const [dir, list] of sqlDirs) {
    const sorted = list.sort();
    const runners = files.filter((f) => /migrat/i.test(f) && /\.[cm]?[jt]s$/.test(f) && !/\.(spec|test)\./.test(f));
    out.push(`  migrations SQL : ${dir}/, ${list.length} fichier${list.length > 1 ? "s" : ""}, la dernière ${sorted.at(-1)}${runners.length ? ` ; appliquées par ${runners.join(", ")}` : ""}`);
  }

  return out.length ? ["TRAVAILLER DANS CE DÉPÔT (lu dans ses fichiers)", ...out] : [];
}

function tracked(root: string): string[] {
  if (!existsSync(root)) return [];
  try {
    return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })
      .split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
