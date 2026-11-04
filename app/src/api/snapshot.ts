/**
 * La démonstration en ligne : ce qu'un vrai serveur VisionLayer a rendu pour un projet, figé par `cli/snapshot.ts`.
 * Rien n'y est simulé. Les gestes qui demandent une exécution (Vigie libre, écriture d'un pack, Replay) restent en local.
 */
export const SNAPSHOT = import.meta.env.VITE_SNAPSHOT === "1";
export const PROJECTS = [{ id: "barbershop", name: "Barbershop-Booking-System" }, { id: "mini-erp", name: "mini-erp-crm" }];
export const snapshotProject = () => { const p = new URLSearchParams(window.location.search).get("p"); return PROJECTS.some((x) => x.id === p) ? p! : PROJECTS[0]!.id; };
const base = () => `./snapshot/${snapshotProject()}`;
const cache = new Map<string, Promise<any>>();
const load = (name: string) => cache.get(name) ?? cache.set(name, fetch(`${base()}/${name}.json`).then((r) => { if (!r.ok) throw new Error(`${name} absent`); return r.json(); })).get(name)!;

const NAMES: Record<string, string> = { "/api/project": "project", "/api/map": "map", "/api/knowledge": "knowledge", "/api/packs": "packs", "/api/agents": "agents", "/api/replays": "replays", "/api/style": "style", "/api/settings/agents": "links", "/api/stack": "stack" };

export async function snapshotGet(path: string): Promise<any> {
  const [p, q] = path.split("?");
  const params = new URLSearchParams(q ?? "");
  if (p === "/api/source") {
    const all = await load("source");
    const lines: string[] | undefined = all[params.get("path")!];
    if (!lines) throw new Error("fichier absent de la démonstration");
    const from = Math.max(1, Number(params.get("from")) || 1), to = Math.min(lines.length, Number(params.get("to")) || lines.length);
    return { path: params.get("path"), from, to, total: lines.length, lines: lines.slice(from - 1, to) };
  }
  if (p === "/api/replays/one") return load(`replay-one-${params.get("id")}`);
  if (p === "/api/replays/files") return load(`replay-files-${params.get("id")}`);
  if (NAMES[p!]) return load(NAMES[p!]!);
  throw new Error("non disponible dans la démonstration en ligne");
}

export const READ_ONLY = "Démonstration en lecture seule : ce geste tourne quand VisionLayer est lancé sur ton projet.";

/** Les réponses de Vigie enregistrées sur ce projet. */
export async function recordedQuestions(): Promise<{ q: string; answer: any }[]> {
  try { return await load("vigie"); } catch { return []; }
}
