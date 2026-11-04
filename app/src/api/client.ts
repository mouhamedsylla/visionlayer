import type { StackPayload } from "../../../vision/web/types";
import type { AgentLink, AgentSession, Replay, ReplayTest, VigieAnswer, VigieStep, KnowledgePayload, MapPayload, PacksPayload, ProjectInfo, SourceExcerpt, WriterJob } from "./types";
import { READ_ONLY, recordedQuestions, SNAPSHOT, snapshotGet } from "./snapshot";

/** Un Replay tel que l'écran le voit : le correctif de l'agent seulement une fois le sien rendu. */
export type ReplayView = Replay & { agentPatch?: string; yourDiff?: string };

async function get<T>(path: string): Promise<T> {
  if (SNAPSHOT) return snapshotGet(path) as Promise<T>;
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
  return body as T;
}

async function post<T>(path: string): Promise<T> {
  if (SNAPSHOT) throw new Error(READ_ONLY);
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
  /** Une question à Vigie : Muse Spark répond depuis la carte, preuves à l'appui. */
  vigie: (q: string) => post<VigieAnswer>(`/api/vigie?q=${encodeURIComponent(q)}`),
  /** La question, avec chaque lecture de Vigie au moment où elle a lieu. */
  vigieStream: async (q: string, onStep: (s: VigieStep) => void): Promise<VigieAnswer> => {
    if (SNAPSHOT) {
      const hit = (await recordedQuestions()).find((x) => x.q === q);
      if (!hit) throw new Error(READ_ONLY);
      for (const s of hit.answer.steps) { await new Promise((r) => setTimeout(r, 180)); onStep(s); }
      return hit.answer;
    }
    const res = await fetch(`/api/vigie/stream?q=${encodeURIComponent(q)}`, { method: "POST" });
    if (!res.ok || !res.body) throw new Error(`${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let rest = "";
    for (;;) {
      const { done, value } = await reader.read();
      rest += dec.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = rest.split("\n");
      rest = lines.pop() ?? "";
      for (const l of lines.filter(Boolean)) {
        const m = JSON.parse(l) as { step?: VigieStep; answer?: VigieAnswer; error?: string };
        if (m.step) onStep(m.step);
        if (m.error) throw new Error(m.error);
        if (m.answer) return m.answer;
      }
      if (done) throw new Error("réponse interrompue");
    }
  },
  replays: () => get<Replay[]>("/api/replays"),
  replay: (id: string) => get<ReplayView>(`/api/replays/one?id=${id}`),
  /** Gestes humains du Replay : garder une session, ouvrir sa copie, lancer les tests, demander, rendre. */
  keepReplay: (session: string) => post<Replay>(`/api/replays/create?session=${encodeURIComponent(session)}`),
  startReplay: (id: string) => post<ReplayView>(`/api/replays/start?id=${id}`),
  testReplay: (id: string) => post<ReplayTest[]>(`/api/replays/test?id=${id}`),
  askReplay: (id: string, a: { q?: string; hint?: number }) => post<VigieAnswer>(`/api/replays/ask?id=${id}${a.hint ? `&hint=${a.hint}` : `&q=${encodeURIComponent(a.q ?? "")}`}`),
  replayFiles: (id: string) => get<{ path: string; test: boolean; text: string }[]>(`/api/replays/files?id=${id}`),
  saveReplayFile: async (id: string, path: string, text: string) => {
    if (SNAPSHOT) throw new Error(READ_ONLY);
    const res = await fetch(`/api/replays/save?id=${id}&path=${encodeURIComponent(path)}`, { method: "POST", body: text });
    if (!res.ok) throw new Error((await res.json())?.error ?? `${res.status}`);
    return (await res.json()) as { ok: boolean; diff: string };
  },
  prepareProposal: (id: string) => post<ReplayView>(`/api/replays/prepare?id=${id}`),
  propose: (id: string) => post<ReplayView>(`/api/replays/propose?id=${id}`),
  reopenReplay: (id: string) => post<ReplayView>(`/api/replays/reopen?id=${id}`),
  resetReplay: (id: string) => post<ReplayView>(`/api/replays/reset?id=${id}`),
  submitReplay: (id: string) => post<ReplayView>(`/api/replays/submit?id=${id}`),
  style: () => get<{ confirmed?: string[]; at?: string }>("/api/style"),
  /** Geste humain de la planche L3 : confirmer ou corriger les styles proposés. */
  confirmStyle: (ids: string[]) => post<{ confirmed?: string[]; at?: string }>(`/api/style/confirm?ids=${ids.join(",")}`),
  links: () => get<AgentLink[]>("/api/settings/agents"),
  /** Gestes humains des Réglages : poser ou retirer les liens d'un agent avec VisionLayer. */
  link: (agent: string) => post<AgentLink[]>(`/api/settings/link?agent=${agent}`),
  unlink: (agent: string) => post<AgentLink[]>(`/api/settings/unlink?agent=${agent}`),
  /** Les gestes humains de l'écran Packs (ADR 0019) : accepter, refuser, lancer l'écrivain. */
  accept: (id: string) => post<PacksPayload>(`/api/packs/accept?id=${encodeURIComponent(id)}`),
  reject: (id: string) => post<PacksPayload>(`/api/packs/reject?id=${encodeURIComponent(id)}`),
  write: (pkgs: string[]) => post<{ queue: string[]; job?: WriterJob }>(`/api/packs/write?pkg=${encodeURIComponent(pkgs.join(","))}`),
  dequeue: (pkg: string) => post<PacksPayload>(`/api/packs/dequeue?pkg=${encodeURIComponent(pkg)}`),
  retire: (id: string) => post<PacksPayload>(`/api/packs/retire?id=${encodeURIComponent(id)}`),
  stack: () => get<StackPayload>("/api/stack"),
  /** Une action humaine : recalculer la carte (ADR 0009). */
  refresh: async () => {
    if (SNAPSHOT) return api.map();
    const res = await fetch("/api/map/refresh", { method: "POST" });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as MapPayload;
  },
};
