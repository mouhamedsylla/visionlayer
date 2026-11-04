import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { redactSecrets } from "../vision/web/source.js";

/**
 * `tsx cli/snapshot.ts <url du serveur> <projet> <dossier de sortie> [réponses de Vigie en JSON]`
 * Fige ce qu'un serveur VisionLayer rend pour un projet, pour publier une démonstration en lecture seule. Rien n'est
 * recalculé ni retouché : le JSON est celui de l'API, avec les chemins de la machine retirés.
 */
const [url, root, out, vigie] = process.argv.slice(2);
if (!url || !root || !out) throw new Error("usage : snapshot <url> <projet> <sortie> [vigie.json]");
mkdirSync(out, { recursive: true });
const clean = (t: string) => t.split(root).join(".").split(homedir()).join("~");
const save = (name: string, text: string) => writeFileSync(join(out, name), clean(text));
const get = async (p: string) => { const r = await fetch(`${url}${p}`); return r.ok ? r.text() : undefined; };

for (const [name, path] of [["project", "/api/project"], ["map", "/api/map"], ["knowledge", "/api/knowledge"], ["packs", "/api/packs"], ["agents", "/api/agents"], ["replays", "/api/replays"], ["style", "/api/style"], ["links", "/api/settings/agents"], ["stack", "/api/stack"]] as const) {
  const t = await get(path);
  if (t) save(`${name}.json`, t);
}
const replays = JSON.parse(readFileSync(join(out, "replays.json"), "utf8")) as { id: string }[];
for (const r of replays) {
  for (const [n, p] of [["one", "one"], ["files", "files"]] as const) { const t = await get(`/api/replays/${p}?id=${r.id}`); if (t) save(`replay-${n}-${r.id}.json`, t); }
}
// Le code du dépôt, pour ouvrir chaque preuve.
const files: Record<string, string[]> = {};
for (const f of execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter((x) => /\.(ts|tsx|js|jsx|mjs|prisma|sql|ya?ml|json|toml)$/.test(x) && !/lock/.test(x))) {
  try { if (statSync(join(root, f)).size < 200_000) files[f] = readFileSync(join(root, f), "utf8").split("\n").map(redactSecrets); } catch { /* un fichier retiré */ }
}
writeFileSync(join(out, "source.json"), JSON.stringify(files));
if (vigie) writeFileSync(join(out, "vigie.json"), clean(readFileSync(vigie, "utf8")));
console.log(`figé : ${out}, ${Object.keys(files).length} fichiers, ${replays.length} replays`);
