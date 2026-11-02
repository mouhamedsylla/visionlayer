import type { AgentSession, KnowledgePayload, MapPayload, PacksPayload, ProjectInfo, SourceExcerpt, WriterJob } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
  return body as T;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
  return body as T;
}

export const api = {
  project: () => get<ProjectInfo>("/api/project"),
  map: () => get<MapPayload>("/api/map"),
  knowledge: () => get<KnowledgePayload>("/api/knowledge"),
  source: (path: string, from: number, to: number) => get<SourceExcerpt>(`/api/source?path=${encodeURIComponent(path)}&from=${from}&to=${to}`),
  packs: () => get<PacksPayload>("/api/packs"),
  agents: () => get<AgentSession[]>("/api/agents"),
  /** Les gestes humains de l'écran Packs (ADR 0019) : accepter, refuser, lancer l'écrivain. */
  accept: (id: string) => post<PacksPayload>(`/api/packs/accept?id=${encodeURIComponent(id)}`),
  reject: (id: string) => post<PacksPayload>(`/api/packs/reject?id=${encodeURIComponent(id)}`),
  write: (pkg: string) => post<WriterJob>(`/api/packs/write?pkg=${encodeURIComponent(pkg)}`),
  /** Une action humaine : recalculer la carte (ADR 0009). */
  refresh: async () => {
    const res = await fetch("/api/map/refresh", { method: "POST" });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as MapPayload;
  },
};
