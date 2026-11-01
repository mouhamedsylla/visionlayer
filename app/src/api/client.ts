import type { KnowledgePayload, MapPayload, ProjectInfo, SourceExcerpt } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
  return body as T;
}

export const api = {
  project: () => get<ProjectInfo>("/api/project"),
  map: () => get<MapPayload>("/api/map"),
  knowledge: () => get<KnowledgePayload>("/api/knowledge"),
  source: (path: string, from: number, to: number) => get<SourceExcerpt>(`/api/source?path=${encodeURIComponent(path)}&from=${from}&to=${to}`),
  /** Une action humaine : recalculer la carte (ADR 0009). */
  refresh: async () => {
    const res = await fetch("/api/map/refresh", { method: "POST" });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as MapPayload;
  },
};
