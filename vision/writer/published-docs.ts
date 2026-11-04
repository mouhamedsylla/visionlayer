import { gunzipSync } from "node:zlib";

/**
 * La documentation d'un paquet non installé : celle qu'il publie sur npm (un simple clone n'a pas de node_modules). Le
 * tarball de la version déclarée par le projet est lu en mémoire : rien n'est écrit ni exécuté.
 */
export interface Doc { source: string; text: string }

/** Le dossier docs/ d'un paquet : la référence d'abord, sans dépasser cette taille en tout. */
const DOCS_LIMIT = 150_000;

export function selectDocs(files: { path: string; text: string }[], label: (path: string) => string): Doc[] {
  const out: Doc[] = [];
  const root = files.filter((f) => /^(readme(\.md)?|[^/]+\.d\.ts)$/i.test(f.path));
  for (const f of root) out.push({ source: label(f.path), text: f.text });
  const rank = (p: string) => (/reference|api/i.test(p) ? 0 : /guide/i.test(p) ? 1 : 2);
  const pages = files.filter((f) => /^docs?\/.*\.mdx?$/i.test(f.path)).sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
  let total = 0;
  for (const f of pages) {
    if (total + f.text.length > DOCS_LIMIT) continue;
    total += f.text.length;
    out.push({ source: label(f.path), text: f.text });
  }
  return out;
}

/** Les fichiers d'une archive tar : `package/README.md` rendu `README.md`. */
export function untar(tar: Buffer): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const str = (a: number, n: number) => tar.toString("utf8", a, a + n).replace(/\0.*$/s, "");
  for (let at = 0; at + 512 <= tar.length;) {
    const name = str(at, 100);
    if (!name) break;
    const size = parseInt(str(at + 124, 12).trim() || "0", 8);
    const type = str(at + 156, 1);
    const prefix = str(at + 345, 155);
    const full = prefix ? `${prefix}/${name}` : name;
    if ((type === "0" || type === "") && /\.(md|mdx|d\.ts)$|\/readme$/i.test(full)) {
      out.push({ path: full.replace(/^[^/]+\//, ""), text: tar.toString("utf8", at + 512, at + 512 + size) });
    }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

/** `^5.6.2` → `5.6.2` ; un intervalle qu'on ne sait pas lire : la dernière version. */
const exact = (v?: string) => v?.match(/\d+\.\d+\.\d+[\w.-]*/)?.[0];

async function versionManifest(pkg: string, version: string | undefined, get: typeof fetch) {
  for (const v of [exact(version), "latest"]) {
    if (!v) continue;
    const r = await get(`https://registry.npmjs.org/${pkg}/${v}`);
    if (r.ok) return (await r.json()) as { version: string; types?: string; typings?: string; dist?: { tarball?: string } };
  }
  return undefined;
}

/** README, types et docs/ du paquet publié, et de son @types s'il existe. Sans réseau ou sans paquet : rien. */
export async function publishedDocs(pkg: string, version?: string, get: typeof fetch = fetch, retryWait = 3000): Promise<Doc[]> {
  const typesName = `@types/${pkg.startsWith("@") ? pkg.slice(1).replace("/", "__") : pkg}`;
  const out: Doc[] = [];
  // Une coupure passagère n'enlève pas sa documentation à l'écrivain.
  const again = (async (url: string) => {
    for (let i = 1; ; i++) { try { return await get(url); } catch (e) { if (i >= 3) throw e; await new Promise((ok) => setTimeout(ok, retryWait * i)); } }
  }) as unknown as typeof fetch;
  for (const name of [pkg, typesName]) {
    try {
      const m = await versionManifest(name, name === pkg ? version : undefined, again);
      if (!m?.dist?.tarball) continue;
      const r = await again(m.dist.tarball);
      if (!r.ok) continue;
      const files = untar(gunzipSync(Buffer.from(await r.arrayBuffer())));
      const label = (p: string) => `npm : ${name}@${m.version}/${p}`;
      out.push(...selectDocs(files, label));
      // Les types que nomme le paquet, s'ils ne sont pas à sa racine.
      const types = (m.types ?? m.typings)?.replace(/^\.\//, "");
      const named = files.find((f) => f.path === types);
      if (named && !out.some((d) => d.source === label(named.path))) out.push({ source: label(named.path), text: named.text });
    } catch { /* pas de réseau, archive illisible : la fiche dira qu'elle n'a pas de documentation */ }
  }
  return out;
}
