import type { DeployPayload, KnowledgePayload, MapPayload, ProjectInfo, SourceExcerpt, StackPayload } from "./types";

async function request<T>(method: "GET" | "POST", path: string): Promise<T> {
  const res = await fetch(path, { method });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${method} ${path} : ${res.status}`);
  return body;
}

export const api = {
  project: () => request<ProjectInfo>("GET", "/api/project"),
  map: () => request<MapPayload>("GET", "/api/map"),
  /** Action humaine : relit les fichiers changés et recalcule la carte. */
  refreshMap: () => request<MapPayload>("POST", "/api/map/refresh"),
  /** Les technologies lues dans les manifestes et la configuration, pour la carte courante. */
  stack: () => request<StackPayload>("GET", "/api/stack"),
  /** Les chaînes de livraison du dépôt (workflows), lues sans rien lancer. */
  deploy: () => request<DeployPayload>("GET", "/api/deploy"),
  /** La connaissance déclarée (`.vision/knowledge/`) et son état contre le code. */
  knowledge: () => request<KnowledgePayload>("GET", "/api/knowledge"),
  /** Un passage d'un fichier cité par la carte, les secrets masqués. */
  source: (path: string, from: number, to: number) =>
    request<SourceExcerpt>("GET", `/api/source?${new URLSearchParams({ path, from: String(from), to: String(to) })}`),
};
