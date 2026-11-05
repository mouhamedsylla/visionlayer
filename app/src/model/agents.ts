import type { AgentSession, ArchNode, MapPayload } from "../api/types";
import { plural } from "./words";

/**
 * L'écran Agents (planche 13) : qui travaille sur le projet, sur quoi, pour combien. Tout vient de ce que les
 * agents consignent eux-mêmes ; la carte relie chaque fichier écrit à son module et à son bloc.
 */

export const AGENT: Record<AgentSession["agent"], { name: string; mono: string }> = {
  muse: { name: "Muse Code", mono: "MC" }, claude: { name: "Claude Code", mono: "CC" }, codex: { name: "Codex", mono: "CX" },
};

export const total = (s: AgentSession) => s.tokens.input + s.tokens.output;

/** “9,6 M”, “812 k”. */
export function tokens(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n);
}

/** A-t-elle lu la carte avant d'écrire ? “lue avant”, “lue après”, “non lue”, ou sans objet si rien n'est écrit. */
export function mapState(s: AgentSession): "before" | "after" | "never" | "none" {
  if (!s.writes.length) return s.mapReads.length ? "before" : "none";
  if (!s.mapReads.length) return "never";
  return s.mapReads.some((r) => r.beforeFirstWrite) ? "before" : "after";
}
export const MAP_STATE = { before: "read before", after: "read after", never: "not read", none: "not applicable" } as const;

/** Les fichiers écrits par plusieurs sessions : deux agents sur le même code. */
export function overlaps(list: AgentSession[]): Map<string, AgentSession[]> {
  const by = new Map<string, AgentSession[]>();
  for (const s of list) for (const f of s.writes) (by.get(f) ?? by.set(f, []).get(f)!).push(s);
  return new Map([...by].filter(([, l]) => l.length > 1));
}

/** Où chaque fichier écrit vit sur la carte : son module, son bloc. */
export function touched(map: MapPayload, s: AgentSession): { module?: ArchNode; block?: ArchNode; files: string[] }[] {
  const comps = map.model.nodes.filter((n) => n.level === "component");
  const by = new Map<string, { module?: ArchNode; block?: ArchNode; files: string[] }>();
  for (const f of s.writes) {
    const m = comps.find((c) => c.files?.includes(f));
    const b = m ? map.model.nodes.find((n) => n.id === m.parent) : map.model.nodes.find((n) => n.level === "deployable" && n.files?.includes(f));
    const k = m?.id ?? b?.id ?? "";
    (by.get(k) ?? by.set(k, { ...(m ? { module: m } : {}), ...(b ? { block: b } : {}), files: [] }).get(k)!).files.push(f);
  }
  return [...by.values()].sort((a, b) => Number(!!b.module) - Number(!!a.module) || b.files.length - a.files.length);
}

/** Les cases du haut. */
export function agentTiles(list: AgentSession[]) {
  const week = list.filter((s) => Date.now() - Date.parse(s.started) < 7 * 864e5);
  const kinds = [...new Set(list.map((s) => AGENT[s.agent].name))];
  const sum = list.reduce((n, s) => n + total(s), 0), cached = list.reduce((n, s) => n + s.tokens.cached, 0);
  const writers = list.filter((s) => s.writes.length), before = writers.filter((s) => mapState(s) === "before");
  const ov = [...overlaps(list)].sort((a, b) => b[1].length - a[1].length)[0];
  return [
    { label: "Sessions this week", value: plural(week.length, "session", "sessions"), note: kinds.length ? `${plural(kinds.length, "agent", "agents")}: ${kinds.join(", ")}` : "no agent logged" },
    { label: "Tokens", value: tokens(sum), note: sum ? `including ${Math.round((cached / Math.max(1, list.reduce((n, s) => n + s.tokens.input, 0))) * 100)}% context read back from cache` : "no count received" },
    { label: "Map read before writing", value: `${before.length} session${before.length > 1 ? "s" : ""} out of ${writers.length}`, note: "those that changed at least one file" },
    { label: "Overlap", value: ov ? ov[0].split("/").slice(-2).join("/") : "none", note: ov ? `changed by ${plural(ov[1].length, "session", "sessions")}` : "no file written by two sessions", tone: ov ? "cr" : "" },
  ];
}
